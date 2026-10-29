import {randomUUID} from 'node:crypto';
import {watch} from 'node:fs';
import {API,AUTH,SCOPES,OpenAIClient,readJSON,responseFailure} from './openai.mjs';
import {failure,cancelled} from './credentials.mjs';

const entitled=a=>Boolean(a.access_token&&a.scopes?.includes('chatgpt.tokens.use.direct'));
const terminalRefreshCodes=new Set(['invalid_grant','invalid_refresh_token','token_expired','refresh_token_expired','refresh_token_invalidated','refresh_token_reused']);
const summary=(a,paused)=>({accountRef:a.accountRef,label:a.email||(a.pending?'授权待完成':'ChatGPT account'),registration:a.clientId.slice(-8),pending:Boolean(a.pending),signedIn:Boolean(a.access_token),planEnabled:entitled(a),paused:Boolean(paused),needsLogin:!a.access_token||Date.now()>=a.expiresAt&&!a.refresh_token});
function tokens(result,previous={}) {
  if(typeof result.access_token!=='string'||!result.access_token||!Number.isFinite(result.expires_in)||result.expires_in<=0||result.token_type?.toLowerCase()!=='bearer')throw failure('INVALID_TOKEN_RESPONSE','官方授权响应缺少有效凭据或过期信息。');
  return {access_token:result.access_token,refresh_token:result.refresh_token||previous.refresh_token,id_token:result.id_token||previous.id_token,scopes:typeof result.scope==='string'?result.scope.split(/\s+/):previous.scopes||[],expiresAt:Date.now()+result.expires_in*1000};
}
export function normalizePlanModels(payload) {
  if(!Array.isArray(payload?.models))throw failure('MODEL_LIST_FORMAT','官方订阅模型目录格式不匹配。');
  const seen=new Set();return payload.models.filter(m=>m.visibility==='list'&&typeof m.slug==='string'&&m.slug.length<=256&&!/[\x00-\x1f]/.test(m.slug)).filter(m=>{if(seen.has(m.slug))return false;seen.add(m.slug);return true;}).slice(0,1000).map(m=>({id:m.slug,name:typeof m.display_name==='string'?m.display_name.slice(0,200):m.slug,inputModalities:Array.isArray(m.input_modalities)?m.input_modalities.filter(v=>['text','image','file'].includes(v)):[],outputModalities:Array.isArray(m.output_modalities)?m.output_modalities.filter(v=>v==='text'):[],owner:'OpenAI',description:'',contextWindow:null,maxOutput:null,endpoints:['responses'],shutdownDate:''}));
}
export function buildPlanRequest(payload) {
  if(typeof payload.model!=='string'||!payload.model.trim()||payload.model.length>256||typeof payload.text!=='string'||!payload.text.trim()||payload.text.length>2200000||typeof payload.instructions!=='string'||payload.instructions.length>100000)throw failure('INVALID_REQUEST','模型或输入内容无效。');
  const images=payload.images||[];
  if(!Array.isArray(images)||images.length>4||images.some(i=>typeof i!=='string'||i.length>4*1024*1024||!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(i))||images.reduce((n,i)=>n+i.length,0)>12*1024*1024)throw failure('INVALID_IMAGES','图片无效或超过 4 张 / 12 MB 限制。');
  return {model:payload.model.trim(),instructions:payload.instructions,input:[{role:'user',content:[{type:'input_text',text:payload.text},...images.map(image_url=>({type:'input_image',image_url,detail:'high'}))]}],store:false,stream:true};
}
export async function consumeResponses(response,onDelta,signal) {
  const reader=response.body?.getReader();if(!reader)throw failure('EMPTY_RESPONSE','官方服务返回空流。');
  let buffer='',text='',bytes=0,completed=false,sawData=false;const decoder=new TextDecoder();
  const add=delta=>{text+=delta;if(Buffer.byteLength(text)>2*1024*1024)throw failure('RESPONSE_TOO_LARGE','生成文字超过本地限制。');onDelta(delta);};
  const consume=event=>{
    const data=event.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(!data)return;sawData=true;
    let item;try{item=JSON.parse(data);}catch{throw failure('INVALID_STREAM','官方流式响应格式无效。');}
    if(item.type==='response.failed'||item.type==='error')throw responseFailure(response.status,{error:item.response?.error||item.error||item},response.headers);
    if(item.type==='response.incomplete')throw failure('INCOMPLETE_RESPONSE','输出未完成，请缩短输入后手动重试。');
    if(item.type==='response.output_text.delta'&&typeof item.delta==='string')add(item.delta);
    if(item.type==='response.completed'){
      if(item.response?.status&&item.response.status!=='completed')throw failure('INCOMPLETE_RESPONSE','官方请求未完整结束。');
      const full=item.response?.output?.filter(o=>o.type==='message').flatMap(o=>o.content||[]).filter(o=>o.type==='output_text').map(o=>o.text||'').join('\n');
      if(!text&&full)add(full);
      if(!text.trim())throw failure('EMPTY_RESPONSE','未收到文本结果，可能需要更换模型或调整输入。');
      completed=true;
    }
  };
  try {
    while(!completed){cancelled(signal);const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>16*1024*1024)throw failure('RESPONSE_TOO_LARGE','官方响应超过大小限制。');buffer+=decoder.decode(value,{stream:true});buffer=buffer.replace(/\r\n/g,'\n');let at;while((at=buffer.indexOf('\n\n'))>=0&&!completed){consume(buffer.slice(0,at));buffer=buffer.slice(at+2);}}
    buffer+=decoder.decode();if(!completed&&buffer.trim())consume(buffer);
    cancelled(signal);if(!completed){
      if(!sawData){const error=failure('INVALID_RESPONSE','官方未返回可识别的流式事件。');error.httpStatus=response.status;error.requestId=response.headers.get('x-request-id')||'';throw error;}
      throw failure('INCOMPLETE_RESPONSE','连接提前结束；部分结果未计作成功，请手动重试。');
    }return text.trim();
  } finally {await reader.cancel().catch(()=>{});reader.releaseLock();}
}

