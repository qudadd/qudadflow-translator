/* Real Edge extension/UI; the native port and model outputs are synthetic.
   No user browser profile, OAuth credential or live model is used. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||'chatgpt-browser-results.json');
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'qf-chatgpt-browser-')),results=[];let context;
async function check(name,fn){try{await fn();results.push({name,passed:true});console.log('PASS '+name);}catch(e){results.push({name,passed:false,error:e.message});console.error('FAIL '+name+': '+e.message);}}
(async()=>{try{
  context=await chromium.launchPersistentContext(path.join(scratch,'profile'),{channel:'msedge',headless:true,viewport:{width:1280,height:1150},args:['--disable-extensions-except='+root,'--load-extension='+root]});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),base='chrome-extension://'+new URL(worker.url()).host+'/';
  const installerUrl='https://github.com/qudadd/qudadflow-translator/releases/download/v0.9.1/qudadflow-chatgpt-bridge-installer-win-x64-v0.9.1.exe';
  await context.route(installerUrl,route=>route.fulfill({status:200,contentType:'text/plain',body:'Synthetic installer download fixture.'}));
  await worker.evaluate(()=>{
    const account={accountRef:'11111111-2222-4333-8444-555555555555',label:'team-member@example.invalid',registration:'TEST1234',planType:'business',signedIn:true,planEnabled:true};
    const h=globalThis.chatgptHarness={account,accounts:[],mode:'normal',requests:[],cancels:0};
    chrome.runtime.connectNative=()=>{
      const messages=[],disconnects=[],waiting=new Map();
      const send=m=>messages.forEach(f=>f(m));
      return {onMessage:{addListener:f=>messages.push(f)},onDisconnect:{addListener:f=>disconnects.push(f)},disconnect:()=>disconnects.forEach(f=>f()),postMessage:message=>{
        h.requests.push(message);const {id,method,payload}=message;
        if(method==='cancel'){h.cancels++;waiting.delete(id);send({id,ok:false,code:'CANCELLED',error:'操作已取消。'});return;}
        setTimeout(()=>{
          if((method==='login'||method==='generate')&&h.mode==='stall'){waiting.set(id,message);return;}
          let result;
          if(method==='status'){if(h.mode==='unavailable')return send({id,ok:false,code:'HOST_DISCONNECTED',error:'本地连接程序未安装或已断开。'});result={accounts:h.accounts};}
          else if(method==='login'){if(h.mode==='workspace-policy')return send({id,ok:false,code:'3p_delegated_access_policy_denied',error:'当前工作区未允许此应用访问。',upstreamRequestId:'req_synthetic_policy'});if(h.mode==='login-error'){h.accounts=[{...account,label:'授权待完成',pending:true,signedIn:false,planEnabled:false,needsLogin:true}];return send({id,ok:false,code:'invalid_grant',error:'授权码兑换失败。已保留应用注册，请在设置中选择“待完成授权”重新发起授权。',upstreamRequestId:'req_synthetic_login'});}h.accounts=[{...account}];result={account:h.accounts[0]};}
          else if(method==='logout'){h.accounts[0].signedIn=false;h.accounts[0].planEnabled=false;result={signedOut:true};}
          else if(method==='resume')result={resumed:true};
          else if(method==='models')result={models:[{id:'synthetic-text',name:'模拟文本模型',inputModalities:['text'],outputModalities:[],endpoints:['responses']},{id:'synthetic-vision',name:'模拟图像模型',inputModalities:['text','image'],outputModalities:[],endpoints:['responses']}],source:'https://api.openai.com/v1/models'};
          else if(method==='generate'){
            if(!h.accounts[0]?.signedIn)return send({id,ok:false,code:'LOGIN_REQUIRED',error:'请重新登录 ChatGPT。'});
            if(h.mode==='quota')return send({id,ok:false,code:'subscription_sharing_usage_limit_exceeded',error:'ChatGPT 计划额度已达限制。',httpStatus:200,upstreamRequestId:'req_synthetic_quota',param:'',bodyShape:['error']});
            if(h.mode==='ineligible')return send({id,ok:false,code:'subscription_sharing_user_not_eligible',error:'当前账号或工作区未获准使用 ChatGPT 计划额度。',httpStatus:403,upstreamRequestId:'req_synthetic_ineligible',param:'',bodyShape:['error']});
            if(h.mode==='eof'){send({id,event:'delta',text:'部分结果'});return send({id,ok:false,code:'INCOMPLETE_RESPONSE',error:'连接提前结束。'});}
            send({id,event:'delta',text:'这是'});send({id,event:'delta',text:'模拟译文。'});result={completed:true};
          }
          send({id,ok:true,result});
        },20);
      }};
    };
    return chrome.storage.local.set({apiStyle:'openai-compatible',apiKey:'SYNTHETIC_OLD_API_KEY',endpoint:'https://example.invalid/v1',model:'old-api-model',customHeaders:'{}',qfChatgptInstallOffer:'0.9.1'});
  });
  const storeCalls=[],storeInvite=await context.newPage();
  await storeInvite.exposeFunction('qfRecordTab',url=>storeCalls.push(url));
  await storeInvite.addInitScript(()=>{
    const native=window.chrome;
    const runtime=new Proxy(native.runtime,{get(target,key){return key==='id'?'nichpjndbjbcfkcbanfcfogpkdhblghh':Reflect.get(target,key);}});
    const tabs=new Proxy(native.tabs,{get(target,key){return key==='create'?async options=>{await window.qfRecordTab(options.url);return {id:1};}:Reflect.get(target,key);}});
    Object.defineProperty(window,'chrome',{value:new Proxy(native,{get(target,key){return key==='runtime'?runtime:key==='tabs'?tabs:Reflect.get(target,key);}})});
  });
  await storeInvite.goto(base+'popup.html');
  await check('Simulated store-ID offer downloads only after consent and preserves the active API',async()=>{
    await storeInvite.locator('#chatgptInstallOffer').waitFor({state:'visible'});
    assert.equal(await storeInvite.locator('#chatgptInstallGuide').textContent(),'同意并下载');
    assert.match(await storeInvite.locator('#chatgptInstallOffer p').textContent(),/下载完成后还需你打开文件/);
    assert.deepEqual(storeCalls,[]);
    await storeInvite.locator('#chatgptInstallGuide').click();
    await storeInvite.waitForEvent('close');
    assert.deepEqual(storeCalls,[base+'options.html?preview=chatgpt#connectionSettings',installerUrl]);
    assert.equal((await worker.evaluate(()=>chrome.storage.local.get('apiStyle'))).apiStyle,'openai-compatible');
  });
  await worker.evaluate(()=>chrome.storage.local.set({qfChatgptInstallOffer:'0.9.1'}));
  const invite=await context.newPage();await invite.goto(base+'popup.html');
  await check('Sideloaded first-open offer shows the matching development setup and preserves the active API',async()=>{
    await invite.locator('#chatgptInstallOffer').waitFor({state:'visible'});
    assert.match(await invite.locator('#chatgptInstallOffer').textContent(),/默认机器翻译无需/);
    assert.match(await invite.locator('#chatgptInstallOffer').textContent(),/当前是侧载开发版/);
    assert.equal(await invite.locator('#chatgptInstallGuide').textContent(),'查看开发版安装');
    assert.equal((await worker.evaluate(()=>chrome.storage.local.get('qfChatgptInstallOffer'))).qfChatgptInstallOffer,'0.9.1');
    const opened=context.waitForEvent('page');
    await invite.locator('#chatgptInstallGuide').click();
    const setup=await opened;
    assert.match(setup.url(),/preview=chatgpt/);
    await setup.waitForFunction(()=>document.body.dataset.ready==='true');
    assert.equal(await setup.locator('#apiStyle').inputValue(),'chatgpt-plan');
    assert.equal((await worker.evaluate(()=>chrome.storage.local.get('apiStyle'))).apiStyle,'openai-compatible');
    assert.equal(invite.isClosed(),true);
    assert.ok(fs.readFileSync(path.join(root,'popup.js'),'utf8').includes(installerUrl));
    assert.equal((await worker.evaluate(()=>chrome.storage.local.get('qfChatgptInstallOffer'))).qfChatgptInstallOffer,undefined);
    await setup.close();
  });
  await worker.evaluate(()=>chrome.storage.local.set({qfChatgptInstallOffer:'0.9.1'}));
  const later=await context.newPage();await later.goto(base+'popup.html');
  await check('Declining the bridge offer closes it without changing translation settings',async()=>{
    await later.locator('#chatgptInstallOffer').waitFor({state:'visible'});
    await later.locator('#chatgptInstallLater').click();
    assert.equal(await later.locator('#chatgptInstallOffer').isVisible(),false);
    assert.equal((await worker.evaluate(()=>chrome.storage.local.get('apiStyle'))).apiStyle,'openai-compatible');
  });
  await later.close();
  const page=await context.newPage();page.setDefaultTimeout(9000);await page.goto(base+'options.html');await page.waitForFunction(()=>document.body.dataset.ready==='true');await page.locator('#expandSettings').click();
  const invoke=m=>page.evaluate(m=>chrome.runtime.sendMessage(m),m),get=()=>worker.evaluate(()=>chrome.storage.local.get(null));
  await check('Selecting subscription mode detects the bridge without an extra click',async()=>{await page.locator('#apiStyle').selectOption('chatgpt-plan');await page.waitForFunction(()=>document.querySelector('#chatgptStatus').textContent.includes('已连接'));assert.equal(await page.locator('#chatgptSetup').isVisible(),false);assert.equal(await page.locator('#apiKeyWrap').isVisible(),false);assert.equal(await page.locator('#endpointWrap').isVisible(),false);assert.equal(await page.locator('#temperature').isDisabled(),true);await page.locator('#fetchModels').click();assert.match(await page.locator('#modelStatus').textContent(),/请先登录/);});
  await check('Missing bridge shows the matching sideload command until automatic recheck succeeds',async()=>{await worker.evaluate(()=>chatgptHarness.mode='unavailable');await page.locator('#chatgptRefresh').click();await page.locator('#chatgptSetup:not([hidden])').waitFor();assert.equal(await page.locator('#chatgptSetup').evaluate(node=>node.open),true);assert.equal(await page.locator('#chatgptSetup > p').first().isVisible(),false);assert.match(await page.locator('#chatgptSetup > p a').first().getAttribute('href'),/qudadflow-chatgpt-bridge-installer-win-x64-v0\.9\.1\.exe$/);assert.equal(await page.locator('#chatgptSetup > details').evaluate(node=>node.open),true);assert.match(await page.locator('#chatgptSetup > details').textContent(),/商店版安装器不注册此侧载 ID/);assert.match(await page.locator('#chatgptInstallCommand').textContent(),new RegExp(new URL(base).host));await worker.evaluate(()=>chatgptHarness.mode='normal');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.locator('#chatgptSetup').waitFor({state:'hidden'});});
  await check('Team eligibility warning is visible before authorization',async()=>{const notice=page.locator('#chatgptEligibilityNotice');assert.equal(await notice.isVisible(),true);assert.match(await notice.textContent(),/Plus \/ Pro/);assert.match(await notice.textContent(),/Team \/ Business/);assert.match(await notice.textContent(),/默认机器翻译/);const bounds=await Promise.all([notice.boundingBox(),page.locator('#chatgptLogin').boundingBox()]);assert.ok(bounds[0].y+bounds[0].height<=bounds[1].y);});
  await check('Workspace policy denial guides non-admin members without changing the active translator',async()=>{await worker.evaluate(()=>chatgptHarness.mode='workspace-policy');await page.locator('#chatgptLogin').click();await page.waitForFunction(()=>document.querySelector('#chatgptStatus').textContent.includes('3p_delegated_access_policy_denied'));const message=await page.locator('#chatgptStatus').textContent();assert.match(message,/req_synthetic_policy/);assert.match(message,/停止重复授权/);assert.equal(await page.locator('#chatgptWorkspaceHelp').evaluate(node=>node.open),true);assert.match(await page.locator('#chatgptWorkspaceHelp').textContent(),/若 QudadFlow 不在应用列表/);assert.equal((await get()).apiStyle,'openai-compatible');assert.equal(await worker.evaluate(()=>chatgptHarness.accounts.length),0);await worker.evaluate(()=>chatgptHarness.mode='normal');});
  await check('Invalid grant selects the pending registration and survives automatic refresh',async()=>{await worker.evaluate(()=>chatgptHarness.mode='login-error');await page.locator('#chatgptLogin').click();await page.waitForFunction(()=>document.querySelector('#chatgptStatus').textContent.includes('invalid_grant'));await page.evaluate(()=>document.dispatchEvent(new Event('qf-settings-ready')));await page.waitForTimeout(100);const message=await page.locator('#chatgptStatus').textContent();assert.match(message,/invalid_grant/);assert.match(message,/req_synthetic_login/);assert.equal(await page.locator('#chatgptAccount').inputValue(),'11111111-2222-4333-8444-555555555555');assert.match(await page.locator('#chatgptAccount option:checked').textContent(),/待完成授权/);await worker.evaluate(()=>chatgptHarness.mode='normal');});
  await check('Reopening Settings keeps the single pending registration on repeated failure',async()=>{
    await page.reload();await page.waitForFunction(()=>document.body.dataset.ready==='true');
    await page.locator('#expandSettings').click();await page.locator('#apiStyle').selectOption('chatgpt-plan');
    await page.waitForFunction(()=>document.querySelector('#chatgptAccount').value==='11111111-2222-4333-8444-555555555555');
    assert.match(await page.locator('#chatgptAccount option:checked').textContent(),/待完成授权/);
    await page.locator('#chatgptAccount').selectOption('');await page.locator('#chatgptRefresh').click();
    assert.equal(await page.locator('#chatgptAccount').inputValue(),'','an explicit choice to add an account remains available');
    await page.locator('#chatgptAccount').selectOption('11111111-2222-4333-8444-555555555555');
    await worker.evaluate(()=>chatgptHarness.mode='login-error');await page.locator('#chatgptLogin').click();
    await page.waitForFunction(()=>document.querySelector('#chatgptStatus').textContent.includes('invalid_grant'));
    const retry=await worker.evaluate(()=>chatgptHarness.requests.filter(r=>r.method==='login').at(-1));
    assert.equal(retry.payload.accountRef,'11111111-2222-4333-8444-555555555555');
    await worker.evaluate(()=>chatgptHarness.mode='normal');
  });
  await check('Retry uses pending registration without applying draft or storing tokens',async()=>{await page.locator('#chatgptLogin').click();await page.waitForFunction(()=>document.querySelector('#chatgptStatus').textContent.includes('官方授权完成'));assert.equal(await page.locator('#chatgptAccount').inputValue(),'11111111-2222-4333-8444-555555555555');const login=await worker.evaluate(()=>chatgptHarness.requests.filter(r=>r.method==='login').at(-1));assert.equal(login.payload.accountRef,'11111111-2222-4333-8444-555555555555');assert.equal((await get()).apiStyle,'openai-compatible');});
  await check('A synthetically approved Team member has no local plan-tier block',async()=>{assert.match(await page.locator('#chatgptAccount option:checked').textContent(),/team-member@example\.invalid/);assert.equal(await worker.evaluate(()=>chatgptHarness.accounts[0].planType),'business');assert.match(await page.locator('#chatgptStatus').textContent(),/官方授权完成/);});
  await check('Model picker requires a manual choice and keeps models with undeclared output selectable',async()=>{await page.locator('#fetchModels').click();await page.locator('#modelBrowser:not([hidden])').waitFor();assert.deepEqual(await page.locator('#modelCandidates option').allTextContents(),['模拟文本模型','模拟图像模型']);assert.equal(await page.locator('#modelCandidates').evaluate(node=>node.selectedIndex),-1);assert.equal(await page.locator('#applyModel').isDisabled(),true);await page.locator('#modelFilter').selectOption('text');assert.equal(await page.locator('#modelCandidates option').count(),2);assert.equal(await page.locator('#modelCandidates').evaluate(node=>node.selectedIndex),-1);await page.locator('#modelCandidates option').first().click();assert.equal(await page.locator('#applyModel').isDisabled(),false);await page.locator('#applyModel').click();assert.equal(await page.locator('#model').inputValue(),'synthetic-text');});
  await check('Draft text test uses native stream and retains existing active API',async()=>{await page.locator('#testApi').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('连接成功'));assert.match(await page.locator('#status').textContent(),/这是模拟译文/);assert.equal((await get()).apiKey,'SYNTHETIC_OLD_API_KEY');const sent=await worker.evaluate(()=>chatgptHarness.requests.filter(r=>r.method==='generate').at(-1));assert.equal(sent.payload.accountRef,'11111111-2222-4333-8444-555555555555');assert.match(sent.payload.instructions,/translation engine/);assert.equal(sent.payload.apiKey,undefined);});
  await check('Team plan ineligibility opens guidance and does not switch billing',async()=>{await worker.evaluate(()=>chatgptHarness.mode='ineligible');const before=await worker.evaluate(()=>chatgptHarness.requests.filter(r=>r.method==='generate').length);await page.locator('#testApi').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('subscription_sharing_user_not_eligible'));assert.match(await page.locator('#status').textContent(),/req_synthetic_ineligible/);assert.match(await page.locator('#status').textContent(),/请勿重复授权/);assert.equal(await page.locator('#chatgptWorkspaceHelp').evaluate(node=>node.open),true);assert.equal((await get()).apiStyle,'openai-compatible');assert.equal(await worker.evaluate(()=>chatgptHarness.requests.filter(r=>r.method==='generate').length),before+1);await worker.evaluate(()=>chatgptHarness.mode='normal');});
  await check('Saving subscription strips API secrets and preserves original profile',async()=>{await page.locator('#profileName').fill('ChatGPT 测试');await page.locator('#saveAsProfile').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('已保存'));const s=await get();assert.equal(s.apiStyle,'chatgpt-plan');assert.equal(s.apiKey,'');assert.equal(s.customHeaders,'{}');assert.ok(s.savedProfiles.some(p=>p.values.apiKey==='SYNTHETIC_OLD_API_KEY'));assert.ok(!/access_token|refresh_token|id_token/.test(JSON.stringify(s)));});
  const popup=await context.newPage();await popup.goto(base+'popup.html');
  await check('Reading-page model selection stays within the active account',async()=>{await popup.waitForFunction(()=>document.querySelector('#activeModel')?.options.length>=2);assert.ok((await popup.locator('#activeModel option').allTextContents()).some(t=>t.includes('模拟图像模型')));await popup.locator('#activeModel').selectOption('synthetic-vision');await page.waitForFunction(async()=>(await chrome.storage.local.get('model')).model==='synthetic-vision');const s=await get();assert.equal(s.chatgptAccount,'11111111-2222-4333-8444-555555555555');});
  await check('Account operations are denied outside settings',async()=>{const denied=await popup.evaluate(()=>chrome.runtime.sendMessage({type:'CHATGPT_LOGIN'}));assert.equal(denied.ok,false);assert.match(denied.error,/仅限/);});
  await check('Quota and interrupted stream propagate errors without successful partial text',async()=>{for(const [mode,code]of [['quota','subscription_sharing_usage_limit_exceeded'],['eof','INCOMPLETE_RESPONSE']]){await worker.evaluate(mode=>chatgptHarness.mode=mode,mode);const result=await invoke({type:'TRANSLATE_TEXT',text:'Synthetic source.'});assert.equal(result.ok,false);assert.equal(result.code,code);assert.equal(result.translation,undefined);if(mode==='quota'){assert.equal(result.httpStatus,200);assert.equal(result.upstreamRequestId,'req_synthetic_quota');assert.deepEqual(result.bodyShape,['error']);}}await worker.evaluate(()=>chatgptHarness.mode='normal');});
  await check('Cancel login stops pending native request and unlocks controls',async()=>{await worker.evaluate(()=>chatgptHarness.mode='stall');await page.locator('#chatgptLogin').click();await page.locator('#chatgptCancel').click();await page.waitForFunction(()=>!document.querySelector('#chatgptLogin').disabled);assert.match(await page.locator('#chatgptStatus').textContent(),/取消/);assert.ok(await worker.evaluate(()=>chatgptHarness.cancels>0));await worker.evaluate(()=>chatgptHarness.mode='normal');});
  await check('Desktop and narrow layouts keep account actions inside viewport',async()=>{fs.mkdirSync(path.dirname(out),{recursive:true});const shot=name=>path.join(path.dirname(out),path.parse(out).name+'-'+name+'.png');await page.locator('#connectionSettings').scrollIntoViewIfNeeded();await page.screenshot({path:shot('desktop')});await page.setViewportSize({width:420,height:960});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));await page.locator('#chatgptConnection').scrollIntoViewIfNeeded();await page.screenshot({path:shot('narrow')});await page.setViewportSize({width:1280,height:1150});});
  await check('Logout clears authorization and requires login for subsequent generation',async()=>{await page.locator('#chatgptLogout').click();await page.waitForFunction(()=>!document.querySelector('#chatgptLogout').disabled);const result=await invoke({type:'TRANSLATE_TEXT',text:'Synthetic source after logout.'});assert.equal(result.code,'LOGIN_REQUIRED');});
  await check('Switching back to saved API preserves the original key and model',async()=>{await page.reload();await page.waitForFunction(()=>document.body.dataset.ready==='true');await page.locator('#expandSettings').click();const old=(await get()).savedProfiles.find(p=>p.values.apiKey==='SYNTHETIC_OLD_API_KEY');await page.locator('#savedProfile').selectOption(old.id);assert.equal(await page.locator('#apiKey').inputValue(),'SYNTHETIC_OLD_API_KEY');assert.equal(await page.locator('#model').inputValue(),'old-api-model');assert.equal(await page.locator('#chatgptConnection').isVisible(),false);});
}catch(e){results.push({name:'setup',passed:false,error:e.stack});console.error(e);}
finally{await context?.close();if(!scratch.startsWith(os.tmpdir()+path.sep+'qf-chatgpt-browser-'))throw new Error('Unsafe cleanup');fs.rmSync(scratch,{recursive:true,force:true,maxRetries:5,retryDelay:200});const report={scope:'Real isolated Edge with a simulated store ID for the consent branch, synthetic native host and model responses. No live OAuth or provider quality tested.',passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results};fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failed:report.failed}));if(report.failed)process.exitCode=1;}})();
