import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CredentialStore,failure} from './credentials.mjs';
import {ChatGPTService} from './service.mjs';

export function serve(input,output,service) {
  let buffer=Buffer.alloc(0),ended=false;const requests=new Map();let writes=Promise.resolve();
  const diagnostics=error=>({...(Number.isInteger(error.httpStatus)?{httpStatus:error.httpStatus}:{}),...(error.requestId?{upstreamRequestId:error.requestId}:{}),...(error.param?{param:error.param}:{}),...(error.bodyShape?{bodyShape:error.bodyShape}:{})});
  const send=value=>{if(ended)return;const bytes=Buffer.from(JSON.stringify(value));if(bytes.length>900000)throw failure('MESSAGE_TOO_LARGE','本地响应超过单条限制。');const length=Buffer.alloc(4);length.writeUInt32LE(bytes.length);writes=writes.then(()=>new Promise(resolve=>output.write(Buffer.concat([length,bytes]),()=>resolve())));};
  const delta=(id,text)=>{for(let i=0;i<text.length;i+=16000)send({id,event:'delta',text:text.slice(i,i+16000)});};
  const processMessage=message=>{
    const {id,method,payload={}}=message||{};
    if(typeof id!=='string'||id.length>80)return;
    if(method==='cancel'){requests.get(id)?.abort();return;}
    if(requests.has(id))return;
    if(requests.size>=16){send({id,ok:false,code:'HOST_BUSY',error:'本地任务队列已满。'});return;}
    const controller=new AbortController();requests.set(id,controller);
    const action=async()=>{
      if(!payload||typeof payload!=='object'||Array.isArray(payload))throw failure('INVALID_REQUEST','本地请求格式无效。');
      switch(method){
        case 'status':return service.status();
        case 'login':return service.login(payload.accountRef,url=>send({id,event:'authorize',url}),controller.signal);
        case 'logout':return service.logout(payload.accountRef,controller.signal);
        case 'resume':return service.resume(payload.accountRef,controller.signal);
        case 'models':return service.models(payload.accountRef,controller.signal);
        case 'generate':await service.generate(payload,text=>delta(id,text),controller.signal);return {completed:true};
        default:throw failure('INVALID_METHOD','不支持的本地操作。');
      }
    };
    action().then(result=>send({id,ok:true,result})).catch(error=>send({id,ok:false,code:controller.signal.aborted?'CANCELLED':error.code||'HOST_ERROR',error:controller.signal.aborted?'操作已取消。':error.code?error.message:'本地连接失败，请检查网络或连接程序。',...diagnostics(error)})).finally(()=>requests.delete(id));
  };
  input.on('data',chunk=>{
    buffer=Buffer.concat([buffer,chunk]);
    while(buffer.length>=4){const length=buffer.readUInt32LE(0);if(length>32*1024*1024){input.destroy();return;}if(buffer.length<length+4)return;const bytes=buffer.subarray(4,4+length);buffer=buffer.subarray(4+length);try{processMessage(JSON.parse(bytes.toString('utf8')));}catch{input.destroy();return;}}
  });
  const close=()=>{ended=true;for(const controller of requests.values())controller.abort();};input.on('end',close);input.on('error',close);output.on('error',close);
}

const entry=process.argv[1]?await fs.realpath(process.argv[1]).catch(()=>path.resolve(process.argv[1])):'';
const modulePath=await fs.realpath(fileURLToPath(import.meta.url)).catch(()=>fileURLToPath(import.meta.url));
if(entry&&(process.platform==='win32'?entry.toLowerCase()===modulePath.toLowerCase():entry===modulePath)){
  try {
    const config=JSON.parse(await fs.readFile(new URL('./host-config.json',import.meta.url),'utf8'));
    if(!/^chrome-extension:\/\/[a-p]{32}\/$/.test(process.argv[2]||'')||!config.allowedOrigins?.includes(process.argv[2]))throw new Error('Unauthorized extension');
    // Use the installed physical directory across Edge/Chrome and packaged apps.
    serve(process.stdin,process.stdout,new ChatGPTService(new CredentialStore(path.resolve(path.dirname(modulePath),'../ChatGPT'))));
  } catch {process.stderr.write('QudadFlow host could not start. Run the local installer.\n');process.exitCode=1;}
}
