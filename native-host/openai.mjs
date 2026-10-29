import {createHash,randomBytes,createPublicKey,verify,timingSafeEqual} from 'node:crypto';
import http from 'node:http';
import {failure,cancelled} from './credentials.mjs';

export const AUTH='https://auth.openai.com';
export const API='https://api.openai.com/v1';
export const SCOPES='openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
const random=()=>randomBytes(32).toString('base64url');
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const diagnosticCode=value=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_]{0,99}$/.test(value)?value:'';
const diagnosticId=value=>typeof value==='string'&&/^[a-zA-Z0-9_.-]{1,160}$/.test(value)?value:'';
function callbackFailureText(error) {
  const code=diagnosticCode(error?.code),requestId=diagnosticId(error?.requestId);
  const hints={CONSENT_DENIED:'你取消或拒绝了官方授权。',INVALID_CLIENT:'官方返回的应用注册信息不完整。',INVALID_CODE:'官方授权回调缺少有效代码。',INVALID_ID_TOKEN:'官方身份校验未通过。',invalid_grant:'本次授权码无效或已过期，请重新发起授权。',subscription_sharing_user_not_eligible:'当前账号或工作区未获准使用 ChatGPT 计划额度。','3p_delegated_access_policy_denied':'当前工作区未允许此应用访问。',HTTP_403:'官方服务拒绝了当前账号或工作区的授权。'};
  const hint=hints[code]||(Number.isInteger(error?.httpStatus)?'官方服务未完成账号授权。':'本地身份校验或网络处理未完成。');
  return `授权未完成。${hint}${code?` 错误码：${code}。`:''}${requestId?` 请求 ID：${requestId}。`:''}请返回 QudadFlow 查看账号状态。`;
}
export async function readJSON(response,limit=1024*1024) {
  let bytes=0,parts=[];
  if(!response.body)throw failure('INVALID_RESPONSE','官方服务返回空响应。');
  const reader=response.body.getReader();
  try {for(;;){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>limit)throw failure('RESPONSE_TOO_LARGE','官方响应超过大小限制。');parts.push(Buffer.from(value));}}
  finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw failure('INVALID_RESPONSE',`官方服务未返回 JSON（HTTP ${response.status}），请检查网络或服务状态。`);}
}
export function responseFailure(status,body={},headers) {
  const details=body&&typeof body==='object'&&!Array.isArray(body)?body:{};
  const apiError=details.error&&typeof details.error==='object'&&!Array.isArray(details.error)?details.error:{};
  const rawCode=apiError.code||details.error_code||details.code||(typeof details.error==='string'?details.error:'');
  const code=diagnosticCode(rawCode)||`HTTP_${status}`;
  const hints={subscription_sharing_user_not_eligible:'当前账号或工作区尚不具备订阅共享资格。','3p_delegated_access_policy_denied':'当前工作区未允许此应用访问 ChatGPT 计划。',subscription_sharing_usage_limit_exceeded:'ChatGPT 计划或本应用额度已达限制。请管理用量后手动继续。',subscription_sharing_usage_unavailable:'暂时无法核查订阅额度，请稍后重试。',subscription_sharing_unsupported_capability:'所选模型不支持当前输入或参数。',invalid_grant:'ChatGPT 登录已失效，请重新授权。',invalid_refresh_token:'ChatGPT 登录已失效，请重新授权。',token_expired:'ChatGPT 登录已失效，请重新授权。',refresh_token_expired:'ChatGPT 登录已失效，请重新授权。',refresh_token_invalidated:'ChatGPT 登录已失效，请重新授权。',refresh_token_reused:'ChatGPT 登录已失效，请重新授权。',HTTP_401:'登录已失效或未获订阅使用权限，请重新授权。',HTTP_403:'官方服务拒绝访问，请检查账号资格、工作区策略或网络。',HTTP_429:'官方服务限流或额度不足，请稍后手动重试。',HTTP_503:'官方服务暂时不可用，请稍后重试。'};
  const requestId=[headers?.get?.('x-request-id'),details.request_id,apiError.request_id].map(diagnosticId).find(Boolean)||'';
  const error=failure(code,(hints[code]||`官方请求失败（HTTP ${status}）。`)+(requestId?` 请求 ID：${requestId}。`:''));
  error.httpStatus=status;
  error.requestId=requestId;
  error.bodyShape=Array.isArray(body)?'array':body&&typeof body==='object'?Object.keys(body).slice(0,20):typeof body;
  error.param=typeof apiError.param==='string'?apiError.param.slice(0,160):'';
  return error;
}
export class OpenAIClient {
  constructor(fetchImpl=fetch){this.fetch=fetchImpl;}
  async json(url,options={},signal) {
    const response=await this.fetch(url,{...options,redirect:'error',signal:AbortSignal.any([signal||new AbortController().signal,AbortSignal.timeout(20000)])});
    if(!response.ok){let body={};try{body=await readJSON(response,65536);}catch{}throw responseFailure(response.status,body,response.headers);}
    return readJSON(response);
  }
  async metadata(signal) {
    const data=await this.json(AUTH+'/.well-known/openid-configuration',{},signal);
    if(data.issuer!==AUTH)throw failure('INVALID_ISSUER','官方身份配置不匹配。');
    for(const key of ['jwks_uri','revocation_endpoint'])if(data[key]&&new URL(data[key]).origin!==AUTH)throw failure('INVALID_AUTH_ENDPOINT','官方身份端点不匹配。');
    if(!data.jwks_uri)throw failure('INVALID_AUTH_ENDPOINT','缺少官方签名验证端点。');
    return data;
  }
  async verifyIdentity(token,{clientId,nonce,subject,signal}) {
    if(typeof token!=='string'||token.length>32768)throw failure('INVALID_ID_TOKEN','身份令牌无效。');
    const parts=token.split('.');if(parts.length!==3)throw failure('INVALID_ID_TOKEN','身份令牌格式无效。');
    let header,claims;try{header=JSON.parse(Buffer.from(parts[0],'base64url'));claims=JSON.parse(Buffer.from(parts[1],'base64url'));}catch{throw failure('INVALID_ID_TOKEN','身份令牌格式无效。');}
    if(!['RS256','ES256'].includes(header.alg)||header.crit)throw failure('INVALID_ID_TOKEN','不支持的身份签名。');
    const meta=await this.metadata(signal),jwks=await this.json(meta.jwks_uri,{},signal);
    const jwk=jwks.keys?.find(key=>key.kid===header.kid&&(!key.use||key.use==='sig')&&(!key.alg||key.alg===header.alg));
    if(!jwk)throw failure('INVALID_ID_TOKEN','未找到官方身份签名。');
    const key=createPublicKey({key:jwk,format:'jwk'});
    const valid=verify('sha256',Buffer.from(parts[0]+'.'+parts[1]),header.alg==='ES256'?{key,dsaEncoding:'ieee-p1363'}:key,Buffer.from(parts[2],'base64url'));
    const now=Math.floor(Date.now()/1000),aud=Array.isArray(claims.aud)?claims.aud:[claims.aud];
    if(!valid||claims.iss!==AUTH||!aud.includes(clientId)||(aud.length>1&&claims.azp!==clientId)||!Number.isFinite(claims.exp)||claims.exp<=now||claims.iat>now+60||claims.nbf>now+60||typeof claims.sub!=='string'||!claims.sub||(nonce&&!same(claims.nonce,nonce))||(subject&&claims.sub!==subject))throw failure('INVALID_ID_TOKEN','身份、签名或授权状态校验失败。');
    return {subject:claims.sub,email:typeof claims.email==='string'?claims.email.slice(0,200):''};
  }
  token(fields,signal) {return this.json(AUTH+'/api/accounts/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(fields)},signal);}
  async authorize(hostId,previous,onAuthorize,signal,onRegistration) {
    const state=random(),nonce=random(),verifier=random();let server;
    return new Promise((resolve,reject)=>{
      let finished=false,processing=false;const timeout=setTimeout(()=>finish(failure('LOGIN_TIMEOUT','登录等待已过期，请重新登录。')),10*60*1000);
      const abort=()=>finish(failure('CANCELLED','登录已取消。'));
      const finish=(error,value)=>{if(finished)return;finished=true;clearTimeout(timeout);signal?.removeEventListener('abort',abort);server?.close();error?reject(error):resolve(value);};
      server=http.createServer(async(req,res)=>{
        res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'");res.setHeader('Referrer-Policy','no-referrer');
        const reply=(status,text)=>{res.writeHead(status);res.end('<!doctype html><meta charset="utf-8"><title>QudadFlow</title><p>'+text+'</p>');};
        let url;try{url=new URL(req.url,'http://127.0.0.1');}catch{return reply(400,'无效回调。');}
        if(req.method!=='GET'||req.headers.host!==new URL(redirect).host||url.pathname!=='/auth/callback')return reply(404,'未找到。');
        if(!same(url.searchParams.get('state'),state))return reply(400,'授权状态不匹配，请返回扩展重新登录。');
        if(processing||finished)return reply(409,'此授权已处理。');processing=true;
        try {
          if(url.searchParams.has('error')){
            const oauthCode=diagnosticCode(url.searchParams.get('error_code'))||diagnosticCode(url.searchParams.get('error'));
            const error=failure(oauthCode==='access_denied'?'CONSENT_DENIED':oauthCode||'OAUTH_DENIED','官方授权未完成。');
            error.requestId=diagnosticId(url.searchParams.get('request_id'));
            throw error;
          }
          const clientId=url.searchParams.get('client_id')||previous?.clientId;
          if(!clientId||clientId==='dynamic_agent_client'||clientId.length>256||(previous&&clientId!==previous.clientId))throw failure('INVALID_CLIENT','账号注册标识不匹配。');
          const code=url.searchParams.get('code');if(!code||code.length>8192)throw failure('INVALID_CODE','授权回调缺少有效代码。');
          if(!previous)await onRegistration?.(clientId);
          let token;try{token=await this.token({grant_type:'authorization_code',client_id:clientId,code,code_verifier:verifier,redirect_uri:redirect,resource:API},signal);}
          catch(error){if(error?.code==='invalid_grant')error.message=previous?'授权码兑换失败。请在设置中使用当前账号重新发起授权。':'授权码兑换失败。已保留应用注册，请在设置中选择“待完成授权”重新发起授权。';throw error;}
          const identity=await this.verifyIdentity(token.id_token,{clientId,nonce,subject:previous?.subject,signal});cancelled(signal);
          reply(200,'官方授权已完成。请返回 QudadFlow 查看账号权限并读取模型。');finish(null,{clientId,...identity,...token});
        } catch(error){reply(400,callbackFailureText(error));finish(error);}
      });
      let redirect;
      server.on('error',()=>finish(failure('CALLBACK_UNAVAILABLE','无法启动本机授权回调。')));
      signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){abort();return;}
      server.listen(0,'127.0.0.1',()=>{
        redirect=`http://127.0.0.1:${server.address().port}/auth/callback`;
        const url=new URL(AUTH+'/api/accounts/authorize');
        const params={client_id:previous?.clientId||'dynamic_agent_client',ext_agent_host_id:hostId,response_type:'code',redirect_uri:redirect,scope:SCOPES,resource:API,state,nonce,code_challenge_method:'S256',code_challenge:createHash('sha256').update(verifier).digest('base64url')};
        if(!previous)params.agent_name_hint='QudadFlow Translator';else if(previous.id_token)params.id_token_hint=previous.id_token;
        if(previous?.access_token&&!previous.scopes?.includes('chatgpt.tokens.use.direct'))params.prompt='consent';
        for(const [key,value]of Object.entries(params))url.searchParams.set(key,value);
        Promise.resolve(onAuthorize(url.href)).catch(()=>finish(failure('BROWSER_OPEN_FAILED','无法打开官方登录页面。')));
      });
    });
  }
}