export class ChatGPTService {
  constructor(store,client=new OpenAIClient()){this.store=store;this.client=client;this.active=new Map();}
  status(){return this.store.transaction(s=>({version:1,accounts:s.accounts.map(a=>summary(a,s.paused[a.accountRef]))}));}
  async login(accountRef,onAuthorize,signal) {
    const saved=await this.store.transaction(s=>({hostId:s.hostId,previous:s.accounts.find(a=>a.accountRef===accountRef)}),signal);
    if(accountRef&&!saved.previous)throw failure('ACCOUNT_REQUIRED','此账号记录已不存在，请刷新。');
    let registrationRef=saved.previous?.accountRef||'';
    const preserveRegistration=async clientId=>{
      await this.store.transaction(s=>{
        cancelled(signal);
        const existing=s.accounts.find(a=>a.clientId===clientId);
        if(existing){if(existing.subject||existing.access_token)throw failure('REGISTRATION_CONFLICT','此应用注册已属于其他账号。');registrationRef=existing.accountRef;return;}
        if(s.accounts.length>=20)throw failure('ACCOUNT_LIMIT','最多保存 20 个账号注册，请选择已有账号重新授权。');
        registrationRef=randomUUID();s.accounts.push({accountRef:registrationRef,clientId,subject:'',email:'',scopes:[],expiresAt:0,pending:true});
      },signal);
    };
    const result=await this.client.authorize(saved.hostId,saved.previous,onAuthorize,signal,preserveRegistration);
    const record={accountRef:registrationRef||randomUUID(),clientId:result.clientId,subject:result.subject,email:result.email,session:randomUUID(),...tokens(result)};
    await this.store.transaction(s=>{cancelled(signal);const existing=s.accounts.find(a=>a.clientId===record.clientId&&a.subject===record.subject);if(existing)record.accountRef=existing.accountRef;else if(s.accounts.length>=20&&!s.accounts.some(a=>a.accountRef===record.accountRef))throw failure('ACCOUNT_LIMIT','最多保存 20 个账号注册，请选择已有账号重新授权。');s.accounts=s.accounts.filter(a=>a.accountRef!==record.accountRef);s.accounts.push(record);delete s.paused[record.accountRef];},signal);
    return {account:summary(record,false)};
  }
  async access(accountRef,signal,requireUnpaused=false) {
    let expiredGrant;
    const account=await this.store.transaction(async s=>{
      if(requireUnpaused&&s.paused[accountRef])throw failure('PLAN_PAUSED','此账号因额度限制暂停。请管理用量后，在设置中手动继续。');
      let a=s.accounts.find(a=>a.accountRef===accountRef);
      if(!a||!a.access_token)throw failure('LOGIN_REQUIRED','请在设置中登录 ChatGPT。');
      if(!entitled(a))throw failure('PLAN_PERMISSION_REQUIRED','账号已登录，但尚未授权使用订阅额度；请重新授权。');
      if(a.expiresAt<Date.now()+60000){
        if(!a.refresh_token)throw failure('LOGIN_REQUIRED','登录已过期，请重新授权。');
        let refreshed;
        try{refreshed=await this.client.token({grant_type:'refresh_token',client_id:a.clientId,refresh_token:a.refresh_token,resource:API},signal);}
        catch(error){
          if(!terminalRefreshCodes.has(error.code))throw error;
          for(const key of ['access_token','refresh_token','id_token','session'])delete a[key];
          a.scopes=[];a.expiresAt=0;delete s.paused[accountRef];expiredGrant=error;
          return null;
        }
        if(refreshed.id_token)await this.client.verifyIdentity(refreshed.id_token,{clientId:a.clientId,subject:a.subject,signal});
        Object.assign(a,tokens(refreshed,a));if(!entitled(a))throw failure('PLAN_PERMISSION_REQUIRED','订阅授权已变化，请重新授权。');
      }
      return {...a};
    },signal);
    if(expiredGrant){
      const error=failure('LOGIN_REQUIRED','ChatGPT 登录已失效，请在设置中重新授权。');
      for(const key of ['httpStatus','requestId','bodyShape','param'])if(expiredGrant[key]!==undefined)error[key]=expiredGrant[key];
      throw error;
    }
    return account;
  }
  async models(accountRef,signal){const a=await this.access(accountRef,signal);const body=await this.client.json(API+'/models',{headers:{Authorization:'Bearer '+a.access_token}},signal);return {models:normalizePlanModels(body),truncated:body.models.length>1000,source:API+'/models'};}
  async resume(accountRef,signal){await this.store.transaction(s=>{delete s.paused[accountRef];},signal);return {resumed:true};}
  async logout(accountRef,signal) {
    for(const job of this.active.values())if(job.accountRef===accountRef)job.controller.abort();
    let warning='';
    await this.store.transaction(async s=>{
      const a=s.accounts.find(a=>a.accountRef===accountRef);if(!a)return;
      if(a.pending){s.accounts=s.accounts.filter(record=>record.accountRef!==accountRef);delete s.paused[accountRef];return;}
      if(a.refresh_token)try{
        const meta=await this.client.metadata(signal);if(!meta.revocation_endpoint)throw new Error();
        const response=await this.client.fetch(meta.revocation_endpoint,{method:'POST',redirect:'error',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:a.refresh_token,token_type_hint:'refresh_token',client_id:a.clientId}),signal:AbortSignal.timeout(15000)});
        await response.body?.cancel();if(!response.ok)throw new Error();
      }catch{warning='本机凭据已清除，但未确认远程撤销。可在 ChatGPT 设置中断开此应用。';}
      for(const key of ['access_token','refresh_token','id_token','session'])delete a[key];a.scopes=[];a.expiresAt=0;delete s.paused[accountRef];
    });
    return {signedOut:true,warning};
  }
  async generate(payload,onDelta,signal) {
    const body=buildPlanRequest(payload),accountRef=payload.accountRef;
    return this.store.requestLock(accountRef,async()=>{
      const a=await this.access(accountRef,signal,true),controller=new AbortController(),id=randomUUID();
      const combined=AbortSignal.any([signal||new AbortController().signal,controller.signal]);this.active.set(id,{accountRef,controller});
      // Also stop a running request when another browser signs this registration out.
      let checking=false,checkAgain=false,watchTimer;
      const checkSession=async()=>{
        if(checking){checkAgain=true;return;}checking=true;
        try{const s=await this.store.read(),current=s.accounts.find(x=>x.accountRef===accountRef);if(!current?.access_token||current.session!==a.session)controller.abort();}
        catch(error){if(!['EPERM','EBUSY','EACCES'].includes(error.code))controller.abort();else checkAgain=true;}
        finally{checking=false;if(checkAgain){checkAgain=false;watchTimer=setTimeout(checkSession,100);}}
      };
      const watcher=watch(this.store.directory,(_event,filename)=>{
        if(filename&&String(filename)!=='accounts.dpapi')return;
        clearTimeout(watchTimer);watchTimer=setTimeout(checkSession,50);
      });
      try {
        const response=await this.client.fetch(API+'/responses',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+a.access_token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:combined});
        if(!response.ok){let error={};try{error=await readJSON(response,65536);}catch{}throw responseFailure(response.status,error,response.headers);}
        return {translation:await consumeResponses(response,onDelta,combined)};
      }catch(error){
        if(error.code==='subscription_sharing_usage_limit_exceeded')await this.store.transaction(s=>{s.paused[accountRef]=true;});
        cancelled(combined);throw error;
      }finally{watcher.close();clearTimeout(watchTimer);checkAgain=false;this.active.delete(id);}
    },signal);
  }
}
