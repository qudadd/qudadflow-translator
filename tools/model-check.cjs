/* Model discovery and draft testing in an isolated browser with synthetic credentials only. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),vm=require('node:vm'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),reportPath=path.resolve(process.argv[2]||'model-results.json');
const version=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'))).version;
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'qudadflow-models-')),results=[],calls=[];
const key='SYNTHETIC-MODEL-KEY',headerSecret='SYNTHETIC-HEADER-SECRET';let context,browserVersion,mode='normal';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,timeout=3000){const end=Date.now()+timeout;while(!fn()){assert.ok(Date.now()<end,'condition timed out');await delay(20);}}
async function check(name,fn){try{await fn();results.push({name,passed:true});console.log('PASS '+name);}catch(error){results.push({name,passed:false,error:error.message});console.log('FAIL '+name+': '+error.message);}}
const fixture={data:[
  {id:'reader-text',owned_by:'Example Provider',input_modalities:['text'],output_modalities:['text'],context_window:32768,max_output_tokens:4096,supported_endpoints:['chat/completions']},
  {id:'reader-vision',name:'Research vision',architecture:{input_modalities:['text','image'],output_modalities:['text']},context_length:128000,description:'Example visual model'},
  {id:'mystery-vision-name',owned_by:'example',description:'<img src=x onerror="window.modelInjected=true"> '+key+' '+headerSecret},
  {id:'reader-text'}, {id:'bad\nmodel'}, {id:key}, {id:'z'.repeat(257)}
]};
const server=http.createServer(async(req,res)=>{
  const record={url:new URL(req.url,'http://local'),headers:req.headers,method:req.method,aborted:false};calls.push(record);res.on('close',()=>{record.aborted=!res.writableEnded;});
  if(req.method==='POST'){
    let raw='';for await(const part of req)raw+=part;record.body=JSON.parse(raw);res.setHeader('Content-Type','application/json');
    if(mode==='stall')return;
    return res.end(JSON.stringify({choices:[{message:{content:mode==='echo-secret'?key+' '+headerSecret:'连接测试通过'}}]}));
  }
  if(record.url.pathname.endsWith('/models')){
    if(mode==='stall')return;
    if(mode==='slow'||mode==='long'){await delay(mode==='long'?17000:700);if(res.destroyed)return;}
    if(mode==='401'||mode==='404'||mode==='429'){res.writeHead(Number(mode));return res.end(key);}
    if(mode==='redirect'){res.writeHead(302,{Location:'/leak'});return res.end();}
    if(mode==='html')return res.end('<html>Login</html>');
    res.setHeader('Content-Type','application/json');
    if(mode==='oversized')return res.end(JSON.stringify({data:[],padding:'x'.repeat(2*1024*1024)}));
    return res.end(JSON.stringify(mode==='empty'?{data:[]}:mode==='many'?{data:Array.from({length:1005},(_,i)=>({id:'model-'+i}))}:fixture));
  }
  res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Local model test</title><p>Synthetic fixture</p>');
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
  try{
    const catalogContext=vm.createContext({URL});vm.runInContext(fs.readFileSync(path.join(root,'src/model-catalog.js'),'utf8')+'\nthis.catalog=QFModelCatalog;',catalogContext);const catalog=catalogContext.catalog;
    await check('Models: same-origin URL derivation preserves prefixes and query',()=>{
      for(const [input,expected] of [['/v1/chat/completions','/v1/models'],['/v1/responses','/v1/models'],['/gateway/v1','/gateway/v1/models'],['/gateway','/gateway/v1/models'],['','/v1/models'],['/v1/models/','/v1/models']]){
        const url=catalog.endpoint(origin+input+'?tenant=test#fragment');assert.equal(url.origin,origin);assert.equal(url.pathname,expected);assert.equal(url.search,'?tenant=test');assert.equal(url.hash,'');
      }
      assert.throws(()=>catalog.endpoint('https://user:pass@example.com/v1'));assert.throws(()=>catalog.endpoint('file:///x'));
    });
    await check('Models: accepted list formats, validation, deduplication and bounds',()=>{
      for(const payload of [{data:fixture.data},{models:fixture.data},fixture.data]){const result=catalog.normalize(payload,[key,headerSecret]);assert.equal(result.models.length,3);assert.equal(result.skipped,3);assert.ok(!JSON.stringify(result).includes(key));}
      assert.throws(()=>catalog.normalize({error:'not a list'}));assert.equal(catalog.normalize({data:[]}).models.length,0);
      const many=catalog.normalize({data:Array.from({length:1005},(_,i)=>({id:'m'+i}))});assert.equal(many.models.length,1000);assert.equal(many.truncated,true);
    });
    const extension=path.join(scratch,'extension');fs.mkdirSync(extension);
    for(const file of ['manifest.json','offscreen-translation.html','options.html','options.css','options.js','popup.html','popup.css','popup.js','research.html','research.js','research.css','privacy.html','src','assets','_locales'])fs.cpSync(path.join(root,file),path.join(extension,file),{recursive:true});
    const manifest=JSON.parse(fs.readFileSync(path.join(extension,'manifest.json')));manifest.host_permissions=['http://127.0.0.1/*'];fs.writeFileSync(path.join(extension,'manifest.json'),JSON.stringify(manifest));
    context=await chromium.launchPersistentContext(path.join(scratch,'profile'),{channel:process.env.QF_BROWSER_CHANNEL||'msedge',headless:true,viewport:{width:1440,height:1050},args:['--disable-extensions-except='+extension,'--load-extension='+extension]});browserVersion=context.browser().version();
    const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),base='chrome-extension://'+new URL(worker.url()).host+'/';
    const page=await context.newPage();page.setDefaultTimeout(7000);
    const initial={apiStyle:'openai-compatible',apiKey:key,endpoint:origin+'/gateway/v1/chat/completions',model:'original-model',customHeaders:JSON.stringify({'X-Access':headerSecret}),targetLanguage:'zh-CN',streamOpenAi:false};
    const get=()=>worker.evaluate(async()=>{const {modelCatalogs,...values}=await chrome.storage.local.get(null);return values;});
    const invoke=message=>page.evaluate(message=>chrome.runtime.sendMessage(message),message);
    const values=extra=>({...initial,...extra});
    async function reset(){mode='normal';await worker.evaluate(v=>chrome.storage.local.set(v),initial);await page.goto(base+'options.html');await page.waitForFunction(()=>document.body.dataset.ready==='true');await page.locator('#expandSettings').click();}
    async function read(){await page.locator('#fetchModels').click();await page.waitForFunction(()=>document.querySelector('#cancelModels').hidden);}
    await check('Models: new installation has no guessed default model',async()=>{await page.goto(base+'options.html');await page.waitForFunction(()=>document.body.dataset.ready==='true');await page.locator('#expandSettings').click();assert.equal(await page.locator('#model').inputValue(),'');assert.equal(calls.length,0);});
    await reset();const savedBefore=await get();
    await check('Models: explicit GET uses configured prefix, bearer and custom headers',async()=>{
      await read();const last=calls.at(-1);assert.equal(last.method,'GET');assert.equal(last.url.pathname,'/gateway/v1/models');assert.equal(last.headers.authorization,'Bearer '+key);assert.equal(last.headers['x-access'],headerSecret);assert.equal(last.headers.cookie,undefined);assert.equal(await page.locator('#model').inputValue(),'original-model');assert.deepEqual(await get(),savedBefore);
    });
    await check('Models: no implicit selection, XSS-safe metadata, unknown capability stays unknown',async()=>{
      assert.equal(await page.locator('#modelCandidates').evaluate(e=>e.selectedIndex),-1);assert.equal(await page.locator('#applyModel').isDisabled(),true);
      await page.locator('#modelCandidates').selectOption('mystery-vision-name');const info=await page.locator('#modelMetadata').textContent();assert.match(info,/未知/);assert.match(info,/<img/);assert.ok(!info.includes(key));assert.ok(!info.includes(headerSecret));assert.equal(await page.locator('#modelMetadata img').count(),0);
      await page.locator('#modelFilter').selectOption('vision');assert.deepEqual(await page.locator('#modelCandidates option').allTextContents(),['reader-vision']);
      await page.locator('#modelFilter').selectOption('unknown');assert.deepEqual(await page.locator('#modelCandidates option').allTextContents(),['mystery-vision-name']);
      await page.locator('#modelFilter').selectOption('text');assert.equal(await page.locator('#modelCandidates option').count(),2);
      await page.locator('#modelSearch').fill('reader-text');assert.equal(await page.locator('#modelCandidates option').count(),1);await page.locator('#modelSearch').fill('');await page.locator('#modelFilter').selectOption('all');
    });
    await check('Models: applying a candidate changes editor only, then tests draft model without saving',async()=>{
      await page.locator('#modelCandidates').selectOption('reader-text');await page.locator('#applyModel').click();assert.equal(await page.locator('#model').inputValue(),'reader-text');assert.equal((await get()).model,'original-model');assert.match(await page.locator('#saveState').textContent(),/未保存/);
      await page.locator('#testApi').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('连接成功'));assert.equal(calls.at(-1).body.model,'reader-text');assert.deepEqual(await get(),savedBefore);assert.match(await page.locator('#modelVerification').textContent(),/图片能力尚未测试/);
      const before=calls.length;await page.locator('#testApi').click();await page.waitForFunction(()=>!document.querySelector('#testApi').disabled);assert.equal(calls.length,before+1);
    });
    await check('Models: editing invalidates connection verification; saving explicitly applies model',async()=>{
      await page.locator('#model').fill('reader-vision');assert.match(await page.locator('#modelVerification').textContent(),/尚未测试/);await page.locator('button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('已保存'));assert.equal((await get()).model,'reader-vision');
    });
    await check('Models: changing endpoint clears list and cancels in-flight HTTP',async()=>{
      mode='stall';const before=calls.length;await page.locator('#fetchModels').click();await until(()=>calls.length>before);const pending=calls.at(-1);await page.locator('#endpoint').fill(origin+'/other/v1');await until(()=>pending.aborted);assert.equal(await page.locator('#modelBrowser').isVisible(),false);assert.equal(await page.locator('#cancelModels').isVisible(),false);await reset();
    });
    await check('Models: cancellation aborts HTTP and a late response cannot populate the list',async()=>{
      mode='slow';const before=calls.length;await page.locator('#fetchModels').click();await until(()=>calls.length>before);const pending=calls.at(-1);await page.locator('#cancelModels').click();await until(()=>pending.aborted);await delay(800);assert.equal(await page.locator('#modelBrowser').isVisible(),false);assert.match(await page.locator('#modelStatus').textContent(),/取消/);
    });
    for(const [responseMode,code] of [['401','HTTP_401'],['404','HTTP_404'],['429','HTTP_429'],['html','MODEL_LIST_FORMAT'],['redirect','NETWORK_ERROR'],['oversized','RESPONSE_TOO_LARGE']])await check('Models: '+responseMode+' has a safe actionable error',async()=>{
      mode=responseMode;const response=await invoke({type:'FETCH_MODELS',requestId:crypto.randomUUID(),values:values()});assert.equal(response.ok,false);assert.equal(response.code,code);assert.ok(!JSON.stringify(response).includes(key));assert.equal(calls.filter(call=>call.url.pathname==='/leak').length,0);
    });
    await check('Models: empty and capped catalogs are explicit and never replace the current ID',async()=>{
      mode='empty';await read();assert.equal(await page.locator('#modelCandidates option').count(),0);assert.match(await page.locator('#modelCount').textContent(),/无匹配/);assert.equal(await page.locator('#model').inputValue(),'original-model');
      mode='many';await read();assert.equal(await page.locator('#modelCandidates option').count(),1000);assert.match(await page.locator('#modelStatus').textContent(),/最多 1000/);
    });
    await check('Models: slow catalog waits beyond former 15-second deadline and returns normally',async()=>{
      mode='long';const before=calls.length,started=Date.now();const response=await invoke({type:'FETCH_MODELS',requestId:crypto.randomUUID(),values:values()});assert.equal(response.ok,true,response.error);assert.ok(Date.now()-started>=16500);assert.equal(calls[before].aborted,false);
    });
    await check('Draft tests: cancellation belongs to its settings tab; closing the owner aborts pending HTTP',async()=>{
      mode='stall';const other=await context.newPage();await other.goto(base+'options.html');await other.waitForFunction(()=>document.body.dataset.ready==='true');
      const before=calls.length,requestId='owned-draft';const pending=other.evaluate(message=>chrome.runtime.sendMessage(message),{type:'TRANSLATE_TEST_DRAFT',requestId,values:values()}).catch(()=>null);
      try{
        await until(()=>calls.length>before);await invoke({type:'CANCEL_TEST_DRAFT',requestId});await delay(100);assert.equal(calls[before].aborted,false);
        await other.close();await until(()=>calls[before].aborted);await pending;
        assert.equal(await worker.evaluate(()=>activeDraftRequests.size),0);
      }finally{if(!other.isClosed())await other.close();mode='normal';}
    });
    await check('Models: unsupported providers and absent permission never reach network',async()=>{
      const before=calls.length;const provider=await invoke({type:'FETCH_MODELS',requestId:'provider',values:values({apiStyle:'deepl'})});assert.equal(provider.code,'UNSUPPORTED_PROVIDER');
      const permission=await invoke({type:'FETCH_MODELS',requestId:'permission',values:values({endpoint:'https://example.invalid/v1'})});assert.equal(permission.code,'PERMISSION_REQUIRED');assert.equal(calls.length,before);
    });
    await check('Models: popup cannot read or cancel Settings draft requests or test draft credentials',async()=>{
      const popup=await context.newPage();await popup.goto(base+'popup.html');const before=calls.length;for(const type of ['FETCH_MODELS','CANCEL_MODELS','TRANSLATE_TEST_DRAFT','CANCEL_TEST_DRAFT']){const result=await popup.evaluate(message=>chrome.runtime.sendMessage(message),{type,requestId:'blocked',values:values()});assert.equal(result.code,'FORBIDDEN');}assert.equal(calls.length,before);await popup.close();
    });
    await check('Models: test output hides reflected authentication values',async()=>{
      mode='echo-secret';const result=await invoke({type:'TRANSLATE_TEST_DRAFT',requestId:crypto.randomUUID(),values:values()});assert.equal(result.ok,true,result.error);assert.ok(!result.translation.includes(key));assert.ok(!result.translation.includes(headerSecret));
    });
    await check('Models: root API URL derives valid model and translation routes',async()=>{
      mode='normal';
      const models=await invoke({type:'FETCH_MODELS',requestId:'root-url',values:values({endpoint:origin+'/?tenant=test#fragment'})});assert.equal(models.ok,true,models.error);assert.equal(calls.at(-1).url.pathname,'/v1/models');assert.equal(calls.at(-1).url.search,'?tenant=test');
      const translated=await invoke({type:'TRANSLATE_TEST_DRAFT',requestId:crypto.randomUUID(),values:values({endpoint:origin+'/?tenant=test#fragment'})});assert.equal(translated.ok,true,translated.error);assert.equal(calls.at(-1).url.pathname,'/v1/chat/completions');assert.equal(calls.at(-1).url.search,'?tenant=test');
    });
    await reset();await read();await page.locator('#modelCandidates').selectOption('reader-vision');
    await check('Settings: QQ entry, model details and navigation render within desktop and narrow widths',async()=>{
      assert.match(await page.locator('#communitySupport').textContent(),/1048123205/);
      for(const width of [1440,900,600,390]){await page.setViewportSize({width,height:1050});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'horizontal overflow at '+width);}
      await page.setViewportSize({width:1440,height:1050});await page.locator('#modelWrap').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(path.dirname(reportPath),'qudadflow-model-settings-v'+version+'.png')});
      await page.setViewportSize({width:390,height:844});await page.locator('#modelBrowser').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(path.dirname(reportPath),'qudadflow-model-settings-mobile-v'+version+'.png')});
    });
  }catch(error){results.push({name:'suite setup',passed:false,error:error.message});console.error(error);}
  finally{
    await context?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
    fs.rmSync(scratch,{recursive:true,force:true,maxRetries:5,retryDelay:200});fs.mkdirSync(path.dirname(reportPath),{recursive:true});
    const report={generatedAt:new Date().toISOString(),extensionVersion:version,browser:browserVersion,scope:'Isolated browser, synthetic credentials and localhost fixtures only. Live provider credentials, pricing and image support are not tested.',passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results};fs.writeFileSync(reportPath,JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failed:report.failed}));if(report.failed)process.exitCode=1;
  }
})();
