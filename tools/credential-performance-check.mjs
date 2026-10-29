// Real Windows DPAPI interoperability and startup measurements, with synthetic data only.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn,spawnSync,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {CredentialStore,dpapi} from '../native-host/credentials.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(process.platform!=='win32')throw new Error('Windows is required for this check.');
const reportPath=path.resolve(process.argv[2]);
await fs.mkdir(path.dirname(reportPath),{recursive:true});
const scratch=await fs.mkdtemp(path.join(path.dirname(reportPath),'crypto-fixture-'));
const helper=path.join(scratch,'QudadFlowBridge.exe');
const results=[],measurements={};
async function check(name,action){try{await action();results.push({name,passed:true});console.log('PASS '+name);}catch(error){results.push({name,passed:false,error:error.message});console.error('FAIL '+name+': '+error.message);}}
const compiler=path.join(process.env.SystemRoot,'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
const build=spawnSync(compiler,['/nologo','/target:exe','/reference:System.Web.Extensions.dll','/reference:System.Security.dll','/out:'+helper,path.join(root,'native-host/Launcher.cs')],{windowsHide:true,encoding:'utf8'});
if(build.status!==0)throw new Error('Could not compile the credential helper: '+build.stdout);
function compiled(mode,value){return new Promise((resolve,reject)=>{
  const child=spawn(helper,['--credential-crypto',mode],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  const chunks=[];child.stdout.on('data',chunk=>chunks.push(chunk));child.stderr.resume();
  child.on('error',()=>reject(new Error('Credential helper did not start')));
  child.on('close',code=>code===0?resolve(Buffer.concat(chunks).toString().trim()):reject(new Error('Credential helper rejected input')));
  child.stdin.on('error',()=>{});child.stdin.end(value);
});}
try{
  const plain=Buffer.from('QudadFlow synthetic credential; no account or token.').toString('base64');
  let oldCipher,newCipher;
  await check('Compiled helper decrypts the existing PowerShell DPAPI format',async()=>{oldCipher=await dpapi('protect',plain);assert.equal(await compiled('unprotect',oldCipher),plain);});
  await check('PowerShell fallback decrypts the compiled helper format',async()=>{newCipher=await compiled('protect',plain);assert.equal(await dpapi('unprotect',newCipher),plain);});
  await check('Compiled helper rejects corrupt and oversized input',async()=>{await assert.rejects(compiled('unprotect','not-base64'));await assert.rejects(compiled('protect','a'.repeat(2097153)));});
  await check('Measure three credential reads with each helper',async()=>{
    const measure=async crypt=>{const times=[];for(let i=0;i<3;i++){const start=performance.now();assert.equal(await crypt('unprotect',oldCipher),plain);times.push(Math.round(performance.now()-start));}return {samplesMs:times,medianMs:[...times].sort((a,b)=>a-b)[1]};};
    measurements.powershell=await measure(dpapi);measurements.compiled=await measure(compiled);
  });
  await check('Ten unchanged credential reads decrypt once and preserve cross-process changes',async()=>{
    const directory=path.join(scratch,'accounts');let decrypts=0;
    const crypt=async(mode,value)=>{if(mode==='unprotect')decrypts++;return compiled(mode,value);};
    const writer=new CredentialStore(directory,crypt);await writer.transaction(state=>{state.synthetic='first';});
    const baselineSource=execFileSync('git',['show','v0.9.1:native-host/credentials.mjs'],{cwd:root,encoding:'utf8'});
    const {CredentialStore:Before}=await import('data:text/javascript;base64,'+Buffer.from(baselineSource).toString('base64'));
    const before=new Before(directory,crypt),after=new CredentialStore(directory,crypt);
    const run=async store=>{decrypts=0;const start=performance.now();for(let i=0;i<10;i++)assert.equal((await store.read()).synthetic,'first');return {reads:10,decrypts,elapsedMs:Math.round(performance.now()-start)};};
    measurements.beforeCache=await run(before);measurements.afterCache=await run(after);assert.equal(measurements.afterCache.decrypts,1);
    await writer.transaction(state=>{state.synthetic='second';});assert.equal((await after.read()).synthetic,'second');
  });
}finally{
  if(!scratch.startsWith(path.dirname(reportPath)+path.sep+'crypto-fixture-'))throw new Error('Unsafe cleanup target');
  await fs.rm(scratch,{recursive:true,force:true});
  const report={scope:'Windows DPAPI and compiled helper, synthetic payload only; repeated credential reads use the same compiled helper on both versions.',measurements,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results};
  await fs.writeFile(reportPath,JSON.stringify(report,null,2));console.log(JSON.stringify({measurements,passed:report.passed,failed:report.failed}));if(report.failed)process.exitCode=1;
}
