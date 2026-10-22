/* Exercise real builds and deliberately damaged copies. Never edits the checkout. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {sourceFiles,runtimeFiles} from './package-files.mjs';
const require=createRequire(import.meta.url),{unzipSync,zipSync}=require('../vendor/fflate/umd/index.js');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const version=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'))).version;
const reportPath=path.resolve(process.argv[2]||'build-results.json'),scratch=fs.mkdtempSync(path.join(os.tmpdir(),'qudadflow-build-'));
const snapshot=path.join(scratch,'source'),first=path.join(scratch,'first'),second=path.join(scratch,'second'),results=[];
const runtimeName=`qudadflow-translator-v${version}.zip`,sourceName=`qudadflow-translator-source-v${version}.zip`;
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function run(command,args,success=true){
  const result=spawnSync(command,args,{cwd:snapshot,encoding:'utf8',timeout:120000,windowsHide:true,maxBuffer:4*1024*1024});
  if(result.error)throw result.error;
  const output=result.stdout+result.stderr;
  if(success)assert.equal(result.status,0,output.slice(-2500));else assert.notEqual(result.status,0,'Damaged package unexpectedly passed');
  return output;
}
const validate=(success=true)=>run(process.execPath,[path.join(snapshot,'tools/validate-package.mjs')],success);
const audit=(success=true)=>run(process.execPath,[path.join(snapshot,'tools/audit-package.cjs'),first],success);
const build=(out,success=true)=>run('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-File',path.join(snapshot,'package.ps1'),'-OutputDirectory',out],success);
async function check(name,fn){try{const detail=await fn();results.push({name,passed:true,...(detail?{detail}:{})});console.log('PASS '+name);}catch(error){results.push({name,passed:false,error:error.stack});console.error('FAIL '+name+': '+error.message);}}
function changed(relative,content,fn){
  const file=path.join(snapshot,relative),before=fs.existsSync(file)?fs.readFileSync(file):null;
  try{if(content===null)fs.unlinkSync(file);else fs.writeFileSync(file,content);return fn();}
  finally{if(before===null)fs.unlinkSync(file);else fs.writeFileSync(file,before);}
}
function damagedArchive(transform,expected){
  const file=path.join(first,runtimeName),original=fs.readFileSync(file);
  try{const entries=unzipSync(original);transform(entries);fs.writeFileSync(file,zipSync(entries,{level:0}));assert.match(audit(false),expected);}
  finally{fs.writeFileSync(file,original);}
}
try{
  for(const name of sourceFiles(root)){const target=path.join(snapshot,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,name),target);}
  await check('Build validates staged resources and automatically emits both audited ZIPs and SHA256 checksums',()=>{
    build(first);const report=JSON.parse(fs.readFileSync(path.join(first,`qudadflow-package-validation-v${version}.json`)));
    assert.equal(report.packages.length,2);assert.equal(report.packages[0].entries,runtimeFiles(snapshot).length);
    const sums=fs.readFileSync(path.join(first,`SHA256SUMS-v${version}.txt`),'utf8');
    for(const item of report.packages){assert.equal(item.sha256,digest(fs.readFileSync(path.join(first,item.file))));assert.ok(sums.includes(item.sha256+'  '+item.file));}
    assert.equal(fs.readdirSync(snapshot).some(name=>name.startsWith('.package-staging-')),false);
    return {runtimeFiles:report.packages[0].entries,sourceFiles:report.packages[1].entries};
  });
  await check('Identical source bytes produce identical runtime/source ZIPs despite changed source modification times',()=>{
    const target=path.join(snapshot,'popup.js');fs.utimesSync(target,new Date('2022-05-01T00:00:00Z'),new Date('2022-05-01T00:00:00Z'));build(second);
    for(const name of [runtimeName,sourceName])assert.ok(fs.readFileSync(path.join(first,name)).equals(fs.readFileSync(path.join(second,name))),name+' is not reproducible');
  });
  await check('New source modules join the runtime inventory and missing transitive imports fail validation',()=>changed('src/build-fixture.mjs','export const fixture=true;\n',()=>{
    assert.ok(runtimeFiles(snapshot).includes('src/build-fixture.mjs'));validate();
    fs.writeFileSync(path.join(snapshot,'src/build-fixture.mjs'),"import './missing-build-fixture.mjs';\n");assert.match(validate(false),/missing-build-fixture.mjs/);
  }));
  await check('Syntax errors in first-party runtime code fail the build checks',()=>changed('popup.js',fs.readFileSync(path.join(snapshot,'popup.js'),'utf8')+'\nconst = ;\n',()=>assert.match(validate(false),/popup.js.*语法检查失败/)));
  await check('Remote module imports fail validation without executing or fetching them',()=>changed('src/build-fixture.mjs',"import 'https://example.invalid/never-loaded.mjs';\n",()=>assert.match(validate(false),/non-local resource/)));
  await check('Missing bundled PDF codec is detected before an installable package is produced',()=>changed('vendor/pdfjs/wasm/openjpeg.wasm',null,()=>assert.match(validate(false),/openjpeg.wasm/)));
  await check('Private-file rejection preserves existing output packages and leaves no staging directory',()=>{
    const before=digest(fs.readFileSync(path.join(first,runtimeName)));
    changed('src/.env.fixture','SYNTHETIC_BUILD_DATA=1\n',()=>assert.match(build(first,false),/Unexpected package path/));
    assert.equal(digest(fs.readFileSync(path.join(first,runtimeName))),before);assert.equal(fs.readdirSync(snapshot).some(name=>name.startsWith('.package-staging-')),false);
  });
  await check('Archive auditing rejects an omitted binary even when no static import names it',()=>damagedArchive(entries=>delete entries['vendor/pdfjs/wasm/openjpeg.wasm'],/Archive inventory differs/));
  await check('Archive auditing rejects modified runtime bytes',()=>damagedArchive(entries=>entries['popup.js']=Buffer.concat([entries['popup.js'],Buffer.from('\n// altered fixture\n')]),/Archive differs from working file: popup.js/));
  await check('Archive auditing rejects development files injected into the runtime',()=>damagedArchive(entries=>entries['docs/unexpected.txt']=Buffer.from('fixture'),/Archive inventory differs/));
  await check('Divergent hosted and installed English privacy policies fail validation',()=>changed('docs/privacy.html',fs.readFileSync(path.join(snapshot,'docs/privacy.html'),'utf8')+'\n<!-- changed -->',()=>assert.match(validate(false),/隐私政策不一致/)));
}catch(error){results.push({name:'setup',passed:false,error:error.stack});console.error(error);}
finally{
  const temporaryRoot=path.resolve(os.tmpdir())+path.sep;
  assert.ok(path.resolve(scratch).startsWith(temporaryRoot)&&path.basename(scratch).startsWith('qudadflow-build-'));
  fs.rmSync(scratch,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  fs.mkdirSync(path.dirname(reportPath),{recursive:true});
  const report={version,scope:'Local source snapshot, isolated package outputs and intentionally damaged fixtures. No publication, user browser or network API.',passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results};
  fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,failed:report.failed}));if(report.failed)process.exitCode=1;
}
