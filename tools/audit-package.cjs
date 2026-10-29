/* Verify both archives against the same inventory and reviewed working files. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {unzipSync}=require('../vendor/fflate/umd/index.js');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||path.join(root,'../../outputs'));
const version=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'))).version;
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

(async()=>{
  const {runtimeFiles,sourceFiles,checkLocalReferences,safePackagePath}=await import('./package-files.mjs');
  const runtime=runtimeFiles(root),reports=[];
  for(const source of [false,true]){
    const file=`qudadflow-translator-${source?'source-':''}v${version}.zip`;
    const bytes=fs.readFileSync(path.join(out,file)),entries=unzipSync(bytes),names=Object.keys(entries),expected=source?sourceFiles(root):runtime;
    for(const name of names)assert.ok(safePackagePath(name),'Unsafe or private ZIP path: '+name);
    assert.deepEqual(names.slice().sort(),expected,'Archive inventory differs from reviewed sources');
    for(const name of names)assert.equal(digest(entries[name]),digest(fs.readFileSync(path.join(root,name))),`Archive differs from working file: ${name}`);
    const manifest=JSON.parse(Buffer.from(entries['manifest.json']).toString());
    assert.equal(manifest.version,version);assert.equal(manifest.manifest_version,3);assert.deepEqual(manifest.host_permissions,['https://api.mymemory.translated.net/*']);
    checkLocalReferences(runtime,name=>Buffer.from(entries[name]).toString());
    reports.push({file,bytes:bytes.length,entries:names.length,sha256:digest(bytes),workingFileComparison:'passed',inventory:'passed',localReferences:'passed',version});
  }
  assert.ok(fs.readFileSync(path.join(root,'privacy.html')).equals(fs.readFileSync(path.join(root,'docs/privacy.html'))),'Privacy policies differ');
  fs.writeFileSync(path.join(out,`qudadflow-package-validation-v${version}.json`),JSON.stringify({packages:reports,runtimePolicyEqualsHostedSource:true},null,2)+'\n');
  fs.writeFileSync(path.join(out,`SHA256SUMS-v${version}.txt`),reports.map(r=>`${r.sha256}  ${r.file}`).join('\n')+'\n');
  console.log(JSON.stringify(reports,null,2));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
