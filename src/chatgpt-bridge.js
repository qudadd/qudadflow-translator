/* Credentials and OAuth exchanges stay in the local native host. */
const QFChatGPT = (()=>{
  let port,disconnectTimer;const pending=new Map();
  const fail=(code,message,details={})=>Object.assign(new Error(message),{code,...details});
  function connect(){
    clearTimeout(disconnectTimer);if(port)return port;
    const current=chrome.runtime.connectNative('com.qudadflow.chatgpt');port=current;
    current.onMessage.addListener(message=>{
      const job=pending.get(message?.id);if(!job)return;
      if(message.event==='authorize'){
        try{const url=new URL(message.url);if(url.origin!=='https://auth.openai.com'||url.pathname!=='/api/accounts/authorize')throw new Error();chrome.tabs.create({url:url.href,active:true}).catch(()=>job.controller?.abort());}
        catch{job.reject(fail('INVALID_AUTH_URL','本地程序返回了无效的官方登录地址。'));finish(message.id);}return;
      }
      if(message.event==='delta'){if(typeof message.text==='string'){job.text+=message.text;if(job.text.length>2*1024*1024){job.abort();return;}job.progress?.(job.text);}return;}
      if(message.ok)job.resolve(job.method==='generate'?{translation:job.text,...message.result}:message.result);
      else job.reject(fail(message.code||'HOST_ERROR',message.error||'本地连接失败。',{httpStatus:message.httpStatus,upstreamRequestId:message.upstreamRequestId,param:message.param,bodyShape:message.bodyShape}));
      finish(message.id);
    });
    current.onDisconnect.addListener(()=>{void chrome.runtime.lastError;if(port!==current)return;port=null;for(const [id,job]of pending){job.reject(fail('HOST_DISCONNECTED','本地连接程序未安装或已断开。请查看设置中的安装说明；返回设置页时会自动检测。'));finish(id);}});
    return current;
  }
  function finish(id){const job=pending.get(id);if(!job)return;clearTimeout(job.timer);job.signal?.removeEventListener('abort',job.abort);pending.delete(id);if(!pending.size)disconnectTimer=setTimeout(()=>{const p=port;port=null;p?.disconnect();},3000);}
  function request(method,payload={},controller=new AbortController(),progress){
    const signal=controller.signal;if(signal.aborted)return Promise.reject(fail('CANCELLED','操作已取消。'));
    return new Promise((resolve,reject)=>{
      const id=crypto.randomUUID();
      const abort=()=>{try{port?.postMessage({id,method:'cancel'});}catch{}reject(fail('CANCELLED','操作已取消。'));finish(id);};
      const job={method,resolve,reject,controller,signal,abort,progress,text:''};pending.set(id,job);signal.addEventListener('abort',abort,{once:true});
      if(method!=='generate'&&method!=='login')job.timer=setTimeout(()=>{abort();},45000);
      try{connect().postMessage({id,method,payload});}catch{reject(fail('HOST_UNAVAILABLE','无法启动本地连接程序。请查看设置中的安装说明；安装后返回页面会自动检测。'));finish(id);}
    });
  }
  const settingsJobs=new Map();
  function settings(message,sender){
    const owner=sender.tab?.id??'settings';
    if(message.type==='CHATGPT_CANCEL'){settingsJobs.get(owner)?.abort();return Promise.resolve({cancelled:true});}
    const methods={CHATGPT_STATUS:'status',CHATGPT_LOGIN:'login',CHATGPT_LOGOUT:'logout',CHATGPT_RESUME:'resume'};
    const method=methods[message.type];if(!method)return Promise.reject(fail('INVALID_METHOD','不支持的账号操作。'));
    if(method==='status')return request(method);
    settingsJobs.get(owner)?.abort();const controller=new AbortController();settingsJobs.set(owner,controller);
    return request(method,{accountRef:message.accountRef||''},controller).finally(()=>{if(settingsJobs.get(owner)===controller)settingsJobs.delete(owner);});
  }
  chrome.tabs.onRemoved?.addListener(id=>{settingsJobs.get(id)?.abort();settingsJobs.delete(id);});
  return {request,settings};
})();
