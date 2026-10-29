/* Active-API model selection in isolated Edge. All credentials and upstream responses are synthetic. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),reportPath=path.resolve(process.argv[2]||'model-switch-results.json'),version=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'))).version;
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'qf-model-switch-')),results=[],calls=[],errors=[],catalogReplies=[];let context,mode='normal';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<200;i++){if(await fn())return;await delay(25);}throw new Error('Condition did not settle');}
async function check(name,fn){try{await fn();results.push({name,passed:true});console.log('PASS '+name);}catch(error){results.push({name,passed:false,error:error.stack});console.error('FAIL '+name+': '+error.message);}finally{mode='normal';}}
const server=http.createServer(async(req,res)=>{
  const call={url:req.url,headers:req.headers,aborted:false};calls.push(call);res.on('close',()=>call.aborted=!res.writableEnded);
  if(req.url.endsWith('/models')){
    if(mode==='error'){res.writeHead(401);return res.end();}
    const ids=req.url.startsWith('/alternate')?['alternate-model']:['text-a','vision-b','unknown-c'];
    if(mode==='empty')ids.length=0;
    const reply=()=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:ids.map(id=>({id,input_modalities:id==='vision-b'?['text','image']:id==='text-a'?['text']:[],output_modalities:['text']}))}));};
    if(mode==='catalog-stall'){catalogReplies.push(reply);return;}return reply();
  }
  if(req.method==='POST'){
    let raw='';for await(const chunk of req)raw+=chunk;call.body=JSON.parse(raw);
    if(mode==='stall')return;
    const message=call.body.messages?.at(-1)?.content||'',text=typeof message==='string'?message:'';
    const marks=text.match(/__QF_DOC_\d+__/g)||[];
    res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({choices:[{message:{content:marks.length?marks.map(m=>m+'\n模型 '+call.body.model+' 的译文').join('\n\n'):'模型 '+call.body.model+' 的回答'}}]}));
  }
  res.end('<html><title>Local test page</title><article>Local fixture.</article></html>');
});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
try{
  const extension=path.join(scratch,'extension');fs.mkdirSync(extension);
  for(const n of ['manifest.json','offscreen-translation.html','reader.html','reader.js','reader.css','research.html','research.js','research.css','popup.html','popup.js','popup.css','options.html','options.js','options.css','privacy.html','src','assets','vendor','_locales'])fs.cpSync(path.join(root,n),path.join(extension,n),{recursive:true});
  const manifest=JSON.parse(fs.readFileSync(path.join(extension,'manifest.json')));manifest.host_permissions=['http://127.0.0.1/*'];fs.writeFileSync(path.join(extension,'manifest.json'),JSON.stringify(manifest));
  context=await chromium.launchPersistentContext(path.join(scratch,'profile'),{channel:'msedge',headless:true,viewport:{width:1480,height:1050},args:['--disable-extensions-except='+extension,'--load-extension='+extension]});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),base='chrome-extension://'+new URL(worker.url()).host+'/';
  const initial={apiStyle:'openai-compatible',endpoint:origin+'/v1/chat/completions',apiKey:'SYNTHETIC-KEY-A',customHeaders:'{"X-Access":"SYNTHETIC-HEADER-A"}',model:'manual-model',streamOpenAi:false,sourceLanguage:'en',targetLanguage:'zh-CN'};
  await worker.evaluate(v=>chrome.storage.local.set(v),initial);
  const options=await context.newPage();await options.goto(base+'options.html');await options.waitForFunction(()=>document.body.dataset.ready==='true');await options.locator('#expandSettings').click();
  mode='catalog-stall';
  const popup=await context.newPage(),reader=await context.newPage(),research=await context.newPage();
  for(const [page,name]of [[popup,'popup'],[reader,'reader'],[research,'research']]){page.setDefaultTimeout(9000);page.on('pageerror',e=>errors.push(e.message));await page.goto(base+name+'.html');}
  const get=()=>worker.evaluate(()=>chrome.storage.local.get(null)),state=()=>popup.evaluate(()=>chrome.runtime.sendMessage({type:'MODEL_STATE'}));
  const invoke=(page,message)=>page.evaluate(m=>chrome.runtime.sendMessage(m),message);
  const read=()=>invoke(options,{type:'FETCH_MODELS',requestId:crypto.randomUUID(),values:initial});
  await check('Opening all reading views automatically shares one upstream request and retains the current model',async()=>{
    try{
      await until(async()=>await popup.locator('#activeModel').inputValue()==='manual-model');assert.equal(await popup.locator('#activeProfile').count(),0);assert.equal(await reader.locator('#figureProfile').count(),0);assert.equal(await popup.locator('#activeModel').isDisabled(),true);
      for(const [page,id]of [[popup,'activeModel'],[reader,'translationModel'],[reader,'figureModel'],[research,'figureModel']])await until(async()=>await page.locator('#'+id+'Refresh').textContent()==='取消');
      assert.equal(calls.length,1);assert.equal(calls[0].url,'/v1/models');assert.equal(calls[0].headers.authorization,'Bearer '+initial.apiKey);assert.equal((await get()).model,'manual-model');
    }finally{for(const reply of catalogReplies.splice(0))reply();await until(async()=>!(await state()).discovering);}
    await until(async()=>await popup.locator('#activeModel option').count()===4);assert.equal(await popup.locator('#activeModel').isDisabled(),false);
  });
  await check('Explicit discovery persists only sanitized model metadata and populates all reading surfaces',async()=>{
    const result=await read();assert.equal(result.ok,true,result.error);await until(async()=>await popup.locator('#activeModel option').count()===4);
    const stored=await get();assert.equal(stored.model,'manual-model');assert.equal(stored.modelCatalogs.length,1);assert.equal(stored.modelCatalogs[0].models.length,3);assert.doesNotMatch(JSON.stringify(stored.modelCatalogs),/SYNTHETIC|apiKey|customHeaders|127\.0\.0\.1/);
    for(const [page,id]of [[reader,'translationModel'],[reader,'figureModel'],[research,'figureModel']]){await until(async()=>await page.locator('#'+id+' option').count()===4);assert.equal(await page.locator('#'+id).inputValue(),'manual-model');}
    for(const [page,id]of [[popup,'activeModel'],[reader,'translationModel'],[reader,'figureModel'],[research,'figureModel']])assert.deepEqual(await page.locator('#'+id+' option').allTextContents(),['manual-model','text-a','unknown-c','vision-b']);
  });
  await check('Every reading selector refreshes the active upstream directly without opening Settings or changing API',async()=>{
    const before=await get();
    for(const [page,id]of [[popup,'activeModel'],[reader,'translationModel'],[reader,'figureModel'],[research,'figureModel']]){
      if(id==='figureModel'&&page===reader)await reader.locator('#file').setInputFiles({name:'refresh.txt',mimeType:'text/plain',buffer:Buffer.from('A model refresh fixture.')});
      if(id==='figureModel')await page.locator('#figureWorkflow').evaluate(element=>{element.open=true;});
      const count=calls.length;await page.locator('#'+id+'Refresh').click();await until(()=>calls.length===count+1);await until(async()=>!(await state()).discovering);assert.equal(calls.at(-1).url,'/v1/models');
    }
    const after=await get();for(const field of Object.keys(initial))assert.equal(after[field],before[field]);assert.equal(after.profileRevision,before.profileRevision);
  });
  await check('Reading-page discovery cannot override the saved active address or credentials',async()=>{
    const current=await state(),before=await get();await invoke(popup,{type:'MODEL_DISCOVER',force:true,connection:current.connection,values:{...initial,endpoint:origin+'/alternate/v1/chat/completions',apiKey:'SYNTHETIC-INJECTED'},profileId:'other-api'});
    assert.equal(calls.at(-1).url,'/v1/models');assert.equal(calls.at(-1).headers.authorization,'Bearer '+initial.apiKey);assert.equal((await get()).endpoint,before.endpoint);
  });
  await check('Popup switches only the model, synchronizes reader/research and updates active saved default',async()=>{
    const before=await get();await popup.locator('#activeModel').selectOption('text-a');await until(async()=>(await get()).model==='text-a');
    const after=await get();for(const field of ['apiStyle','endpoint','apiKey','customHeaders','sourceLanguage','targetLanguage','activeProfileId'])assert.equal(after[field],before[field]);
    assert.equal(after.savedProfiles.find(p=>p.id===after.activeProfileId).values.model,'text-a');assert.equal(after.profileRevision,before.profileRevision+1);
    await until(async()=>await reader.locator('#translationModel').inputValue()==='text-a'&&await research.locator('#figureModel').inputValue()==='text-a');
    const response=await invoke(popup,{type:'TRANSLATE_TEXT',text:'First model test'});assert.equal(response.ok,true,response.error);assert.equal(calls.at(-1).body.model,'text-a');assert.equal(calls.at(-1).headers.authorization,'Bearer '+initial.apiKey);
  });
  await check('Reader model selector controls actual document body translation',async()=>{
    await reader.locator('#file').setInputFiles({name:'notes.txt',mimeType:'text/plain',buffer:Buffer.from('This document tests the selected model.')});await reader.waitForFunction(()=>document.getElementById('status').textContent.includes('文档已打开'));
    await reader.locator('#translationModel').selectOption('vision-b');await until(async()=>(await get()).model==='vision-b');await reader.locator('#translatePage').click();await reader.waitForFunction(()=>document.getElementById('stop').hidden&&document.getElementById('export').disabled===false);assert.equal(calls.at(-1).body.model,'vision-b');
  });
  await check('Research selector uses the same API for questions and rejects legacy alternate-profile routing',async()=>{
    await research.locator('#figureModel').selectOption('unknown-c');await until(async()=>(await get()).model==='unknown-c');await research.locator('#paperMaterial').fill('A synthetic research question.');await research.locator('#analyzePaper').click();await research.waitForFunction(()=>!document.getElementById('downloadPaper').disabled);assert.equal(calls.at(-1).body.model,'unknown-c');assert.equal(calls.at(-1).headers['x-access'],'SYNTHETIC-HEADER-A');
    const before=calls.length,result=await research.evaluate(()=>new Promise(resolve=>{const port=chrome.runtime.connect({name:'qudadflow-document'});port.onMessage.addListener(m=>{if(m.type==='RESULT'){resolve(m);port.disconnect();}});port.postMessage({type:'RESEARCH_ANALYZE',requestId:'old-profile',profileId:'other-api',text:'No switching'});}));assert.equal(result.ok,false);assert.match(result.error,/设置/);assert.equal(calls.length,before);
  });
  await check('API mutation outside Settings and selecting an unlisted model are rejected without changing state',async()=>{
    const before=await get();for(const page of [popup,reader,research]){const denied=await invoke(page,{type:'PROFILE_APPLY',profileId:before.activeProfileId});assert.equal(denied.ok,false);}
    const current=await state(),invalid=await invoke(popup,{type:'MODEL_SELECT',connection:current.connection,model:'invented-model'});assert.equal(invalid.ok,false);assert.deepEqual(await get(),before);
  });
  await check('A model selection awaiting commit prevents a new document request with the previous model',async()=>{
    await reader.evaluate(()=>{const send=chrome.runtime.sendMessage.bind(chrome.runtime);window.restoreModelSend=()=>{chrome.runtime.sendMessage=send;};chrome.runtime.sendMessage=message=>message.type==='MODEL_SELECT'?new Promise(resolve=>{window.releaseModelSelect=()=>send(message).then(resolve);}):send(message);});
    const before=calls.length;
    try{await reader.locator('#translationModel').selectOption('vision-b');await reader.waitForFunction(()=>window.releaseModelSelect);assert.equal(await reader.locator('#translatePage').isDisabled(),true);assert.equal(await reader.locator('#figureModel').isDisabled(),true);assert.equal(calls.length,before);await reader.evaluate(()=>window.releaseModelSelect());await until(async()=>(await get()).model==='vision-b');await reader.waitForFunction(()=>!document.getElementById('translatePage').disabled);}
    finally{await reader.evaluate(()=>window.restoreModelSend());}
  });
  await check('A model change in another window cancels a pending document request without mixing answers',async()=>{
    await reader.locator('#file').setInputFiles({name:'pending.txt',mimeType:'text/plain',buffer:Buffer.from('Pending model request.')});await reader.waitForFunction(()=>document.getElementById('status').textContent.includes('文档已打开'));
    mode='stall';const before=calls.length;await reader.locator('#translatePage').click();await until(()=>calls.length>before);const pending=calls.at(-1);await popup.locator('#activeModel').selectOption('text-a');await until(()=>pending.aborted);await reader.waitForFunction(()=>document.getElementById('stop').hidden);assert.doesNotMatch(await reader.locator('#translationContent').textContent(),/模型 unknown-c 的译文/);
  });
  await check('Refreshing model metadata does not cancel or restart an active translation',async()=>{
    mode='stall';const before=calls.length;await reader.locator('#translatePage').click();await until(()=>calls.length>before);const pending=calls.at(-1);
    const current=await state(),discovery=await invoke(popup,{type:'MODEL_DISCOVER',force:true,connection:current.connection});assert.equal(discovery.ok,true);assert.equal(pending.aborted,false);assert.equal(await reader.locator('#stop').isVisible(),true);
    await reader.locator('#stop').click();await until(()=>pending.aborted);
  });
  await check('A stale settings tab cannot overwrite a model selection made during reading',async()=>{
    const before=await get();await options.locator('button[type=submit]').click();await options.waitForFunction(()=>document.getElementById('status').textContent.includes('其他窗口'));assert.equal((await get()).model,before.model);
  });
  let alternate,oldState;
  await check('Discovering an unsaved alternate API stores a separate catalog without changing the active connection',async()=>{
    alternate={...initial,endpoint:origin+'/alternate/v1/chat/completions',apiKey:'SYNTHETIC-KEY-B',model:'alternate-model'};oldState=await state();const result=await invoke(options,{type:'FETCH_MODELS',requestId:'alternate-discovery',values:alternate});assert.equal(result.ok,true,result.error);assert.deepEqual((await state()).models,oldState.models);assert.equal((await get()).apiKey,initial.apiKey);
  });
  await check('Only settings switches APIs; stale model selections cannot cross the new connection',async()=>{
    const result=await invoke(options,{type:'PROFILE_SAVE',name:'Alternate API',values:alternate,revision:(await get()).profileRevision});assert.equal(result.ok,true,result.error);await until(async()=>(await state()).model==='alternate-model');assert.deepEqual((await state()).models.map(m=>m.id),['alternate-model']);
    const denied=await invoke(popup,{type:'MODEL_SELECT',connection:oldState.connection,model:'vision-b'});assert.equal(denied.ok,false);assert.equal((await get()).model,'alternate-model');
  });
  await check('Changed credentials or headers trigger their own discovery; returning restores the original catalog',async()=>{
    for(const change of [{apiKey:'SYNTHETIC-DIFFERENT-KEY'},{customHeaders:'{"X-Access":"SYNTHETIC-OTHER-HEADER"}'}]){
      const prior=await state(),count=calls.length;await worker.evaluate(v=>chrome.storage.local.set(v),change);await until(()=>calls.length>count);await until(async()=>{const s=await state();return s.connection!==prior.connection&&s.fetchedAt&&!s.discovering;});
      const next=await state();assert.notEqual(next.connection,prior.connection);assert.equal(calls.length,count+1);assert.equal(calls.at(-1).headers.authorization,'Bearer '+(change.apiKey||alternate.apiKey));
      await worker.evaluate(v=>chrome.storage.local.set(v),alternate);await until(async()=>(await state()).connection===prior.connection);assert.equal((await state()).models.length,1);
    }
  });
  await check('Upstream failure preserves a previously read catalog and saved active model',async()=>{
    mode='error';const before=await state(),response=await invoke(options,{type:'FETCH_MODELS',requestId:'bad-discovery',values:alternate});assert.equal(response.code,'HTTP_401');assert.deepEqual(await state(),before);
  });
  await check('Reopening readers restores cached models without fetching upstream or applying a model',async()=>{
    const before=calls.length;await reader.reload();await until(async()=>await reader.locator('#translationModel').inputValue()==='alternate-model');assert.equal(calls.length,before);assert.equal((await state()).models.length,1);
    assert.doesNotMatch(JSON.stringify(await state()),/SYNTHETIC|apiKey|customHeaders|127\.0\.0\.1/);
  });
  await check('A failed automatic read is shown beside the selector, keeps the manual model and retries only on request',async()=>{
    try{
      mode='error';const count=calls.length;await worker.evaluate(v=>chrome.storage.local.set(v),{...initial,endpoint:origin+'/failure/v1/chat/completions'});
      await until(async()=>(await state()).discoveryCode==='HTTP_401');await until(async()=>await popup.locator('#activeModelStatus').textContent().then(text=>text.includes('HTTP 401')));assert.equal((await get()).model,initial.model);assert.equal(calls.length,count+1);
      await popup.reload();await until(async()=>await popup.locator('#activeModelStatus').textContent().then(text=>text.includes('HTTP 401')));assert.equal(calls.length,count+1);
      mode='normal';await popup.locator('#activeModelRefresh').click();await until(async()=>(await state()).models.length===3&&!(await state()).discovering);assert.equal(calls.length,count+2);assert.equal(await popup.locator('#activeModel').inputValue(),initial.model);
    }finally{await worker.evaluate(v=>chrome.storage.local.set(v),alternate);}
  });
  await check('Empty upstream catalogs retain the current model and are not repeatedly fetched on reopen',async()=>{
    try{
      mode='empty';const count=calls.length;await worker.evaluate(v=>chrome.storage.local.set(v),{...initial,endpoint:origin+'/empty/v1/chat/completions'});await until(async()=>(await state()).fetchedAt&&!(await state()).discovering);
      assert.equal((await state()).models.length,0);assert.equal((await get()).model,initial.model);await popup.reload();await until(async()=>await popup.locator('#activeModelStatus').textContent().then(text=>text.includes('空列表')));assert.equal(calls.length,count+1);
    }finally{await worker.evaluate(v=>chrome.storage.local.set(v),alternate);}
  });
  await check('Concurrent manual refreshes share one request and any reading view can cancel it without discarding the cache',async()=>{
    mode='catalog-stall';const before=await state(),count=calls.length;
    const one=invoke(popup,{type:'MODEL_DISCOVER',force:true,connection:before.connection}),two=invoke(reader,{type:'MODEL_DISCOVER',force:true,connection:before.connection});await until(()=>calls.length===count+1);const pending=calls.at(-1);
    await until(async()=>await reader.locator('#translationModelRefresh').textContent()==='取消');await reader.locator('#translationModelRefresh').click();await Promise.all([one,two]);await until(()=>pending.aborted);
    const after=await state();assert.equal(calls.length,count+1);assert.deepEqual(after.models,before.models);assert.equal(after.model,before.model);assert.equal(after.discoveryCode,'CANCELLED');catalogReplies.length=0;
  });
  await check('Switching API in Settings aborts the prior list request and prevents stale results reaching the new selector',async()=>{
    mode='catalog-stall';const before=await state(),count=calls.length,promise=invoke(popup,{type:'MODEL_DISCOVER',force:true,connection:before.connection});await until(()=>calls.length>count);const pending=calls.at(-1);mode='normal';
    await invoke(options,{type:'PROFILE_SAVE',name:'Return to first API',values:initial,revision:(await get()).profileRevision});await promise;await until(()=>pending.aborted);await until(async()=>await popup.locator('#activeModel').inputValue()===initial.model);assert.deepEqual((await state()).models.map(m=>m.id),['text-a','unknown-c','vision-b']);catalogReplies.length=0;
  });
  await check('New installations without API credentials perform no discovery and direct users to Settings',async()=>{
    const before=await get();try{
      const count=calls.length;await worker.evaluate(()=>chrome.storage.local.set({apiKey:'',model:''}));await until(async()=>await popup.locator('#activeModelStatus').textContent().then(text=>text.includes('新增或完善')));assert.equal(await popup.locator('#activeModelRefresh').isDisabled(),true);assert.equal(calls.length,count);
    }finally{await worker.evaluate(v=>chrome.storage.local.set(v),before);}
  });
  await check('A missing saved model still discovers options without silently selecting the first upstream ID',async()=>{
    try{
      await worker.evaluate(v=>chrome.storage.local.set(v),{...initial,endpoint:origin+'/unselected/v1/chat/completions',model:''});await until(async()=>(await state()).models.length===3&&!(await state()).discovering);
      for(const [page,id]of [[popup,'activeModel'],[reader,'translationModel'],[research,'figureModel']])await until(async()=>await page.locator('#'+id+' option').count()===4&&await page.locator('#'+id).inputValue()==='');assert.equal((await get()).model,'');
    }finally{await worker.evaluate(v=>chrome.storage.local.set(v),initial);}
  });
  await check('Reading-page discovery with no host grant shows a permission error without making a network request',async()=>{
    try{
      const count=calls.length;await worker.evaluate(v=>chrome.storage.local.set(v),{...initial,endpoint:'https://example.invalid/v1/chat/completions'});await until(async()=>(await state()).discoveryCode==='PERMISSION_REQUIRED');assert.equal(calls.length,count);assert.equal((await get()).model,initial.model);
    }finally{await worker.evaluate(v=>chrome.storage.local.set(v),initial);}
  });
  await check('Traditional active APIs hide unrelated AI models while preserving ordinary document use',async()=>{
    await invoke(options,{type:'PROFILE_SAVE',name:'Traditional',values:{...initial,apiStyle:'custom-json',model:''},revision:(await get()).profileRevision});await until(async()=>await popup.locator('#activeModelRefresh').isHidden());assert.equal(await popup.locator('#activeModel').isDisabled(),true);assert.equal((await state()).models.length,0);assert.doesNotMatch(await popup.locator('#activeModel').textContent(),/vision-b|alternate-model/);
  });
  await check('Catalog storage is bounded by bytes and connection count; cancelled discovery cannot overwrite it',async()=>{
    const before=(await get()).modelCatalogs;
    try{
      const result=await worker.evaluate(async()=>{
        const models=Array.from({length:1000},(_,i)=>({id:'x'.repeat(240)+i,inputModalities:['text','image','unsupported-metadata'],outputModalities:['text']}));
        for(let i=0;i<22;i++)await QFModels.remember({apiStyle:'openai-compatible',endpoint:'http://127.0.0.1/synthetic/'+i,apiKey:'SYNTHETIC-CAPACITY',customHeaders:'{}'},{models,truncated:false},new AbortController().signal);
        const {modelCatalogs}=await chrome.storage.local.get('modelCatalogs'),controller=new AbortController();controller.abort();let rejected=false;
        try{await QFModels.remember({endpoint:'http://127.0.0.1/cancelled'},{models:[],truncated:false},controller.signal);}catch{rejected=true;}
        return {count:modelCatalogs.length,bytes:new TextEncoder().encode(JSON.stringify(modelCatalogs)).length,filtered:!JSON.stringify(modelCatalogs).includes('unsupported-metadata'),rejected,unchanged:JSON.stringify(modelCatalogs)===JSON.stringify((await chrome.storage.local.get('modelCatalogs')).modelCatalogs)};
      });assert.ok(result.count<=20&&result.count>0);assert.ok(result.bytes<=2*1024*1024);assert.equal(result.filtered,true);assert.equal(result.rejected,true);assert.equal(result.unchanged,true);
    }finally{await worker.evaluate(modelCatalogs=>chrome.storage.local.set({modelCatalogs}),before);}
  });
  await check('Compact model selectors render without horizontal overflow or uncaught errors',async()=>{
    await worker.evaluate(v=>chrome.storage.local.set(v),initial);await reader.locator('#file').setInputFiles({name:'layout.txt',mimeType:'text/plain',buffer:Buffer.from('Model controls in the document toolbar and figure workbench.')});await reader.waitForFunction(()=>document.getElementById('status').textContent.includes('文档已打开'));await reader.locator('#figureWorkflow').evaluate(element=>{element.open=true;});
    for(const width of [1480,1050,620,390])for(const page of [reader,research]){await page.setViewportSize({width,height:1050});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);for(const field of await page.locator('.qf-model-field:visible').all()){const box=await field.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1,JSON.stringify(box));}}
    await popup.setViewportSize({width:320,height:960});await reader.screenshot({path:path.join(path.dirname(reportPath),'qudadflow-model-reader-v'+version+'.png')});await research.screenshot({path:path.join(path.dirname(reportPath),'qudadflow-model-research-v'+version+'.png')});await popup.screenshot({path:path.join(path.dirname(reportPath),'qudadflow-model-popup-v'+version+'.png')});assert.deepEqual(errors,[]);
  });
}catch(error){results.push({name:'setup',passed:false,error:error.stack});console.error(error);}
finally{await context?.close();server.closeAllConnections();await new Promise(r=>server.close(r));assert.ok(path.resolve(scratch).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(scratch).startsWith('qf-model-switch-'));fs.rmSync(scratch,{recursive:true,force:true,maxRetries:5,retryDelay:200});const report={version,scope:'Isolated Edge; synthetic API profiles, localhost model discovery and translation. No real user credentials or provider access.',passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results};fs.mkdirSync(path.dirname(reportPath),{recursive:true});fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,failed:report.failed}));if(report.failed)process.exitCode=1;}
})();
