/* Persistent profile and basic-provider checks. No personal browser profile or API key is read. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),reportPath=path.resolve(process.argv[2]||'configuration-results.json');
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'qudadflow-config-')),results=[],calls=[];let mode='normal',context;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function check(name,fn){try{await fn();results.push({name,passed:true});console.log('PASS '+name);}catch(error){results.push({name,passed:false,error:error.message});console.log('FAIL '+name+': '+error.message);}}
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://local');
  if(url.pathname==='/get'){
    calls.push({text:url.searchParams.get('q'),language:url.searchParams.get('langpair'),headers:req.headers,url:url.href,startedAt:Date.now(),aborted:false});const record=calls.at(-1);res.on('finish',()=>{record.endedAt=Date.now();});res.on('close',()=>{record.aborted=!res.writableEnded;});
    if(mode==='stall')return;
    if(mode==='delayed')await delay(120);
    res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(mode==='quota'?{responseStatus:403,quotaFinished:true}:{responseStatus:200,responseData:{translatedText:'译文 '+url.searchParams.get('q').replace(/Hello world/g,'你好，世界')+' &amp;'}}));
  }
  res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Config test</title><main><p>Hello world</p><p>Second paragraph</p></main>');
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;let browserVersion;
  try{
    const extension=path.join(scratch,'extension');fs.mkdirSync(extension);
    for(const file of ['manifest.json','offscreen-translation.html','research.html','research.css','research.js','popup.html','popup.css','popup.js','options.html','options.css','options.js','privacy.html','src','assets','_locales'])fs.cpSync(path.join(root,file),path.join(extension,file),{recursive:true});
    const manifest=JSON.parse(fs.readFileSync(path.join(extension,'manifest.json'),'utf8'));manifest.host_permissions=['http://127.0.0.1/*','https://api.mymemory.translated.net/*'];fs.writeFileSync(path.join(extension,'manifest.json'),JSON.stringify(manifest));
    context=await chromium.launchPersistentContext(path.join(scratch,'profile'),{channel:process.env.QF_BROWSER_CHANNEL||'msedge',headless:true,viewport:{width:1180,height:1200},args:['--disable-extensions-except='+extension,'--load-extension='+extension]});browserVersion=context.browser().version();
    const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host,base='chrome-extension://'+id+'/';
    const initial={apiStyle:'openai-compatible',apiKey:'SYNTHETIC-ORIGINAL-KEY',endpoint:origin+'/v1',model:'original-model',targetLanguage:'zh-CN'};
    await worker.evaluate(settings=>chrome.storage.local.set(settings),initial);
    const page=await context.newPage();page.setDefaultTimeout(8000);await page.goto(base+'options.html');await page.waitForFunction(()=>document.body.dataset.ready==='true');await page.locator('#expandSettings').click();
    const get=()=>worker.evaluate(()=>chrome.storage.local.get(null));
    const action=message=>page.evaluate(message=>chrome.runtime.sendMessage(message),message);
    async function save(name,{copy=false}={}){await page.locator('#profileName').fill(name);await page.locator(copy?'#saveAsProfile':'button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('已保存'));}
    await check('Settings: provider, saved plans, language and save actions share one section',async()=>{
      const layout=await page.evaluate(()=>({
        sections:[...document.querySelectorAll('.settings-section')].map(e=>e.id),
        navigation:[...document.querySelectorAll('.settings-nav nav a')].map(e=>e.hash),
        controls:['savedProfile','apiStyle','profileName','sourceLanguage','targetLanguage','temperature','testApi','saveState','status'].every(id=>document.getElementById(id)?.closest('#connectionSettings'))
      }));
      assert.deepEqual(layout.sections,['connectionSettings','translationSettings','researchSettings','communitySupport']);
      assert.deepEqual(layout.navigation,['#connectionSettings','#translationSettings','#researchSettings','#communitySupport']);
      assert.equal(layout.controls,true);
      assert.equal(await page.locator('.actions').count(),0);
      assert.equal(await page.locator('#connectionSettings > :last-child').getAttribute('class'),'connection-actions');
      assert.equal(await page.locator('#testApi').isVisible(),true);
      assert.equal(await page.locator('#connectionSettings button[type=submit]').isVisible(),true);
      fs.mkdirSync(path.dirname(reportPath),{recursive:true});
      await page.locator('#connectionSettings').screenshot({path:path.join(path.dirname(reportPath),'settings-combined-desktop.png')});
      await page.setViewportSize({width:420,height:960});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
      await page.locator('#connectionSettings').screenshot({path:path.join(path.dirname(reportPath),'settings-combined-narrow.png')});
      await page.setViewportSize({width:1180,height:1200});
    });
    await check('Optional local model download requires a settings-page click and preserves the saved connection',async()=>{
      const saved=await get();
      await page.locator('#apiStyle').selectOption('auto-machine');
      await page.evaluate(()=>{
        window.localModelHarness={descriptor:Object.getOwnPropertyDescriptor(globalThis,'Translator'),calls:[]};
        Object.defineProperty(globalThis,'Translator',{configurable:true,value:{create(options){
          localModelHarness.calls.push({source:options.sourceLanguage,target:options.targetLanguage,active:navigator.userActivation.isActive});
          options.monitor?.({addEventListener(){}});
          return Promise.resolve({destroy(){}});
        }}});
        renderApiStyle();
      });
      try{
        await page.locator('#prepareLocalModel').click();
        await page.waitForFunction(()=>document.querySelector('#localModelStatus').textContent.includes('已准备好'));
        const calls=await page.evaluate(()=>localModelHarness.calls);
        assert.deepEqual(calls.map(({source,target})=>({source,target})),[{source:'en',target:'zh'}]);
        assert.equal(calls[0].active,true);
        assert.deepEqual(await get(),saved);
      }finally{
        await page.evaluate(()=>{
          const descriptor=localModelHarness.descriptor;
          if(descriptor)Object.defineProperty(globalThis,'Translator',descriptor);else delete globalThis.Translator;
          delete window.localModelHarness;renderApiStyle();
        });
        await page.reload();await page.waitForFunction(()=>document.body.dataset.ready==='true');await page.locator('#expandSettings').click();
      }
    });
    await check('Website permission UI: optional one-click grant requires activation, denial preserves settings, and revoke clears grants',async()=>{
      const saved=await get();
      await page.evaluate(()=>{
        window.permissionHarness={granted:false,allow:false,requests:[],removals:[],originals:{}};
        const h=window.permissionHarness,p=chrome.permissions;
        for(const name of ['contains','request','getAll','remove'])h.originals[name]=p[name];
        p.contains=(args,callback)=>{if(args.origins?.includes('https://*/*')){callback(h.granted);return;}return h.originals.contains(args,callback);};
        p.request=(args,callback)=>{h.requests.push({...args,active:navigator.userActivation.isActive});h.granted=h.allow;callback(h.granted);};
        p.getAll=async()=>({origins:h.granted?['https://*/*','http://*/*','https://papers.example/*']:[]});
        p.remove=async args=>{h.removals.push(args);h.granted=false;return true;};
      });
      try{
        assert.equal(await page.locator('#grantAllWebsites').isVisible(),true);
        await page.locator('#grantAllWebsites').click();await page.waitForFunction(()=>document.querySelector('#websitePermissionStatus').textContent.includes('未授予'));
        assert.deepEqual(await get(),saved);assert.equal(await page.locator('#revokeAllWebsites').isVisible(),false);
        await page.evaluate(()=>window.permissionHarness.allow=true);await page.locator('#grantAllWebsites').click();await page.waitForFunction(()=>document.querySelector('#websitePermissionStatus').textContent.includes('已持久授权'));
        assert.equal(await page.locator('#grantAllWebsites').isVisible(),false);assert.equal(await page.locator('#revokeAllWebsites').isVisible(),true);
        const granted=await page.evaluate(()=>window.permissionHarness.requests);assert.equal(granted.length,2);assert.ok(granted.every(r=>r.active));assert.deepEqual(granted[1].origins,['https://*/*','http://*/*']);assert.deepEqual(await get(),saved);
        await page.locator('#revokeAllWebsites').click();await page.waitForFunction(()=>document.querySelector('#websitePermissionStatus').textContent.includes('当前按站点'));
        assert.equal(await page.locator('#grantAllWebsites').isVisible(),true);const removed=await page.evaluate(()=>window.permissionHarness.removals);assert.equal(removed.length,1);assert.ok(removed[0].origins.includes('https://papers.example/*'));assert.deepEqual(await get(),saved);
      }finally{await page.evaluate(()=>{for(const [name,fn]of Object.entries(window.permissionHarness.originals))chrome.permissions[name]=fn;});await page.reload();await page.waitForFunction(()=>document.body.dataset.ready==='true');await page.locator('#expandSettings').click();}
    });
    await check('Compact site prompt: denied retry, immediate grant hiding, persisted suppression, revoked-site reminder and protected-page suppression',async()=>{
      const saved=await get(),before=calls.length,site=await context.newPage(),popup=await context.newPage();
      await site.goto(origin+'/first-use?private=SYNTHETIC');
      const tab=await worker.evaluate(async url=>(await chrome.tabs.query({})).find(t=>t.url===url),site.url());
      await popup.addInitScript(tab=>{
        const query=chrome.tabs.query.bind(chrome.tabs),getTab=chrome.tabs.get.bind(chrome.tabs);
        chrome.tabs.query=args=>args.active?Promise.resolve([tab]):query(args);
        const h=window.sitePermissionHarness={granted:sessionStorage.getItem('qf-test-site-granted')==='true',allow:false,requests:[],added:[],removed:[]};
        chrome.permissions.contains=async()=>h.holdPermissionCheck?new Promise(resolve=>{h.releasePermissionCheck=resolve;}):h.granted;
        chrome.permissions.request=async args=>{
          h.requests.push({...args,active:navigator.userActivation.isActive});
          if(h.holdRequest)await new Promise(resolve=>{h.releaseRequest=resolve;});
          h.granted=h.allow;sessionStorage.setItem('qf-test-site-granted',String(h.granted));return h.granted;
        };
        chrome.permissions.onAdded.addListener=listener=>h.added.push(listener);
        chrome.permissions.onRemoved.addListener=listener=>h.removed.push(listener);
        chrome.tabs.get=async id=>{if(h.holdTab){h.tabWaiting=true;await new Promise(resolve=>{h.releaseTab=resolve;});}return getTab(id);};
      },tab);
      try{
        await popup.goto(base+'popup.html');await popup.locator('#authorizeCurrentSite:not([disabled])').waitFor();
        assert.equal(await popup.locator('#siteAuthorization').isVisible(),true);assert.match(await popup.locator('#siteAuthorizationHint').textContent(),/127\.0\.0\.1/);
        assert.doesNotMatch(await popup.locator('#siteAuthorization').textContent(),/private=|SYNTHETIC|ORIGINAL-KEY/);
        assert.equal(await popup.evaluate(()=>window.sitePermissionHarness.requests.length),0);
        assert.equal(await popup.locator('#siteAuthorizationDetails').evaluate(e=>e.open),false);
        assert.ok(await popup.locator('#siteAuthorization').evaluate(e=>e.getBoundingClientRect().height)<=110);
        await popup.locator('.popup').screenshot({path:path.join(path.dirname(reportPath),'qudadflow-site-authorization-v'+manifest.version+'.png')});
        await popup.locator('#authorizeCurrentSite').click();await popup.waitForFunction(()=>document.querySelector('#status').textContent.includes('未授予'));
        assert.equal(await popup.locator('#siteAuthorization').isVisible(),true);assert.equal(await popup.locator('#authorizeCurrentSite').isEnabled(),true);assert.deepEqual(await get(),saved);
        assert.match(await popup.locator('#siteAuthorizationHint').textContent(),/未授权，可重试/);
        await popup.locator('#siteAuthorizationDetails summary').click();
        await popup.evaluate(()=>Object.assign(window.sitePermissionHarness,{allow:true,holdRequest:true,holdTab:true}));
        await popup.locator('#authorizeCurrentSite').click();await popup.waitForFunction(()=>window.sitePermissionHarness.releaseRequest);
        await popup.evaluate(()=>{window.sitePermissionHarness.holdPermissionCheck=true;window.pendingSiteRecheck=updateSiteAuthorization();});
        await popup.evaluate(()=>window.sitePermissionHarness.releaseRequest());
        await popup.waitForFunction(()=>window.sitePermissionHarness.tabWaiting);
        assert.equal(await popup.locator('#siteAuthorization').isHidden(),true);
        assert.equal(await popup.locator('#siteAuthorization').evaluate(e=>e.getBoundingClientRect().height),0);
        assert.equal(await popup.locator('#siteAuthorizationDetails').evaluate(e=>e.open),false);
        await popup.evaluate(async()=>{const h=window.sitePermissionHarness;h.holdPermissionCheck=false;h.releasePermissionCheck(false);await window.pendingSiteRecheck;});
        assert.equal(await popup.locator('#siteAuthorization').isHidden(),true);
        await popup.evaluate(()=>{const h=window.sitePermissionHarness;h.holdTab=false;h.releaseTab();});
        await popup.waitForFunction(()=>!authorizingSite);
        const requests=await popup.evaluate(()=>window.sitePermissionHarness.requests);assert.equal(requests.length,2);assert.ok(requests.every(r=>r.active));assert.deepEqual(requests[1].origins,['http://127.0.0.1/*']);
        assert.equal(await popup.locator('#selectionEnabled').isChecked(),false);assert.deepEqual(await get(),saved);assert.equal(calls.length,before);
        await popup.reload();await popup.waitForFunction(()=>siteAuthorizationTarget&&!document.querySelector('#selectionEnabled').disabled);
        assert.equal(await popup.evaluate(()=>window.sitePermissionHarness.granted),true);
        assert.equal(await popup.locator('#siteAuthorization').isHidden(),true);
        assert.equal(await popup.locator('#siteAuthorization').evaluate(e=>e.getBoundingClientRect().height),0);
        assert.equal(await popup.evaluate(()=>window.sitePermissionHarness.requests.length),0);
        await popup.locator('.popup').screenshot({path:path.join(path.dirname(reportPath),'qudadflow-site-authorized-v'+manifest.version+'.png')});
        await popup.evaluate(async()=>{const h=window.sitePermissionHarness;h.granted=false;sessionStorage.setItem('qf-test-site-granted','false');await Promise.all(h.removed.map(listener=>listener({origins:['http://127.0.0.1/*']})));});
        assert.equal(await popup.locator('#siteAuthorization').isVisible(),true);
        assert.equal(await popup.locator('#authorizeCurrentSite').isEnabled(),true);
        assert.equal(await popup.locator('#siteAuthorizationDetails').evaluate(e=>e.open),false);
        assert.equal(await popup.evaluate(()=>window.sitePermissionHarness.requests.length),0);
        for(const url of ['edge://settings/','chrome-extension://example/options.html','https://chromewebstore.google.com/detail/test','https://microsoftedge.microsoft.com/addons/detail/test']){
          await popup.evaluate(async url=>{activeTab={id:1,url};await updateSiteAuthorization();},url);
          assert.equal(await popup.locator('#siteAuthorization').isHidden(),true);
          assert.equal(await popup.locator('#siteAuthorization').evaluate(e=>e.getBoundingClientRect().height),0);
        }
        assert.equal(await popup.evaluate(()=>window.sitePermissionHarness.requests.length),0);
        assert.deepEqual(await get(),saved);assert.equal(calls.length,before);
      }finally{await popup.close();await site.close();}
    });
    await check('Profiles: existing settings migrate without losing endpoint or key',async()=>{const state=await get();assert.equal(state.savedProfiles.length,1);assert.equal(state.savedProfiles[0].values.apiKey,initial.apiKey);assert.equal(state.endpoint,initial.endpoint);assert.equal(await page.locator('#apiKey').getAttribute('type'),'password');});
    await check('Profiles: save a named copy and retain original configuration',async()=>{await page.locator('#model').fill('second-model');await page.locator('#apiKey').fill('SYNTHETIC-SECOND-KEY');await save('Research API',{copy:true});const state=await get();assert.equal(state.savedProfiles.length,2);assert.equal(state.savedProfiles[0].values.apiKey,initial.apiKey);assert.equal(state.apiKey,'SYNTHETIC-SECOND-KEY');});
    await check('Profiles: reload, select, edit and apply a saved scheme',async()=>{await page.reload();await page.waitForFunction(()=>document.body.dataset.ready==='true');await page.locator('#expandSettings').click();const first=(await get()).savedProfiles[0].id;await page.locator('#savedProfile').selectOption(first);assert.equal(await page.locator('#model').inputValue(),'original-model');assert.equal((await get()).model,'second-model');await page.locator('#model').fill('edited-original');await save('Daily reading');const state=await get();assert.equal(state.savedProfiles.length,2);assert.equal(state.model,'edited-original');assert.equal(state.savedProfiles[0].name,'Daily reading');});
    await check('Profiles: metadata list never returns credentials',async()=>{const result=await action({type:'PROFILE_LIST'});assert.ok(!JSON.stringify(result).includes('SYNTHETIC'));assert.ok(result.profiles.every(profile=>!profile.values));});
    await check('Profiles: stale settings tab cannot overwrite newer saved profiles',async()=>{const state=await get();const response=await action({type:'PROFILE_SAVE',revision:state.profileRevision-1,profileId:state.savedProfiles[0].id,name:'stale',values:initial});assert.equal(response.ok,false);assert.match(response.error,/其他窗口/);assert.equal((await get()).savedProfiles[0].name,'Daily reading');});
    await check('Profiles: popup exposes only models and cannot apply another API scheme',async()=>{const popup=await context.newPage();await popup.goto(base+'popup.html');await popup.locator('#activeModel').waitFor();assert.equal(await popup.locator('#activeProfile').count(),0);const before=await get();const denied=await popup.evaluate(profileId=>chrome.runtime.sendMessage({type:'PROFILE_APPLY',profileId}),before.savedProfiles[1].id);assert.equal(denied.ok,false);assert.deepEqual(await get(),before);await popup.close();});
    await check('Profiles: quick trial preserves both saved keyed configurations',async()=>{await page.reload();await page.waitForFunction(()=>document.body.dataset.ready==='true');await page.locator('#expandSettings').click();await page.locator('#useTrial').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('基础试用已启用'));const state=await get();assert.equal(state.apiStyle,'mymemory');assert.equal(state.apiKey,'');assert.equal(state.sourceLanguage,'en');assert.equal(state.savedProfiles.length,3);assert.equal(state.savedProfiles[0].values.apiKey,initial.apiKey);assert.equal(state.customHeaders,'{}');assert.equal(await page.locator('#apiKeyWrap').isVisible(),false);});
    await check('Profiles: repeated trial activation does not duplicate the preset',async()=>{await page.locator('#useTrial').click();await page.waitForFunction(()=>!document.querySelector('#useTrial').disabled);assert.equal((await get()).savedProfiles.length,3);});
    await check('Profiles: deleting active profile clears its live credentials only',async()=>{await page.locator('#savedProfile').selectOption((await get()).savedProfiles[1].id);await save('Research API');page.once('dialog',dialog=>dialog.accept());await page.locator('#deleteProfile').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('已删除'));const state=await get();assert.equal(state.savedProfiles.length,2);assert.equal(state.apiKey,'');assert.equal(state.savedProfiles[0].values.apiKey,initial.apiKey);});
    const invoke=message=>page.evaluate(message=>chrome.runtime.sendMessage(message),message);
    async function localTrial(extra={}){mode='normal';await worker.evaluate(values=>chrome.storage.local.set(values),{apiStyle:'mymemory',endpoint:origin+'/get',sourceLanguage:'en',targetLanguage:'zh-CN',apiKey:'SYNTHETIC-MUST-NOT-SEND',customHeaders:'{"X-Secret":"MUST-NOT-SEND"}',...extra});}
    await check('MyMemory: no key/custom headers, valid language pair, entity decoding',async()=>{await localTrial();const result=await invoke({type:'TRANSLATE_TEXT',text:'Hello world'});assert.equal(result.ok,true,result.error);assert.match(result.translation,/你好，世界 &/);const call=calls.at(-1);assert.equal(call.language,'en|zh-CN');assert.equal(call.headers['x-secret'],undefined);assert.equal(call.headers.authorization,undefined);assert.ok(!call.url.includes('SYNTHETIC'));});
    await check('MyMemory: marker preservation and single-paragraph, <=500-byte requests',async()=>{await localTrial();const start=calls.length;const text='__QF_DOC_0__\n'+('hello '.repeat(150))+'\n\n__QF_DOC_1__\n'+('汉字🙂'.repeat(130));const result=await invoke({type:'TRANSLATE_TEXT',text});assert.equal(result.ok,true,result.error);assert.match(result.translation,/__QF_DOC_0__/);assert.match(result.translation,/__QF_DOC_1__/);for(const call of calls.slice(start)){assert.ok(Buffer.byteLength(call.text)<=500);assert.doesNotMatch(call.text,/__QF_|\n/);assert.doesNotMatch(call.text,/\uFFFD/);}});
    await check('MyMemory: three bounded parallel chunks preserve text order and reduce delayed-request wait',async()=>{
      await localTrial();mode='delayed';const start=calls.length,input=Array.from({length:260},(_,index)=>`token${index}`).join(' '),started=Date.now();
      const result=await invoke({type:'TRANSLATE_TEXT',text:input,skipCache:true});mode='normal';
      assert.equal(result.ok,true,result.error);const batch=calls.slice(start);assert.ok(batch.length>=4);
      for(let index=0;index<260;index++)assert.ok(result.translation.includes(`token${index}`));
      assert.ok(result.translation.indexOf('token0')<result.translation.indexOf('token259'));
      const events=batch.flatMap(call=>[{time:call.startedAt,delta:1},{time:call.endedAt,delta:-1}]).sort((a,b)=>a.time-b.time||a.delta-b.delta);
      let active=0,maxActive=0;for(const event of events){active+=event.delta;maxActive=Math.max(maxActive,active);}
      assert.equal(maxActive,3);console.log(`MyMemory delayed chunks: ${batch.length} requests, max concurrent ${maxActive}, ${Date.now()-started} ms`);
    });
    await check('MyMemory: simultaneous page requests share a four-request global cap',async()=>{
      await localTrial();mode='delayed';const start=calls.length;
      const textA=Array.from({length:260},(_,index)=>`alpha${index}`).join(' ');
      const textB=Array.from({length:260},(_,index)=>`bravo${index}`).join(' ');
      try{
        const results=await page.evaluate(([a,b])=>Promise.all([chrome.runtime.sendMessage({type:'TRANSLATE_TEXT',text:a,skipCache:true}),chrome.runtime.sendMessage({type:'TRANSLATE_TEXT',text:b,skipCache:true})]),[textA,textB]);
        for(const result of results)assert.equal(result.ok,true,result.error);
        assert.ok(results[0].translation.indexOf('alpha0')<results[0].translation.indexOf('alpha259'));
        assert.ok(results[1].translation.indexOf('bravo0')<results[1].translation.indexOf('bravo259'));
        const batch=calls.slice(start),events=batch.flatMap(call=>[{time:call.startedAt,delta:1},{time:call.endedAt,delta:-1}]).sort((a,b)=>a.time-b.time||a.delta-b.delta);
        let active=0,maxActive=0;for(const event of events){active+=event.delta;maxActive=Math.max(maxActive,active);}
        assert.ok(batch.length>=8);assert.ok(maxActive>=3&&maxActive<=4,`Expected 3–4 active requests, got ${maxActive}`);
        console.log(`MyMemory simultaneous translations: ${batch.length} requests, max concurrent ${maxActive}`);
      }finally{mode='normal';}
    });
    await check('MyMemory: repeated segments reuse one request, while each contact email and connection test stays separate',async()=>{
      await localTrial();mode='delayed';
      const phrase='This synthetic phrase repeats only in the segment-cache check.';
      const repeated='__QF_DOC_71__\n'+phrase+'\n\n__QF_DOC_72__\n'+phrase;
      const single='__QF_DOC_73__\n'+phrase;
      try{
        const coldStart=calls.length,cold=await invoke({type:'TRANSLATE_TEXT',text:repeated});
        assert.equal(cold.ok,true,cold.error);assert.equal(calls.length-coldStart,1);
        const warmStart=calls.length,warm=await invoke({type:'TRANSLATE_TEXT',text:single});
        assert.equal(warm.ok,true,warm.error);assert.equal(calls.length,warmStart);
        await localTrial({mymemoryEmail:'separate@example.org'});
        const separateStart=calls.length,separate=await invoke({type:'TRANSLATE_TEXT',text:single});
        assert.equal(separate.ok,true,separate.error);assert.equal(calls.length-separateStart,1);
        const forcedStart=calls.length,forced=await invoke({type:'TRANSLATE_TEXT',text:single,skipCache:true});
        assert.equal(forced.ok,true,forced.error);assert.equal(calls.length-forcedStart,1);
        console.log(`MyMemory repeated segments: cold 1 request, warm 0 requests, changed contact 1 request, connection test 1 request`);
      }finally{mode='normal';}
    });
    await check('MyMemory: quota/auto-language errors are explicit and not cached',async()=>{await localTrial({sourceLanguage:'auto'});const before=calls.length;let result=await invoke({type:'TRANSLATE_TEXT',text:'Source language test'});assert.equal(result.code,'SOURCE_LANGUAGE_REQUIRED');assert.equal(calls.length,before);await localTrial();mode='quota';result=await invoke({type:'TRANSLATE_TEXT',text:'Quota test'});assert.equal(result.code,'TRIAL_UNAVAILABLE');mode='normal';result=await invoke({type:'TRANSLATE_TEXT',text:'Quota test'});assert.equal(result.ok,true);});
    await check('MyMemory: cancellation aborts HTTP and profile switch stops page translation',async()=>{await localTrial();mode='stall';const site=await context.newPage();await site.goto(origin+'/fixture');const tabId=await worker.evaluate(async url=>(await chrome.tabs.query({})).find(tab=>tab.url===url).id,origin+'/fixture');await worker.evaluate(id=>chrome.scripting.executeScript({target:{tabId:id},files:['src/content.js']}),tabId);const pending=worker.evaluate(id=>chrome.tabs.sendMessage(id,{type:'TRANSLATE_IMMERSIVE'}),tabId);const started=calls.length;while(calls.length===started)await delay(10);await worker.evaluate(()=>chrome.storage.local.set({model:'switched-config'}));await pending;await delay(100);assert.equal(calls.at(-1).aborted,true);assert.equal(await site.locator('[data-edge-wt-pending]').count(),0);await site.close();});
    await check('Default machine translation: browser window is available for local model calls',async()=>{
      const probe=await worker.evaluate(async()=>{
        const url=chrome.runtime.getURL('offscreen-translation.html');
        try{
          const ready=await ensureBrowserTranslationDocument();
          const contexts=await chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT'],documentUrls:[url]});
          return {ready,contexts:contexts.length,response:await chrome.runtime.sendMessage({target:'QF_BROWSER_TRANSLATOR',action:'probe'})};
        }catch(error){return {error:error.message,url,hasOffscreen:Boolean(chrome.offscreen?.createDocument),hasGetContexts:Boolean(chrome.runtime?.getContexts)};}
      });
      assert.equal(probe.ready,true,JSON.stringify(probe));assert.equal(probe.contexts,1,JSON.stringify(probe));
      assert.equal(probe.response.status,'ok');assert.equal(typeof probe.response.hasTranslator,'boolean');
      console.log('Browser Translator window: '+JSON.stringify({hasTranslator:probe.response.hasTranslator,userActivation:probe.response.userActivation}));
      const sample=await worker.evaluate(()=>chrome.runtime.sendMessage({
        target:'QF_BROWSER_TRANSLATOR',action:'translate',requestId:'real-browser-probe',
        pair:{sourceLanguage:'en',targetLanguage:'zh'},
        chunks:[{text:'Hello world',translate:true}]
      }));
      assert.ok(['ok','downloadable','downloading','unavailable'].includes(sample?.status),JSON.stringify(sample));
      if(sample.status==='ok')assert.match(sample.translation,/[\u3400-\u9fff]/);
      console.log('Browser Translator English → Chinese: '+sample.status);
    });
    await check('Default machine translation: available browser model stays local',async()=>{
      const before=calls.length;
      await worker.evaluate(()=>{
        globalThis.machineHarness={request:globalThis.requestBrowserTranslator};
        globalThis.requestBrowserTranslator=async chunks=>chunks.map(chunk=>chunk.translate?'本地 '+chunk.text.trim():chunk.text).join('').trim();
      });
      try{
        await worker.evaluate(()=>chrome.storage.local.set({apiStyle:'auto-machine',sourceLanguage:'en',targetLanguage:'zh-CN',mymemoryEmail:''}));
        const result=await invoke({type:'TRANSLATE_TEXT',text:'Hello world',skipCache:true});
        assert.equal(result.ok,true,result.error);assert.equal(result.translation,'本地 Hello world');assert.equal(calls.length,before);
      }finally{await worker.evaluate(()=>{globalThis.requestBrowserTranslator=globalThis.machineHarness.request;delete globalThis.machineHarness;});}
    });
    await check('Default machine translation: unavailable model sends only text and personal quota email to MyMemory',async()=>{
      await worker.evaluate(()=>{
        globalThis.machineHarness={request:globalThis.requestBrowserTranslator,fetch:globalThis.fetch,requests:[]};
        globalThis.requestBrowserTranslator=async()=>null;
        globalThis.fetch=async(url,options)=>{
          machineHarness.requests.push({url:String(url),method:options.method,credentials:options.credentials});
          return new Response(JSON.stringify({responseStatus:200,responseData:{translatedText:'模拟译文'}}),{status:200,headers:{'content-type':'application/json'}});
        };
      });
      try{
        await worker.evaluate(()=>chrome.storage.local.set({apiStyle:'auto-machine',sourceLanguage:'en',targetLanguage:'zh-CN',mymemoryEmail:'person@example.org'}));
        const result=await invoke({type:'TRANSLATE_TEXT',text:'Personal quota sample',skipCache:true});
        assert.equal(result.ok,true,result.error);assert.equal(result.translation,'模拟译文');
        const requests=await worker.evaluate(()=>machineHarness.requests);assert.equal(requests.length,1);
        const url=new URL(requests[0].url);assert.equal(url.origin,'https://api.mymemory.translated.net');assert.equal(url.searchParams.get('q'),'Personal quota sample');assert.equal(url.searchParams.get('langpair'),'en|zh-CN');assert.equal(url.searchParams.get('de'),'person@example.org');assert.equal(requests[0].credentials,'omit');
      }finally{await worker.evaluate(()=>{globalThis.fetch=machineHarness.fetch;globalThis.requestBrowserTranslator=machineHarness.request;delete globalThis.machineHarness;});}
    });
    if(process.env.QF_LIVE_TRIAL==='1')await check('MyMemory: live anonymous sample through isolated extension worker',async()=>{
      await localTrial({endpoint:'https://api.mymemory.translated.net/get',apiKey:'',customHeaders:'{}'});
      const result=await invoke({type:'TRANSLATE_TEXT',text:'Hello world. This is a translation test.',skipCache:true});
      assert.equal(result.ok,true,result.error);assert.match(result.translation,/[\u3400-\u9fff]/);console.log('Live sample returned Chinese text; elapsedMs='+result.elapsedMs);
    });
    if(process.env.QF_LIVE_TRIAL==='1')await check('Fresh install: default machine translation works without an AI setting',async()=>{
      await worker.evaluate(()=>chrome.storage.local.clear());
      const result=await invoke({type:'TRANSLATE_TEXT',text:'This is a short translation test from a new installation.',skipCache:true});
      assert.equal(result.ok,true,result.error);assert.match(result.translation,/[\u3400-\u9fff]/);
      const state=await get();assert.equal(state.apiStyle,undefined);assert.equal(state.apiKey,undefined);
      console.log('Fresh-install sample returned Chinese text; elapsedMs='+result.elapsedMs);
    });
    await page.reload();await page.waitForFunction(()=>document.body.dataset.ready==='true');await page.locator('#expandSettings').click();await page.screenshot({path:path.join(path.dirname(reportPath),'qudadflow-configuration-v'+JSON.parse(fs.readFileSync(path.join(root,'manifest.json'))).version+'.png'),fullPage:true});
  }catch(error){results.push({name:'suite setup',passed:false,error:error.message});console.error(error);}
  finally{await context?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.rmSync(scratch,{recursive:true,force:true,maxRetries:5,retryDelay:200});fs.mkdirSync(path.dirname(reportPath),{recursive:true});const report={browser:browserVersion,scope:process.env.QF_LIVE_TRIAL==='1'?'Isolated Edge, synthetic configuration keys. Includes one public MyMemory sample using only a fixed test sentence, without keys.':'Isolated Edge, synthetic configuration keys and local simulated translation responses only. No live provider requests in this run.',passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results};fs.writeFileSync(reportPath,JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failed:report.failed}));if(report.failed)process.exitCode=1;}
})();
