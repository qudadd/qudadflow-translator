/* Isolated Edge MV3 with synthetic local APIs; never uses a personal profile. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),reportPath=path.resolve(process.argv[2]||'translation-recovery-results.json');
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'qudadflow-translation-recovery-')),results=[],calls=[];
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let context,worker,site,tabId,sequence=0,mode='normal',faultAt=0,operationCalls=0;
const translated=text=>'译文 '+text.replace(/Hello world/g,'你好，世界');
const server=http.createServer(async(req,res)=>{
  if(req.method==='GET'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Translation recovery fixture</title></head><body><main id="fixture"></main></body></html>');}
  let raw='';for await(const chunk of req)raw+=chunk;
  const body=JSON.parse(raw),text=body.prompt??body.messages?.at(-1)?.content??'';
  const call={text,mode,index:++operationCalls,finished:false,aborted:false};calls.push(call);
  res.on('finish',()=>{call.finished=true;});res.on('close',()=>{call.aborted=!res.writableEnded;});
  if(mode==='stream-failure'){
    res.writeHead(200,{'Content-Type':'text/event-stream'});
    res.write('data: '+JSON.stringify({choices:[{delta:{content:text.startsWith('__EDGE')?text.split('\n')[0]+'\n未完成的碎片':'未完成的碎片'}}]})+'\n\n');
    await delay(200);return res.end();
  }
  const fail=mode==='fault'&&(faultAt?call.index===faultAt:text.includes('FAIL_ONCE'));
  await delay(fail?150:35);
  if(res.destroyed)return;
  if(fail){call.failed=true;res.writeHead(429,{'Content-Type':'application/json'});return res.end('{"error":{"message":"Synthetic rate limit"}}');}
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:{translation:translated(text)}}));
});
async function check(name,fn){try{await fn();results.push({name,passed:true});console.log('PASS '+name);}catch(error){results.push({name,passed:false,error:error.stack});console.error('FAIL '+name+': '+error.message);}}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  fs.mkdirSync(path.dirname(reportPath),{recursive:true});
  try{
    const {runtimeFiles}=await import('./package-files.mjs');const extension=path.join(scratch,'extension');
    for(const name of runtimeFiles(root)){const file=path.join(extension,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.copyFileSync(path.join(root,name),file);}
    const manifest=JSON.parse(fs.readFileSync(path.join(extension,'manifest.json')));manifest.host_permissions=['http://127.0.0.1/*'];fs.writeFileSync(path.join(extension,'manifest.json'),JSON.stringify(manifest));
    context=await chromium.launchPersistentContext(path.join(scratch,'profile'),{channel:process.env.QF_BROWSER_CHANNEL||'msedge',headless:true,viewport:{width:1080,height:850},args:['--disable-extensions-except='+extension,'--load-extension='+extension]});
    worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
    const configure=async extra=>{await worker.evaluate(values=>chrome.storage.local.set(values),{apiStyle:'custom-json',endpoint:origin+'/translate',model:'',sourceLanguage:'en',targetLanguage:'zh-CN',requestTemplate:'{"prompt": {{text}}}',responsePath:'data.translation',...extra});await delay(50);};
    const flush=()=>worker.evaluate(()=>clearTranslationCache());
    const send=message=>worker.evaluate(({id,message})=>chrome.tabs.sendMessage(id,message),{id:tabId,message});
    const panel=()=>site.locator('#edge-web-translator-host');
    async function open(html){
      if(site)await site.close();mode='normal';faultAt=0;operationCalls=0;
      await configure();site=await context.newPage();site.setDefaultTimeout(10000);await site.goto(origin+'/paper/'+(++sequence));
      await site.locator('#fixture').evaluate((element,html)=>element.innerHTML=html,html);
      tabId=await worker.evaluate(async url=>(await chrome.tabs.query({})).find(tab=>tab.url===url).id,site.url());
      await worker.evaluate(id=>chrome.scripting.executeScript({target:{tabId:id},files:['src/content.js']}),tabId);
      await flush();
    }
    async function rememberCompleted(){return site.evaluate(()=>{
      const nodes=[...document.querySelectorAll('[data-edge-wt-immersive-translation]:not([data-edge-wt-pending])')];
      window.savedTranslations=nodes.map(node=>({node,text:node.textContent,parent:node.parentElement.id}));
      return window.savedTranslations.map(({text,parent})=>({text,parent}));
    });}
    const stillSame=()=>site.evaluate(()=>window.savedTranslations.every(({node,text})=>node.isConnected&&node.textContent===text));
    const waitDone=()=>site.waitForFunction(()=>document.querySelector('#edge-web-translator-host')?.shadowRoot.querySelector('.status').textContent.includes('自动补译'));
    const longText=label=>label+' '+('Hello world repeated scientific paragraph. '.repeat(165));
    let completed,before;
    await check('Immersive error keeps completed paragraphs, ends requests, and offers explicit resume',async()=>{
      await open(Array.from({length:28},(_,i)=>`<p id="p${i}">${i===12?'FAIL_ONCE ':''}PARAGRAPH_${i} ${'Hello world reading paper. '.repeat(12)}</p>`).join(''));
      mode='fault';const reply=await send({type:'TRANSLATE_IMMERSIVE'});
      assert.equal(reply.ok,false);assert.equal(reply.code,'HTTP_429');assert.equal(reply.canResume,true);
      completed=await rememberCompleted();assert.ok(completed.length>0&&completed.length<28);
      assert.equal(await site.locator('[data-edge-wt-pending]').count(),0);assert.equal(await panel().locator('.resume').isVisible(),true);
      before=calls.length;await delay(400);assert.equal(calls.length,before,'failure retried without a click');
      await site.screenshot({path:path.join(path.dirname(reportPath),'immersive-paused.png')});
    });
    await check('Resume retries missing/cancelled batches without resending or replacing completed paragraphs',async()=>{
      mode='normal';await flush();before=calls.length;await panel().locator('.resume').click();await waitDone();
      assert.equal(await site.locator('[data-edge-wt-immersive-translation]').count(),28);assert.equal(await stillSame(),true);
      for(const record of completed)assert.ok(!calls.slice(before).some(call=>new RegExp('PARAGRAPH_'+record.parent.slice(1)+'\\b').test(call.text)),'completed paragraph sent again: '+record.parent);
      assert.equal(await panel().locator('.resume').isHidden(),true);
    });
    await check('Invoking translation again keeps completed output; closing/reopening also reuses it',async()=>{
      await rememberCompleted();await flush();before=calls.length;assert.equal((await send({type:'TRANSLATE_IMMERSIVE'})).translatedCount,28);
      assert.equal(calls.length,before);assert.equal(await stillSame(),true);
      await panel().locator('.close').click();await send({type:'TRANSLATE_IMMERSIVE'});assert.equal(calls.length,before);assert.equal(await stillSame(),true);
    });
    await check('Changed paragraphs alone invalidate retained translations',async()=>{
      await site.locator('#p0').evaluate(element=>{element.firstChild.textContent='Hello world REVISED_PARAGRAPH';});
      await site.waitForFunction(()=>document.querySelector('#p0 [data-edge-wt-immersive-translation]')?.textContent.includes('REVISED_PARAGRAPH'));
      assert.equal(await site.locator('[data-edge-wt-immersive-translation]').count(),28);
      assert.equal(await site.evaluate(()=>window.savedTranslations.slice(1).every(({node})=>node.isConnected)),true);
    });
    await check('Restore removes checkpoints and the next invocation translates from the original',async()=>{
      const reply=await send({type:'RESTORE_IMMERSIVE'});assert.equal(reply.count,28);assert.equal(await site.locator('[data-edge-wt-immersive-translation]').count(),0);
      await flush();before=calls.length;await send({type:'TRANSLATE_IMMERSIVE'});assert.ok(calls.length>before);
    });
    await check('Long paragraphs resume at the first unfinished chunk, preserving completed chunks',async()=>{
      await open('<p id="long">'+longText('LONG_RESUME')+'</p>');mode='fault';faultAt=2;const start=calls.length;
      const reply=await send({type:'TRANSLATE_IMMERSIVE'});assert.equal(reply.ok,false);assert.equal(calls.length>=2,true);
      const first=calls.slice(start).find(call=>!call.failed).text;mode='normal';await flush();before=calls.length;
      await panel().locator('.resume').click();await waitDone();
      assert.ok(!calls.slice(before).some(call=>call.text===first),'completed long-paragraph chunk was sent again');
      assert.equal(await site.locator('[data-edge-wt-immersive-translation]').count(),1);assert.match(await site.locator('[data-edge-wt-immersive-translation]').textContent(),/LONG_RESUME/);
    });
    await check('Changing the model after an error keeps completed chunks available for resume',async()=>{
      await open('<p>'+longText('MODEL_CHANGE_RESUME')+'</p>');mode='fault';faultAt=2;const start=calls.length;await send({type:'TRANSLATE_IMMERSIVE'});
      const first=calls[start].text;await configure({model:'replacement-model'});mode='normal';await flush();before=calls.length;
      await panel().locator('.resume').click();await waitDone();assert.ok(!calls.slice(before).some(call=>call.text===first));
    });
    await check('Changing target language starts new translations without keeping the previous-language checkpoint',async()=>{
      await flush();before=calls.length;const reply=await send({type:'TRANSLATE_IMMERSIVE',targetLanguage:'ja'});assert.equal(reply.ok,true);assert.ok(calls.length>before);
      assert.equal(await site.locator('[data-edge-wt-immersive-translation][lang="ja"]').count(),1);
    });
    await check('Resume after changing the saved target uses the new language and discards old completed chunks',async()=>{
      await open('<p>'+longText('SAVED_TARGET_CHANGE')+'</p>');mode='fault';faultAt=2;const start=calls.length;await send({type:'TRANSLATE_IMMERSIVE'});
      const first=calls[start].text;await configure({targetLanguage:'ja'});mode='normal';before=calls.length;
      await panel().locator('.resume').click();await waitDone();assert.ok(calls.slice(before).some(call=>call.text===first));
      assert.equal(await site.locator('[data-edge-wt-immersive-translation][lang="ja"]').count(),1);
    });
    await check('Panel page translation resumes only unfinished chunks in original order',async()=>{
      await open(Array.from({length:7},(_,i)=>`<p>PAGE_CHUNK_${i} ${'Hello world scientific reading. '.repeat(46)}</p>`).join(''));
      mode='fault';faultAt=3;const start=calls.length;const reply=await send({type:'TRANSLATE_PAGE'});assert.equal(reply.ok,false);assert.equal(reply.canResume,true);assert.ok(reply.translatedCount>0);
      const partial=await panel().locator('.translation').textContent();assert.ok(partial.length>0);
      // A server can finish a response just as the other worker fails, before
      // the client accepts it. Only output committed by the client is reusable.
      const finished=calls.slice(start).filter(call=>!call.failed&&partial.includes(translated(call.text))).map(call=>call.text);
      assert.equal(finished.length,reply.translatedCount);
      await site.screenshot({path:path.join(path.dirname(reportPath),'page-paused.png')});
      mode='normal';await flush();before=calls.length;await panel().locator('.resume').click();
      await site.waitForFunction(()=>{const root=document.querySelector('#edge-web-translator-host')?.shadowRoot;return root&&root.querySelector('.status').textContent===''&&root.querySelector('.recovery').hidden;});
      assert.ok(finished.every(text=>!calls.slice(before).some(call=>call.text===text)));
      const output=await panel().locator('.translation').textContent();for(let i=0;i<7;i++)assert.ok(output.includes('PAGE_CHUNK_'+i));
      assert.ok(output.indexOf('PAGE_CHUNK_0')<output.indexOf('PAGE_CHUNK_6'));
      before=calls.length;await flush();await send({type:'TRANSLATE_PAGE'});assert.equal(calls.length,before);
    });
    await check('Page text and application route changes invalidate the matching page checkpoint',async()=>{
      await site.locator('#fixture').evaluate(element=>{element.firstChild.firstChild.textContent='Hello world UPDATED_PAGE_TEXT';});
      await flush();before=calls.length;await send({type:'TRANSLATE_PAGE'});assert.ok(calls.length>before);
      await site.evaluate(()=>history.pushState({},'',location.pathname+'?new-paper=1'));await flush();before=calls.length;
      await send({type:'TRANSLATE_PAGE'});assert.ok(calls.length>before);
    });
    await check('Interrupted stream fragments are never mistaken for completed translations',async()=>{
      await open('<p>Hello world interrupted stream.</p>');
      await configure({apiStyle:'openai-compatible',endpoint:origin+'/v1/chat/completions',model:'synthetic-model'});mode='stream-failure';
      const reply=await send({type:'TRANSLATE_IMMERSIVE'});assert.equal(reply.ok,false);assert.equal(reply.canResume,true);
      assert.equal(await site.locator('[data-edge-wt-immersive-translation]').count(),0);assert.equal(await panel().locator('.resume').isVisible(),true);
      await configure();mode='normal';before=calls.length;await panel().locator('.resume').click();await waitDone();
      assert.ok(calls.length>before);assert.doesNotMatch(await site.locator('[data-edge-wt-immersive-translation]').textContent(),/未完成的碎片/);
    });
    await check('Missing host access opens a visible authorization surface for browser commands',async()=>{
      const result=await worker.evaluate(async()=>{
        const contains=chrome.permissions.contains,open=chrome.action.openPopup;let opened=0;
        chrome.permissions.contains=(_args,callback)=>callback(false);chrome.action.openPopup=async()=>{opened++;};
        try{return {allowed:await ensureWebsiteAccess({id:1,url:'https://ungranted.example/paper'}),opened};}
        finally{chrome.permissions.contains=contains;chrome.action.openPopup=open;}
      });assert.deepEqual(result,{allowed:false,opened:1});
    });
    await check('Missing API permission opens authorization; unsupported popup APIs fall back to Settings',async()=>{
      await open('<p>Hello world missing API access.</p>');
      await worker.evaluate(()=>{globalThis.recoveryPopupOriginal=chrome.action.openPopup;globalThis.recoveryPopupCount=0;chrome.action.openPopup=async()=>{globalThis.recoveryPopupCount++;};});
      try{
        await configure({endpoint:'https://ungranted-provider.invalid/translate'});
        const reply=await send({type:'TRANSLATE_IMMERSIVE'});assert.equal(reply.code,'PERMISSION_REQUIRED');
        assert.equal(await worker.evaluate(()=>globalThis.recoveryPopupCount),1);
      }finally{await worker.evaluate(()=>{chrome.action.openPopup=globalThis.recoveryPopupOriginal;delete globalThis.recoveryPopupOriginal;delete globalThis.recoveryPopupCount;});}
      const fallback=await worker.evaluate(async()=>{
        const contains=chrome.permissions.contains,open=chrome.action.openPopup,create=chrome.tabs.create;let url='';
        chrome.permissions.contains=(_args,callback)=>callback(false);chrome.action.openPopup=async()=>{throw new Error('Unsupported browser popup API');};chrome.tabs.create=async args=>{url=args.url;};
        try{return {allowed:await ensureWebsiteAccess({id:1,url:'https://ungranted.example/paper'}),url};}
        finally{chrome.permissions.contains=contains;chrome.action.openPopup=open;chrome.tabs.create=create;}
      });assert.equal(fallback.allowed,false);assert.ok(fallback.url.endsWith('/options.html#permissionSettings'));
    });
  }catch(error){results.push({name:'setup',passed:false,error:error.stack});console.error(error);}
  finally{
    await context?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
    assert.ok(path.resolve(scratch).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(scratch).startsWith('qudadflow-translation-recovery-'));
    fs.rmSync(scratch,{recursive:true,force:true,maxRetries:5,retryDelay:200});
    const report={version:JSON.parse(fs.readFileSync(path.join(root,'manifest.json'))).version,scope:'Isolated Edge MV3, generated HTML and synthetic local API errors/streams. No real-model quality assessment.',passed:results.filter(result=>result.passed).length,failed:results.filter(result=>!result.passed).length,results};
    fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,failed:report.failed}));if(report.failed)process.exitCode=1;
  }
})();
