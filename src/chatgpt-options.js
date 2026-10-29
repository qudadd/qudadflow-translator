/* Account UI is intentionally limited to the trusted settings page. */
(()=>{
  const element=id=>document.getElementById(id);let working=false,hostReady=false,operation=0,accounts=[],probe=null,lastProbe=0,lastAccountError='',explicitNew=false;
  const status=(text,error=false)=>{element('chatgptStatus').textContent=text;element('chatgptStatus').classList.toggle('error',error);};
  const displayError=error=>{const message=error?.message||'账号操作未完成。',code=/^[a-zA-Z0-9_]{1,100}$/.test(error?.code||'')?error.code:'',requestId=/^[a-zA-Z0-9_.-]{1,160}$/.test(error?.upstreamRequestId||'')?error.upstreamRequestId:'';const guidance=code==='3p_delegated_access_policy_denied'?' 官方组织策略拒绝。若管理台未列出 QudadFlow，请停止重复授权；请管理员凭请求 ID 向 OpenAI 核查。':code==='subscription_sharing_user_not_eligible'?' 当前账号或工作区无法使用此接入的计划额度，请勿反复授权；默认机器翻译可免配置使用。':'';return `${message}${code?` 错误码：${code}。`:''}${requestId&&!message.includes(requestId)?` 请求 ID：${requestId}。`:''}${guidance}`;};
  element('chatgptInstallCommand').textContent='powershell -NoProfile -ExecutionPolicy Bypass -File ".\\native-host\\Install-Bridge.ps1" -ExtensionIds '+chrome.runtime.id;
  function controls(){for(const id of ['chatgptLogin','chatgptLogout','chatgptResume','chatgptAccount'])element(id).disabled=working||!hostReady;element('chatgptRefresh').disabled=working;element('chatgptCancel').hidden=!working;}
  function installationState(error){const missing=['HOST_DISCONNECTED','HOST_UNAVAILABLE','HOST_ERROR'].includes(error?.code);if(missing){hostReady=false;controls();void QFConnectorSetup.missing();}return missing;}
  async function call(type,accountRef){const reply=await chrome.runtime.sendMessage({type,accountRef});if(!reply?.ok)throw Object.assign(new Error(reply?.error||'无法连接本地程序。'),{code:reply?.code||'HOST_ERROR',upstreamRequestId:reply?.upstreamRequestId});return reply;}
  function selected(){if(lastAccountError)return status(lastAccountError,true);const a=accounts.find(a=>a.accountRef===element('chatgptAccount').value);if(!a)return status('本地程序已连接。点击 Continue with ChatGPT 添加账号。');status(`${a.label} · 注册 ${a.registration} · ${a.pending?'上次授权未完成；确认错误原因后可重新授权':a.needsLogin?'需要登录':a.paused?'额度限制后已暂停':a.planEnabled?'已授权使用 ChatGPT 计划；尚需测试当前模型':'已登录，尚未授权使用订阅额度'}`);}
  async function refresh(preferred){
    let result;try{result=await call('CHATGPT_STATUS');}catch(error){installationState(error);throw error;}
    hostReady=true;QFConnectorSetup.connected();accounts=result.accounts||[];controls();
    const select=element('chatgptAccount'),has=ref=>accounts.some(a=>a.accountRef===ref);
    const pending=accounts.filter(a=>a.pending);
    const value=has(preferred)?preferred:explicitNew?'':has(select.value)?select.value:has(select.dataset.saved)?select.dataset.saved:pending.length===1?pending[0].accountRef:'';
    select.replaceChildren(new Option('添加账号或工作区并授权…',''),...accounts.map(a=>new Option(`${a.label} · ${a.registration}${a.pending?' · 待完成授权':a.signedIn?'':' · 已退出'}`,a.accountRef)));
    select.value=value;selected();return result;
  }
  function checkConnection(force=false){
    if(working||element('apiStyle').value!=='chatgpt-plan'||document.body.dataset.ready!=='true')return;
    if(probe)return probe;
    if(!force&&Date.now()-lastProbe<3000)return;
    lastProbe=Date.now();probe=refresh().catch(error=>{hostReady=false;controls();lastProbe=0;status(error.message,true);}).finally(()=>{probe=null;QFConnectorSetup.resume();});return probe;
  }
  async function run(type){if(working||!hostReady||element('apiStyle').value!=='chatgpt-plan')return;const current=++operation;lastAccountError='';working=true;controls();status(type==='CHATGPT_LOGIN'?'正在打开官方登录页，请在浏览器完成授权…':'正在处理账号操作…');
    let requestedRef='',priorRefs=new Set();
    try{await probe;if(current!==operation)return;requestedRef=element('chatgptAccount').value;priorRefs=new Set(accounts.map(a=>a.accountRef));const result=await call(type,requestedRef);if(current!==operation)return;await refresh(result.account?.accountRef);if(current!==operation)return;if(result.account){explicitNew=false;element('chatgptAccount').dataset.saved=result.account.accountRef;element('model').value='';resetModelList();updateSaveState();updateVerification();status(result.account.planEnabled?'官方授权完成。请读取模型、测试连接，再保存设置。':'账号已登录，但尚未允许使用订阅额度。');}if(result.warning)status(result.warning,true);}
    catch(error){if(current!==operation)return;installationState(error);if(type==='CHATGPT_LOGIN'&&!requestedRef)try{await refresh();if(current!==operation)return;const pending=accounts.find(a=>a.pending&&!priorRefs.has(a.accountRef));if(pending){explicitNew=false;element('chatgptAccount').value=pending.accountRef;element('chatgptAccount').dataset.saved=pending.accountRef;element('model').value='';resetModelList();updateSaveState();updateVerification();}}catch{}if(['3p_delegated_access_policy_denied','subscription_sharing_user_not_eligible'].includes(error?.code))element('chatgptWorkspaceHelp').open=true;lastAccountError=displayError(error);status(lastAccountError,true);}finally{if(current===operation){working=false;controls();}}
  }
  element('chatgptLogin').onclick=()=>run('CHATGPT_LOGIN');
  element('chatgptLogout').onclick=()=>run('CHATGPT_LOGOUT');
  element('chatgptResume').onclick=()=>run('CHATGPT_RESUME');
  element('chatgptCancel').onclick=()=>call('CHATGPT_CANCEL').catch(error=>status(error.message,true));
  element('chatgptRefresh').onclick=()=>{lastAccountError='';checkConnection(true);};
  element('chatgptAccount').onchange=()=>{lastAccountError='';explicitNew=!element('chatgptAccount').value;element('chatgptAccount').dataset.saved=element('chatgptAccount').value;element('model').value='';resetModelList();updateSaveState();updateVerification();selected();};
  function providerChanged(){if(element('apiStyle').value!=='chatgpt-plan'){QFConnectorSetup.stop();operation++;if(working)void call('CHATGPT_CANCEL').catch(()=>{});working=false;controls();}else checkConnection(true);}
  element('apiStyle').addEventListener('change',providerChanged);
  QFConnectorSetup.init({probe:()=>checkConnection(true),login:()=>run('CHATGPT_LOGIN'),busy:()=>working});
  document.addEventListener('qf-settings-ready',providerChanged);
  window.addEventListener('focus',()=>checkConnection());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkConnection();});
  if(document.body.dataset.ready==='true')checkConnection(true);
  controls();
  window.addEventListener('pagehide',()=>{if(working)chrome.runtime.sendMessage({type:'CHATGPT_CANCEL'}).catch(()=>{});},{once:true});
})();
