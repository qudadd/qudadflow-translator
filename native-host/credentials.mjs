import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';

export function failure(code, message) { return Object.assign(new Error(message), {code}); }
export function cancelled(signal) { if(signal?.aborted) throw failure('CANCELLED','操作已取消。'); }

// Locks are shared by Chrome and Edge host processes. A dead owner's lock can
// be recovered; a live but slow owner is never evicted just because time elapsed.
export async function withFileLock(file, action, signal, timeout = 120000) {
  await fs.mkdir(path.dirname(file),{recursive:true});
  const started=Date.now(), token=randomUUID(); let handle;
  while(!handle) {
    cancelled(signal);
    try { handle=await fs.open(file,'wx',0o600); await handle.writeFile(JSON.stringify({pid:process.pid,token})); }
    catch(error) {
      if(error.code!=='EEXIST')throw error;
      try {
        const owner=JSON.parse(await fs.readFile(file,'utf8'));
        if(Number.isInteger(owner.pid)&&owner.pid>0) {
          try{process.kill(owner.pid,0);}catch(e){if(e.code==='ESRCH')await fs.unlink(file).catch(()=>{});}
        }
      } catch {} // A newly created lock may not have its owner record yet.
      if(Date.now()-started>timeout)throw failure('HOST_BUSY','其他窗口正在使用此账号，请稍后重试。');
      await delay(100,undefined,{signal}).catch(()=>cancelled(signal));
    }
  }
  try { cancelled(signal);return await action(); }
  finally { await handle.close();try{const owner=JSON.parse(await fs.readFile(file,'utf8'));if(owner.token===token)await fs.unlink(file);}catch{} }
}

export function dpapi(mode, value) {
  if(process.platform!=='win32')throw failure('UNSUPPORTED_OS','本地连接程序当前仅支持 Windows。');
  return new Promise((resolve,reject)=>{
    const script=fileURLToPath(new URL('./credential-crypto.ps1',import.meta.url));
    const child=spawn(path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script,'-Mode',mode],{windowsHide:true,stdio:['pipe','pipe','pipe']});
    let output='',size=0;const timer=setTimeout(()=>child.kill(),15000);
    child.stdout.on('data',chunk=>{size+=chunk.length;if(size>2*1024*1024)child.kill();else output+=chunk;});
    child.stderr.resume(); // Never print crypto inputs or PowerShell exception text.
    child.on('error',()=>{clearTimeout(timer);reject(failure('CREDENTIAL_STORE','无法启动 Windows 凭据保护。'));});
    child.on('close',code=>{clearTimeout(timer);code===0&&output.trim()?resolve(output.trim()):reject(failure('CREDENTIAL_STORE','Windows 凭据保护失败；未降级为明文存储。'));});
    child.stdin.on('error',()=>{});child.stdin.end(value);
  });
}

export class CredentialStore {
  constructor(directory, crypt=dpapi) {this.directory=directory;this.crypt=crypt;this.file=path.join(directory,'accounts.dpapi');}
  async read() {
    try { return JSON.parse(Buffer.from(await this.crypt('unprotect',await fs.readFile(this.file,'utf8')),'base64').toString('utf8')); }
    catch(e){if(e.code==='ENOENT')return {version:1,hostId:'urn:uuid:'+randomUUID(),accounts:[],paused:{}};throw e;}
  }
  async write(state) {
    await fs.mkdir(this.directory,{recursive:true});
    const encrypted=await this.crypt('protect',Buffer.from(JSON.stringify(state)).toString('base64'));
    const temp=this.file+'.'+randomUUID()+'.tmp';
    try{
      await fs.writeFile(temp,encrypted,{mode:0o600,flag:'wx'});
      // Windows scanners/readers can briefly hold the destination open. Keep the
      // old encrypted record intact until the atomic replacement succeeds.
      for(let attempt=0;;attempt++)try{await fs.rename(temp,this.file);break;}
      catch(error){if(attempt>=12||!['EPERM','EBUSY','EACCES'].includes(error.code))throw error;await delay(25*(attempt+1));}
    }
    finally{await fs.unlink(temp).catch(()=>{});}
  }
  transaction(action,signal) {return withFileLock(path.join(this.directory,'accounts.lock'),async()=>{
    const exists=await fs.access(this.file).then(()=>true,()=>false);
    const state=await this.read(),before=JSON.stringify(state);const result=await action(state);
    if(!exists||JSON.stringify(state)!==before)await this.write(state);return result;
  },signal);}
  requestLock(accountRef,action,signal) {
    if(!/^[a-f0-9-]{36}$/i.test(accountRef||''))throw failure('ACCOUNT_REQUIRED','请选择已授权的 ChatGPT 账号。');
    return withFileLock(path.join(this.directory,accountRef+'.request.lock'),action,signal,10*60*1000);
  }
}
