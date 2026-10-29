/* Isolated Edge; local fixtures and mock AI only. Does not access a user profile. */
async function workbenchView(page,stage){await page.locator('#figureWorkflow').evaluate(e=>e.open=true);const tab=page.locator('#figure-tab-'+stage);if(await tab.getAttribute('aria-selected')!=='true')await tab.click();if(stage==='acquire'){const manual=page.locator('.workbench-manual');if(await manual.count())await manual.evaluate(e=>e.open=true);}if(stage==='gallery'){const supplement=page.locator('.workbench-web-supplement');if(await supplement.count())await supplement.evaluate(e=>e.open=true);}}
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),reportPath=path.resolve(process.argv[2]||'research-vision-results.json'),version=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'))).version;
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'qudadflow-vision-')),results=[],calls=[],errors=[];
const png=fs.readFileSync(path.join(root,'assets/icon128.png')),delay=ms=>new Promise(r=>setTimeout(r,ms));let context,worker,base,origin,companion,mode='normal';
const visual='<!doctype html><meta charset="utf-8"><title>Visual table fixture</title><style>body{font:18px Arial;padding:30px}.grid{display:grid;grid-template-columns:180px 180px;width:360px}.grid div{border-bottom:1px solid #ddd;padding:14px}h2{color:#315bc7}</style><article><h1>Visual research evidence</h1><p>Comparison of two synthetic cohorts. No causal conclusion is supported. See Table 2 for outcomes.</p></article><div id="chart"><h2>Table 2. Cohort outcomes</h2><div class="grid"><div>Group</div><div>Response (%)</div><div>Treatment</div><div>42.5</div><div>Control</div><div>31.0</div></div><p>Illustrative fixture; not clinical evidence.</p></div><div style="height:1800px"></div>';
const server=http.createServer(async(req,res)=>{
  if(req.method==='GET'){
    if(req.url.startsWith('/image')){res.writeHead(200,{'Content-Type':'image/png'});return res.end(png);}
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(visual);
  }
  let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw),record={body,aborted:false};calls.push(record);res.on('close',()=>record.aborted=!res.writableEnded);
  res.writeHead(200,{'Content-Type':'text/event-stream'});res.write('data: '+JSON.stringify({choices:[{delta:{content:'## Table 2 (simulated)\n\n'}}]})+'\n\n');
  if(mode==='stall')return;
  if(mode==='burst'||mode==='codeburst'){
    const code=mode==='codeburst',send=text=>res.write('data: '+JSON.stringify({choices:[{delta:{content:text}}]})+'\n\n');
    if(code)send('```python\n');
    for(let i=0;i<60&&!res.destroyed;i++){send(code?'# evidence '+i+'\n':'Evidence '+i+'; ');await delay(8);}
    if(res.destroyed)return;
    send(code?'print("FINAL_BURST")\n```\n':'\n\nFINAL_BURST');return res.end('data: [DONE]\n\n');
  }
  await delay(50);res.end('data: '+JSON.stringify({choices:[{delta:{content:'| Group | Response (%) |\n| --- | --- |\n| Treatment | 42.5 |\n| Control | 31.0 |\n\nUnverified transcription; compare with the image.'}}]})+'\n\ndata: [DONE]\n\n');
});
async function check(name,fn){try{await fn();results.push({name,passed:true});console.log('PASS '+name);}catch(error){results.push({name,passed:false,error:error.stack});console.log('FAIL '+name+': '+error.message);}finally{mode='normal';}}
async function tabId(page){return worker.evaluate(async url=>(await chrome.tabs.query({})).find(t=>t.url===url).id,page.url());}
async function extract(page){return worker.evaluate(async id=>(await chrome.scripting.executeScript({target:{tabId:id},files:['src/research-capture.js']}))[0].result,await tabId(page));}
async function settled(page){await page.waitForFunction(()=>!document.querySelector('#importFigure').disabled);}
async function paste(page,buffer){return page.evaluate(bytes=>{const data=new DataTransfer();data.items.add(new File([new Uint8Array(bytes)],'pasted-table.png',{type:'image/png'}));const event=new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true});document.querySelector('.figure-paste-hint').dispatchEvent(event);return event.defaultPrevented;},Array.from(buffer));}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;fs.mkdirSync(path.dirname(reportPath),{recursive:true});
  try{
    const extension=path.join(scratch,'extension');fs.mkdirSync(extension);for(const name of ['manifest.json','offscreen-translation.html','popup.html','popup.css','popup.js','reader.html','reader.css','reader.js','research.html','research.css','research.js','options.html','options.css','options.js','privacy.html','src','vendor','assets','_locales'])fs.cpSync(path.join(root,name),path.join(extension,name),{recursive:true});
    const manifest=JSON.parse(fs.readFileSync(path.join(extension,'manifest.json')));manifest.host_permissions=['<all_urls>'];fs.writeFileSync(path.join(extension,'manifest.json'),JSON.stringify(manifest));
    context=await chromium.launchPersistentContext(path.join(scratch,'profile'),{channel:'msedge',headless:true,viewport:{width:1280,height:1000},args:['--disable-extensions-except='+extension,'--load-extension='+extension]});context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
    worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');base='chrome-extension://'+new URL(worker.url()).host+'/';
    await worker.evaluate(endpoint=>chrome.storage.local.set({apiStyle:'openai-compatible',endpoint,apiKey:'SYNTHETIC-VISION-KEY',model:'fixture-vision',targetLanguage:'zh-CN',streamOpenAi:true}),origin+'/v1/chat/completions');
    await check('Generic capture includes semantic sibling figures and image tables but excludes hidden, navigation and unrelated panels',async()=>{
      const site=await context.newPage();await site.goto(origin+'/semantics');await site.setContent('<article><h1>Paper</h1><p>'+('Substantive study evidence. '.repeat(60))+'</p><figure><img src="/image-1" width="200" height="100"><figcaption>Figure 1. Internal</figcaption></figure></article><section class="figure-panel"><div class="figure-image"><img src="/image-2" width="200" height="100"></div><p class="figure-caption">Figure 2. Sibling panel</p></section><div class="table-wrap"><img src="/image-3" width="200" height="100"><div class="caption">Table 1. Image table</div></div><nav><figure><img src="/image-nav"></figure></nav><aside><figure><img src="/image-aside"></figure></aside><figure hidden><img src="/image-hidden"></figure><img src="/image-banner" width="400" height="200">');
      const capture=await extract(site);assert.equal(capture.figures.length,3);assert.ok(capture.figures.some(f=>f.caption==='Figure 2. Sibling panel'));assert.ok(capture.figures.some(f=>f.caption==='Table 1. Image table'));assert.equal(calls.length,0);await site.close();
    });
    let shot,visualSite;
    await check('One paper entry extracts locally, flags a referenced CSS table, then supplements the same window without losing edits or questions',async()=>{
      visualSite=await context.newPage();await visualSite.goto(origin+'/visual?access=SYNTHETIC-PRIVATE');assert.equal((await extract(visualSite)).tables.length,0);shot=await visualSite.locator('#chart').screenshot();
      const popup=await context.newPage();await visualSite.bringToFront();await popup.goto(base+'popup.html');await popup.waitForFunction(()=>document.querySelector('#selection').textContent!=='正在读取选中文本…');
      assert.equal(await popup.locator('#captureResearchView').count(),0);
      const opened=context.waitForEvent('page');await popup.evaluate(()=>document.querySelector('#openResearch').click());companion=await opened;await companion.waitForFunction(()=>!document.querySelector('#supplementResearchView').disabled);
      assert.equal(await companion.locator('.figure-card').count(),0);assert.match(await companion.locator('#coverageIssues').textContent(),/Table 2.*未匹配/);assert.equal(calls.length,0);
      await workbenchView(companion,'analysis');await companion.locator('#researchQuestion').fill('KEEP_MY_QUESTION');await companion.evaluate(()=>{const material=document.querySelector('#paperMaterial');material.value+='\nKEEP_MY_EDITS';material.dispatchEvent(new Event('input'));});
      const pageCount=context.pages().length;await workbenchView(companion,'gallery');await companion.locator('#supplementResearchView').click();await companion.waitForFunction(()=>document.querySelector('.figure-card img')?.complete);
      assert.equal(context.pages().length,pageCount);assert.match(await companion.locator('#paperMaterial').inputValue(),/KEEP_MY_EDITS/);assert.equal(await companion.locator('#researchQuestion').inputValue(),'KEEP_MY_QUESTION');
      assert.match(await companion.locator('.figure-card').textContent(),/补图 · 当前视区/);assert.match(await companion.locator('.figure-card img').getAttribute('src'),/^data:image\/jpeg;base64,/);assert.equal(await companion.locator('.figure-choice input:checked').count(),0);assert.equal(calls.length,0);assert.match(await companion.locator('#paperSource').getAttribute('href'),/\/visual$/);
      await companion.screenshot({path:path.join(path.dirname(reportPath),'qudadflow-visual-fallback-v'+version+'.png')});
    });
    await check('Supplement rejects scrolling during capture and creates no misleading image or window',async()=>{
      await visualSite.bringToFront();const id=await tabId(visualSite),before=context.pages().length;
      const captureId=new URLSearchParams(new URL(companion.url()).hash.slice(1)).get('capture');
      const failure=await worker.evaluate(async({id,captureId})=>{const original=chrome.tabs.captureVisibleTab;chrome.tabs.captureVisibleTab=async()=>{await chrome.scripting.executeScript({target:{tabId:id},func:()=>scrollBy(0,100)});return 'data:image/png;base64,AAAA';};try{await supplementResearchView(captureId);return '';}catch(error){return error.message;}finally{chrome.tabs.captureVisibleTab=original;}},{id,captureId});
      assert.match(failure,/页面已切换／滚动/);assert.equal(context.pages().length,before);assert.equal(calls.length,0);
      await visualSite.evaluate(()=>scrollTo(0,0));
    });
    await check('Duplicate supplementation is idempotent and stored previews do not expose browser binding or raw URL queries',async()=>{
      await delay(600);await workbenchView(companion,'gallery');await companion.locator('#supplementResearchView').click();await settled(companion);assert.equal(await companion.locator('.figure-card').count(),1);assert.match(await companion.locator('#supplementStatus').textContent(),/相同截图/);assert.equal(calls.length,0);
      const captureId=new URLSearchParams(new URL(companion.url()).hash.slice(1)).get('capture'),capture=await worker.evaluate(id=>QFResearch.captureGet(id),captureId);assert.equal(capture.binding,undefined);assert.equal(capture.href,undefined);assert.doesNotMatch(JSON.stringify(capture),/SYNTHETIC-PRIVATE/);assert.equal(capture.supplements.length,1);assert.equal(capture.canSupplement,true);assert.match(capture.supplements[0].data,/^data:image\/jpeg/);
    });
    await check('Reopening captured material restores local supplement previews without sending AI or selecting images',async()=>{
      const restored=await context.newPage();await restored.goto(companion.url());await restored.waitForFunction(()=>document.querySelector('.figure-card img')?.complete);assert.equal(await restored.locator('.figure-card').count(),1);assert.equal(await restored.locator('.figure-choice input:checked').count(),0);assert.equal(calls.length,0);
      for(const width of [1440,620]){await restored.setViewportSize({width,height:1050});assert.ok(await restored.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await restored.screenshot({path:path.join(path.dirname(reportPath),'qudadflow-research-flow-'+width+'-v'+version+'.png')});}
      await restored.close();await visualSite.bringToFront();
    });
    await check('PNG screenshot import retains provenance, does not select/send it, and detects duplicate content',async()=>{
      await companion.locator('#figureImageFile').setInputFiles({name:'table.png',mimeType:'image/png',buffer:shot});await settled(companion);assert.equal(await companion.locator('.figure-card').count(),2);assert.equal(calls.length,0);assert.equal(await companion.locator('.figure-choice input:checked').count(),0);
      await companion.locator('#figureImageFile').setInputFiles({name:'renamed-table.png',mimeType:'image/png',buffer:shot});await settled(companion);assert.equal(await companion.locator('.figure-card').count(),2);assert.match(await companion.locator('#figureStatus').textContent(),/重复/);
    });
    await check('JPEG and WebP imports decode locally and normalize to bounded JPEG previews',async()=>{
      for(const type of ['jpeg','webp']){const data=await companion.evaluate(type=>{const canvas=document.createElement('canvas');canvas.width=1700;canvas.height=80;const ctx=canvas.getContext('2d');ctx.fillStyle=type==='jpeg'?'#315bc7':'#009988';ctx.fillRect(0,0,1700,80);return canvas.toDataURL('image/'+type);},type);await companion.locator('#figureImageFile').setInputFiles({name:'plot.'+type,mimeType:'image/'+type,buffer:Buffer.from(data.split(',')[1],'base64')});await settled(companion);}
      assert.equal(await companion.locator('.figure-card').count(),4);assert.equal(await companion.locator('.figure-card img').last().evaluate(img=>img.naturalWidth),1600);assert.equal(calls.length,0);
    });
    await check('Clipboard accepts an image while ordinary text paste stays available',async()=>{
      assert.equal(await paste(companion,png),true);await settled(companion);assert.equal(await companion.locator('.figure-card').count(),5);assert.equal(calls.length,0);
      const prevented=await companion.evaluate(()=>{const data=new DataTransfer();data.setData('text/plain','A normal research question');const event=new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true});document.querySelector('#researchQuestion').dispatchEvent(event);return event.defaultPrevented;});assert.equal(prevented,false);
    });
    await check('Unsupported, oversized and corrupt files are rejected without adding cards or network calls',async()=>{
      for(const [name,mimeType,buffer,expected]of [['unsafe.svg','image/svg+xml',Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),/仅支持/],['large.png','image/png',Buffer.alloc(10*1024*1024+1),/10 MB/],['corrupt.png','image/png',Buffer.from('not an image'),/载入 0/]]){await companion.locator('#figureImageFile').setInputFiles({name,mimeType,buffer});await settled(companion);assert.match(await companion.locator('#figureStatus').textContent(),expected);assert.equal(await companion.locator('.figure-card').count(),5);}assert.equal(calls.length,0);
    });
    await check('Explicit image-table analysis sends pixels and row/column transcription rules and renders Markdown tables safely',async()=>{
      await workbenchView(companion,'analysis');const card=companion.locator('.figure-card').nth(1);await card.getByText('翻译图文并解释',{exact:true}).click();await companion.waitForFunction(()=>document.querySelector('#figureStatus').textContent.includes('已完成'));
      const body=calls.at(-1).body;assert.match(body.messages[0].content,/Markdown table/);assert.match(body.messages[0].content,/multi-level header/);assert.match(body.messages[0].content,/\[unreadable\]/);assert.ok(body.messages[1].content.some(p=>p.type==='image_url'));assert.match(body.messages[1].content.find(p=>p.type==='text').text,/\/visual/);assert.equal(await card.locator('.figure-output table').count(),1);assert.equal(await card.locator('.figure-output img').count(),0);
    });
    await check('Import is unavailable during AI analysis and paste cannot change the active request',async()=>{
      mode='stall';await workbenchView(companion,'analysis');const card=companion.locator('.figure-card').first();await card.getByText('用 AI 补读图表',{exact:true}).click();await companion.waitForFunction(()=>document.querySelector('.figure-output').textContent.includes('Table 2'));
      assert.equal(await companion.locator('#supplementResearchView').isDisabled(),true);assert.match(await card.locator('.figure-verification').textContent(),/待核对/);
      assert.equal(await companion.locator('#importFigure').isDisabled(),true);const count=await companion.locator('.figure-card').count();await paste(companion,shot);assert.match(await companion.locator('#figureStatus').textContent(),/等待当前.*任务/);assert.equal(await companion.locator('.figure-card').count(),count);await companion.locator('#stopFigures').click();await settled(companion);
    });
    await check('Streaming renderer coalesces rapid fragments and immediately flushes final text without duplicate DOM replacement',async()=>{
      const result=await companion.evaluate(async()=>{
        const {createResearchRenderer}=await import('./src/research-render.mjs'),element=document.createElement('div');document.body.append(element);
        let renders=0;const observer=new MutationObserver(records=>renders+=records.filter(r=>r.target===element).length);observer.observe(element,{childList:true});
        const renderer=createResearchRenderer(element);for(let i=0;i<200;i++)renderer.update('Evidence '+i);
        const before=element.textContent;await new Promise(r=>setTimeout(r,200));const intermediate=element.textContent;
        renderer.update('FINAL_MARKER',true);const final=element.textContent;renderer.update('FINAL_MARKER',true);await Promise.resolve();
        observer.disconnect();renderer.cancel();element.remove();return {before,intermediate,final,renders};
      });assert.deepEqual(result,{before:'',intermediate:'Evidence 199',final:'FINAL_MARKER',renders:2});
    });
    await check('Stopping flushes received text and clearing a view prevents a queued render from reviving old content',async()=>{
      const result=await companion.evaluate(async()=>{
        const {createResearchRenderer}=await import('./src/research-render.mjs'),element=document.createElement('div');document.body.append(element);const renderer=createResearchRenderer(element);
        renderer.update('partial before stop');renderer.flush();const stopped=element.textContent;renderer.update('stale old document');renderer.cancel();element.textContent='new document';await new Promise(r=>setTimeout(r,200));const cleared=element.textContent;
        renderer.update('partial before stop',true);const reused=element.textContent;renderer.cancel();element.remove();return {stopped,cleared,reused};
      });assert.deepEqual(result,{stopped:'partial before stop',cleared:'new document',reused:'partial before stop'});
    });
    for(const [scenario,button,status]of [['burst','翻译图文并解释','已完成'],['codeburst','生成 Python','尚未执行']])await check('Rapid '+scenario+' output preserves all content while batching visible DOM updates',async()=>{
      await workbenchView(companion,'analysis');const card=companion.locator('.figure-card').nth(1);await companion.evaluate(()=>{window.streamRenders=0;window.streamObserver=new MutationObserver(records=>{window.streamRenders+=records.filter(r=>r.target instanceof Element&&r.target.matches('.figure-output')).length;});window.streamObserver.observe(document.querySelector('#figureCards'),{childList:true,subtree:true});});
      mode=scenario;await card.getByText(button,{exact:true}).click();await companion.waitForFunction(expected=>document.querySelector('#figureStatus').textContent.includes(expected),status);
      const renders=await companion.evaluate(()=>{window.streamObserver.disconnect();return window.streamRenders;});assert.ok(renders>=2&&renders<=10,'Expected bounded renders; got '+renders);
      const output=card.locator(scenario==='burst'?'.figure-output':'.code-output .figure-output').last();const text=await output.textContent();assert.match(text,/FINAL_BURST/);assert.match(text,scenario==='burst'?/Evidence 59/:/evidence 59/);
    });
    await check('Viewport preview preserves all 100 source candidates and reports candidates beyond the storage limit',async()=>{
      const result=await worker.evaluate(async()=>{
        const figures=[{id:'viewport',kind:'viewport'},...Array.from({length:101},(_,i)=>({id:'figure-'+i,kind:'img',src:'https://example.org/figure-'+i+'.png'}))];
        const id=await QFResearch.capturePut({source:{title:'Synthetic capacity fixture'},text:'fixture',figures});try{const stored=await QFResearch.captureGet(id);return {count:stored.figures.length,last:stored.figures.at(-1).id,notice:stored.captureNotice};}finally{await QFResearch.captureDelete(id);}
      });assert.equal(result.count,101);assert.equal(result.last,'figure-99');assert.match(result.notice,/1 个图表候选未保留/);
    });
    await check('Remote figure metadata lookup avoids decoding stored images and still rejects expired captures',async()=>{
      const result=await worker.evaluate(async()=>{
        const id=await QFResearch.capturePut({text:'synthetic evidence',figures:[{id:'plot',src:'https://example.org/plot.png',caption:'Plot fixture',data:'data:image/jpeg;base64,AAAA'}]});
        const original=Blob.prototype.arrayBuffer;let decoded=0;Blob.prototype.arrayBuffer=function(...args){decoded++;return original.apply(this,args);};
        try{const figure=await QFResearch.captureFigure(id,0);await QFResearch.captureDelete(id);let missing='';try{await QFResearch.captureFigure(id,0);}catch(error){missing=error.message;}return {figure,decoded,missing};}finally{Blob.prototype.arrayBuffer=original;await QFResearch.captureDelete(id);}
      });assert.deepEqual(result.figure,{id:'plot',src:'https://example.org/plot.png',caption:'Plot fixture'});assert.equal(result.decoded,0);assert.match(result.missing,/已过期/);
    });
    await check('Document reader shares screenshot import and discards an in-flight import when a new document replaces the source',async()=>{
      const reader=await context.newPage();await reader.goto(base+'reader.html');await reader.locator('#file').setInputFiles({name:'first.txt',mimeType:'text/plain',buffer:Buffer.from('First research document')});await reader.waitForFunction(()=>document.querySelector('#status').textContent.includes('文档已打开'));await reader.locator('#figureWorkflow').evaluate(e=>e.open=true);
      await reader.locator('#figureImageFile').setInputFiles({name:'document-table.png',mimeType:'image/png',buffer:shot});await settled(reader);assert.equal(await reader.locator('.figure-card').count(),1);
      await reader.evaluate(()=>{window.originalDecode=createImageBitmap;window.decodeStarted=false;window.createImageBitmap=async(...args)=>{window.decodeStarted=true;await new Promise(resolve=>window.releaseDecode=resolve);return window.originalDecode(...args);};});
      await reader.locator('#figureImageFile').setInputFiles({name:'pending.png',mimeType:'image/png',buffer:png});await reader.waitForFunction(()=>window.decodeStarted);
      await reader.locator('#file').setInputFiles({name:'second.md',mimeType:'text/markdown',buffer:Buffer.from('# Second research document')});await reader.waitForFunction(()=>document.querySelector('#status').textContent.includes('文档已打开'));await reader.evaluate(()=>{window.createImageBitmap=window.originalDecode;window.releaseDecode();});await delay(100);assert.equal(await reader.locator('.figure-card').count(),0);await reader.close();
    });
    await check('AI supplement can feed paper Q&A and never rewrites captured material or clears existing answers',async()=>{
      const originalText=await companion.locator('#paperMaterial').inputValue(),card=companion.locator('.figure-card').first();await card.getByText('用 AI 补读图表',{exact:true}).click();await companion.waitForFunction(()=>document.querySelector('#figureStatus').textContent.includes('已完成'));assert.match(await card.locator('.figure-verification').textContent(),/待核对/);assert.equal(await companion.locator('#paperMaterial').inputValue(),originalText);
      await card.getByText('结合此图提问',{exact:true}).click();await workbenchView(companion,'analysis');await companion.locator('#analyzePaper').click();await companion.waitForFunction(()=>document.querySelector('#paperStatus').textContent.startsWith('分析完成'));assert.ok(calls.at(-1).body.messages[1].content.some(p=>p.type==='image_url'));
      const answer=await companion.locator('#paperOutput').textContent(),requestCount=calls.length;await visualSite.evaluate(()=>scrollTo(0,200));await visualSite.bringToFront();await delay(600);await workbenchView(companion,'gallery');await companion.locator('#supplementResearchView').click();await settled(companion);assert.match(await companion.locator('#supplementStatus').textContent(),/截图已加入/);assert.equal(await companion.locator('#paperOutput').textContent(),answer);assert.equal(await companion.locator('#paperMaterial').inputValue(),originalText);assert.equal(calls.length,requestCount);
    });
    await check('Original-tab activation is explicit; another active tab cannot be captured into this paper',async()=>{
      const other=await context.newPage();await other.goto(origin+'/another');const before=await companion.locator('.figure-card').count();await workbenchView(companion,'gallery');await companion.locator('#supplementResearchView').click();await settled(companion);assert.match(await companion.locator('#supplementStatus').textContent(),/其他标签页/);assert.equal(await companion.locator('.figure-card').count(),before);
      await workbenchView(companion,'gallery');await companion.locator('#focusResearchSource').click();await settled(companion);assert.equal(await worker.evaluate(async id=>(await chrome.tabs.get(id)).active,await tabId(visualSite)),true);await other.close();
    });
    await check('Switching away and back during screenshot capture cannot bypass source checks',async()=>{
      const other=await context.newPage();await other.goto(origin+'/interrupted');const otherId=await tabId(other),id=await tabId(visualSite),captureId=new URLSearchParams(new URL(companion.url()).hash.slice(1)).get('capture');await visualSite.bringToFront();
      const failure=await worker.evaluate(async({id,otherId,captureId})=>{const original=chrome.tabs.captureVisibleTab;chrome.tabs.captureVisibleTab=async()=>{await chrome.tabs.update(otherId,{active:true});await chrome.tabs.update(id,{active:true});return 'data:image/png;base64,AAAA';};try{await supplementResearchView(captureId);return '';}catch(error){return error.message;}finally{chrome.tabs.captureVisibleTab=original;}},{id,otherId,captureId});assert.match(failure,/页面已切换／滚动/);await other.close();
    });
    await check('Same-document URL changes, reloads, closed tabs, lost permission and expired captures fail without adding images',async()=>{
      const id=new URLSearchParams(new URL(companion.url()).hash.slice(1)).get('capture'),before=await companion.locator('.figure-card').count();
      await visualSite.evaluate(()=>history.pushState({},'',location.pathname+'?different-paper=1'));await workbenchView(companion,'gallery');await companion.locator('#supplementResearchView').click();await settled(companion);assert.match(await companion.locator('#supplementStatus').textContent(),/切换或跳转/);await visualSite.evaluate(()=>history.replaceState({},'',location.pathname));
      const permissionsError=await worker.evaluate(async id=>{const original=chrome.scripting.executeScript;chrome.scripting.executeScript=async()=>{throw new Error('Synthetic permission loss');};try{await supplementResearchView(id);}catch(error){return error.message;}finally{chrome.scripting.executeScript=original;}},id);assert.match(permissionsError,/授权失效/);
      await visualSite.reload();await workbenchView(companion,'gallery');await companion.locator('#supplementResearchView').click();await settled(companion);assert.match(await companion.locator('#supplementStatus').textContent(),/刷新/);await visualSite.close();await workbenchView(companion,'gallery');await companion.locator('#supplementResearchView').click();await settled(companion);assert.match(await companion.locator('#supplementStatus').textContent(),/关闭/);assert.equal(await companion.locator('.figure-card').count(),before);
      await worker.evaluate(id=>QFResearch.captureDelete(id),id);await workbenchView(companion,'gallery');await companion.locator('#supplementResearchView').click();await settled(companion);assert.match(await companion.locator('#supplementStatus').textContent(),/已过期/);
    });
    await check('Webpages and other extension views cannot invoke source-focus or screenshot messages',async()=>{
      const site=await context.newPage();await site.goto(origin+'/caller');const id=await tabId(site),before=calls.length;
      for(const type of ['RESEARCH_FOCUS_SOURCE','RESEARCH_SUPPLEMENT_VIEW']){const denied=await worker.evaluate(async({id,type})=>(await chrome.scripting.executeScript({target:{tabId:id},func:type=>chrome.runtime.sendMessage({type,id:'not-a-capture'}),args:[type]}))[0].result,{id,type});assert.equal(denied.ok,false);assert.match(denied.error,/仅限扩展/);}
      const reader=await context.newPage();await reader.goto(base+'reader.html');assert.equal((await reader.evaluate(()=>chrome.runtime.sendMessage({type:'RESEARCH_SUPPLEMENT_VIEW',id:'not-a-capture'}))).ok,false);assert.equal(calls.length,before);await reader.close();await site.close();
    });
    await check('Screenshot controls and table previews fit a narrow companion',async()=>{await companion.setViewportSize({width:620,height:1000});assert.ok(await companion.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await companion.evaluate(()=>scrollTo(0,0));await companion.screenshot({path:path.join(path.dirname(reportPath),'qudadflow-visual-import-620-v'+version+'.png')});});
    await check('No uncaught browser errors',async()=>assert.deepEqual(errors,[]));
  }catch(error){results.push({name:'setup',passed:false,error:error.stack});console.error(error);}
  finally{await context?.close();server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(scratch,{recursive:true,force:true,maxRetries:5,retryDelay:200});const report={version,scope:'Isolated Edge with a test-only all-host grant, synthetic credentials, local HTML/image fixtures and simulated AI. No live AI accuracy claim.',passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results};fs.writeFileSync(reportPath,JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failed:report.failed}));if(report.failed)process.exitCode=1;}
})();
