/* Isolated Edge, synthetic provider only. AI code is never executed. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {workbenchView,inspectFigure,figureView,closeInspector,removeFigure}=require('./figure-ui-test.cjs');
const root=path.resolve(__dirname,'..'),reportPath=path.resolve(process.argv[2]||'figure-workflow-results.json');
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'qf-figure-workflow-')),results=[],calls=[],errors=[];
const png=fs.readFileSync(path.join(root,'assets/icon128.png'));let context,mode='spec',spec,origin,release;
async function check(name,fn){try{await fn();results.push({name,passed:true});console.log('PASS '+name);}catch(error){results.push({name,passed:false,error:error.stack});console.error('FAIL '+name+': '+error.message);}}
const server=http.createServer(async(req,res)=>{
  if(req.method==='GET'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({data:[{id:'fixture-vision'}]}));}
  let raw='';for await(const part of req)raw+=part;const body=JSON.parse(raw),instructions=body.messages?.[0]?.content||body.instructions||'',content=body.messages?.at(-1)?.content||body.input?.[0]?.content;
  calls.push({instructions,content});let text='Recognized figure. Values missing; original data required.';
  if(instructions.includes('Generate a reproducibility draft')){
    const revised=structuredClone(spec);if(mode==='revision'||mode==='bad-revision')revised.style.fontSize=11;
    if(mode==='bad-revision')revised.panels[0].interval.kind='ci';if(mode==='custom')revised.panels[0].type='custom';
    text=mode==='legacy'?'Unstructured draft, not executed.':mode==='bad-json'?'```json\n{"schema":"qudadflow.figure/v1",\n```':'```json\n'+JSON.stringify(revised)+'\n```';
    text+='\n```'+(instructions.includes('R (ggplot2)')?'r\n# CUSTOM_R_DRAFT':'python\nprint("MODEL_CUSTOM_DRAFT")')+'\n```';
  }
  res.writeHead(200,{'Content-Type':'text/event-stream'});
  const delta=text=>'data: '+JSON.stringify({choices:[{delta:{content:text}}]})+'\n\n';
  if(mode==='stream'){res.write(delta('STREAM_PROGRESS: recognized axes. '));release=()=>res.end(delta('STREAM_COMPLETE: completed interpretation.')+'data: [DONE]\n\n');}
  else res.end(delta(text)+'data: [DONE]\n\n');
});
(async()=>{
  try{
    const {exampleSpec}=await import('./fixtures/figure-example.mjs');spec=exampleSpec();spec.data={file:'data.csv',status:'missing',source:'Synthetic UI fixture; not scientific evidence',notes:'No observations supplied.'};
    await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
    fs.mkdirSync(path.dirname(reportPath),{recursive:true});
    const {runtimeFiles}=await import('./package-files.mjs'),extension=path.join(scratch,'extension');
    for(const name of runtimeFiles(root)){const dest=path.join(extension,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,name),dest);}
    const manifest=JSON.parse(fs.readFileSync(path.join(extension,'manifest.json')));manifest.host_permissions=['http://127.0.0.1/*'];fs.writeFileSync(path.join(extension,'manifest.json'),JSON.stringify(manifest));
    context=await chromium.launchPersistentContext(path.join(scratch,'profile'),{channel:'msedge',headless:true,viewport:{width:1440,height:1100},args:['--disable-extensions-except='+extension,'--load-extension='+extension]});
    const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),base='chrome-extension://'+new URL(worker.url()).host+'/';
    await worker.evaluate(endpoint=>chrome.storage.local.set({apiStyle:'openai-compatible',endpoint,apiKey:'SYNTHETIC-FIGURE-KEY',model:'fixture-vision',targetLanguage:'zh-CN',streamOpenAi:true}),origin+'/v1/chat/completions');
    context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
    const page=await context.newPage();await page.goto(base+'research.html');
    page.setDefaultTimeout(10000);
    await page.waitForFunction(()=>!document.querySelector('#figureImageFile')?.disabled);
    await page.locator('#figureImageFile').setInputFiles({name:'fixture.png',mimeType:'image/png',buffer:png});
    await page.waitForFunction(()=>document.querySelectorAll('.figure-card').length===1&&!document.querySelector('#importFigure').disabled);
    const card=await inspectFigure(page),status=page.locator('#figureStatus');
    await check('Gallery opens a native modal; Esc restores the launching tile focus',async()=>{
      assert.equal(await page.locator('#figureInspector:modal').count(),1);
      assert.equal(await card.isVisible(),true);await page.keyboard.press('Escape');
      assert.equal(await page.locator('#figureInspector[open]').count(),0);
      assert.equal(await page.evaluate(()=>document.activeElement?.textContent),'打开解析浮窗');
      await inspectFigure(page);
    });
    await check('Maximize and restore keep the live card and selected tab',async()=>{
      await figureView(page,'python');await page.locator('#maximizeFigureInspector').click();
      assert.equal(await page.locator('#maximizeFigureInspector').getAttribute('aria-pressed'),'true');
      assert.ok(await page.locator('#figureInspector').evaluate(e=>e.clientWidth>=innerWidth-2));
      await page.locator('#maximizeFigureInspector').click();await figureView(page,'analysis');
      assert.equal(await page.locator('#maximizeFigureInspector').getAttribute('aria-pressed'),'false');
    });
    await card.getByText('翻译图文并解释',{exact:true}).click();await page.waitForFunction(()=>document.querySelector('#figureStatus').textContent.includes('已完成'));
    const generate=async language=>{await figureView(page,language);await card.getByText('生成 '+(language==='r'?'R':'Python'),{exact:true}).click();await page.waitForFunction(()=>document.querySelector('#figureStatus').textContent.includes('尚未执行'));};
    const download=async (panel,label)=>{const target=panel.getByText(label,{exact:true});if(!await target.isVisible())await panel.locator('.figure-code-material').evaluate(e=>e.open=true);const pending=page.waitForEvent('download');await target.click();return fs.readFileSync(await(await pending).path(),'utf8');};
    const panels=card.locator('.code-output section');
    await check('Recognized JSON compiles bundled Python code; model code remains inert',async()=>{await generate('python');assert.match(await status.textContent(),/共用规格/);const code=await download(panels.first(),'下载 .py');assert.match(code,/def prepare/);assert.doesNotMatch(code,/MODEL_CUSTOM_DRAFT/);assert.match(calls.at(-1).instructions,/Never relabel SD/);});
    await check('Dedicated code frame copies exact source; wrap and native focus view preserve the editor',async()=>{
      const editor=card.getByRole('textbox',{name:'Python 复刻代码'}),code=await download(panels.first(),'下载 .py');
      assert.equal(await editor.inputValue(),code);assert.equal(await editor.getAttribute('readonly'),'');assert.match(code,/--style-demo/);assert.match(calls.at(-1).instructions,/STYLE-ONLY ACCEPTANCE/);
      await page.evaluate(()=>{navigator.clipboard.writeText=async text=>{window.figureCopied=text;};});await card.getByText('复制代码',{exact:true}).click();
      assert.equal(await page.evaluate(()=>window.figureCopied),code);
      await page.evaluate(()=>{navigator.clipboard.writeText=async()=>{throw new Error('Clipboard unavailable');};});await card.getByText('复制代码',{exact:true}).click();
      assert.equal(await editor.evaluate(e=>e.selectionEnd-e.selectionStart),code.length);assert.match(await card.locator('.figure-code-status').textContent(),/Ctrl\/Cmd\+C/);
      await card.getByText('自动换行',{exact:true}).click();assert.equal(await editor.getAttribute('wrap'),'soft');assert.equal(await card.locator('.figure-code-lines').isVisible(),false);
      await card.getByText('自动换行',{exact:true}).click();assert.equal(await editor.getAttribute('wrap'),'off');
      for(const width of [1440,390]){
        await page.setViewportSize({width,height:1000});
        assert.ok(await card.locator('.figure-code-frame').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
        await page.screenshot({path:path.join(path.dirname(reportPath),'figure-code-'+width+'.png')});
      }
      await page.setViewportSize({width:1440,height:1000});await editor.evaluate(e=>{window.figureEditor=e;e.scrollTop=100;});
      await card.getByText('放大代码',{exact:true}).click();assert.equal(await page.locator('.figure-code-focus:modal').count(),1);
      assert.equal(await page.locator('.figure-code-focus textarea').evaluate(e=>e===window.figureEditor),true);
      await page.screenshot({path:path.join(path.dirname(reportPath),'figure-code-focus.png')});await page.keyboard.press('Escape');await page.locator('.figure-code-focus').waitFor({state:'detached'});
      assert.equal(await page.locator('.figure-code-focus').count(),0);assert.equal(await page.locator('#figureInspector:modal').count(),1);assert.equal(await editor.inputValue(),code);
      assert.equal(await page.evaluate(()=>document.activeElement?.textContent),'放大代码');
    });
    await check('Downloadable specification and header-only CSV preserve provenance',async()=>{const saved=JSON.parse(await download(panels.first(),'下载图形规格'));assert.deepEqual(saved,spec);assert.equal((await download(panels.first(),'下载空数据模板')).trim(), '"dose","value","supp","lower","upper"');});
    await check('R reuses the same spec without a second model request',async()=>{const before=calls.length;await generate('r');assert.equal(calls.length,before);assert.equal(await panels.count(),2);const rPanel=panels.filter({hasText:'R 复现草稿'});assert.match(await download(rPanel,'下载 .R'),/draw_panel/);assert.deepEqual(JSON.parse(await download(rPanel,'下载图形规格')),spec);});
    await check('Local render upload is private until explicit comparison; request contains both images',async()=>{
      const p=panels.filter({hasText:'Python 复现草稿'}),before=calls.length;
      await figureView(page,'python');
      await p.locator('input[type=file]').setInputFiles({name:'render.png',mimeType:'image/png',buffer:png});await page.waitForFunction(()=>document.querySelector('#figureStatus').textContent.includes('本地载入'));
      assert.equal(calls.length,before);mode='revision';await p.getByText('对照原图修订',{exact:true}).click();await page.waitForFunction(()=>document.querySelector('#figureStatus').textContent.includes('尚未执行'));
      assert.equal(calls.length,before+1);assert.equal(calls.at(-1).content.filter(c=>c.type==='image_url'||c.type==='input_image').length,2);assert.match(calls.at(-1).instructions,/VISUAL REVISION/);
      assert.equal(await panels.count(),1);const saved=JSON.parse(await download(panels.first(),'下载图形规格'));assert.equal(saved.style.fontSize,11);assert.equal(saved.panels[0].interval.kind,'sd');
    });
    await check('Revision cannot turn SD into CI; last valid spec can still generate R',async()=>{
      const p=panels.first();await p.locator('input[type=file]').setInputFiles({name:'render.png',mimeType:'image/png',buffer:png});await page.waitForFunction(()=>document.querySelector('#figureStatus').textContent.includes('本地载入'));mode='bad-revision';
      await p.getByText('对照原图修订',{exact:true}).click();await page.waitForFunction(()=>document.querySelector('#figureStatus').textContent.includes('语义'));
      const before=calls.length;await generate('r');assert.equal(calls.length,before);const saved=JSON.parse(await download(panels.filter({hasText:'R 复现草稿'}),'下载图形规格'));assert.equal(saved.panels[0].interval.kind,'sd');assert.equal(saved.style.fontSize,11);
    });
    async function reset(){await figureView(page,'analysis');await card.getByText('翻译图文并解释',{exact:true}).click();await page.waitForFunction(()=>document.querySelector('#figureStatus').textContent.includes('已完成'));}
    await check('Malformed JSON stays visible but offers no invalid script download',async()=>{await reset();mode='bad-json';await figureView(page,'python');await card.getByText('生成 Python',{exact:true}).click();await page.waitForFunction(()=>document.querySelector('#figureStatus').textContent.includes('JSON 不完整'));assert.equal(await panels.getByText('下载 .py',{exact:true}).count(),0);});
    await check('Custom geometry keeps custom code with explicit template limitation',async()=>{await reset();mode='custom';await generate('python');assert.match(await download(panels.first(),'下载 .py'),/MODEL_CUSTOM_DRAFT/);assert.match(await panels.textContent(),/尚未进行模板数据校验/);});
    await check('Legacy model responses remain usable and clearly unvalidated',async()=>{await reset();mode='legacy';await generate('python');assert.match(await status.textContent(),/未返回图形规格/);assert.match(await download(panels.first(),'下载 .py'),/MODEL_CUSTOM_DRAFT/);assert.equal(await panels.getByText('下载图形规格',{exact:true}).count(),0);});
    await check('Service rejects malformed revision images/specs before provider access',async()=>{
      const before=calls.length;
      const call=message=>page.evaluate(message=>new Promise(resolve=>{const p=chrome.runtime.connect({name:'qudadflow-document'});p.onMessage.addListener(r=>{if(r.type==='RESULT'){resolve(r);p.disconnect();}});p.postMessage({...message,requestId:'revision-'+Date.now()});}),message);
      const message={type:'FIGURE_CODE',language:'python',imageData:'data:image/png;base64,'+png.toString('base64'),figureAnalysis:'recognized',reproductionSpec:spec};
      assert.equal((await call({...message,renderedImage:'file:///private.png'})).ok,false);assert.equal((await call({...message,reproductionSpec:{...spec,schema:'invalid'}})).ok,false);assert.equal(calls.length,before);
    });
    await check('Closing and reopening a streaming figure preserves progress without another request',async()=>{
      await figureView(page,'analysis');mode='stream';const before=calls.length;
      await card.getByText('翻译图文并解释',{exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('.figure-output').textContent.includes('STREAM_PROGRESS'));
      await closeInspector(page);await inspectFigure(page);
      assert.equal(calls.length,before+1);assert.match(await card.locator('.figure-output').textContent(),/STREAM_PROGRESS/);
      release();await page.waitForFunction(()=>document.querySelector('#figureStatus').textContent.includes('已完成'));
      assert.match(await card.locator('.figure-output').textContent(),/STREAM_COMPLETE/);mode='spec';
    });
    await check('Switching figures preserves each language tab, result and shared selection',async()=>{
      await closeInspector(page);
      const second=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=200;c.height=120;c.getContext('2d').fillRect(0,0,100,80);return c.toDataURL('image/png').split(',')[1];}),'base64');
      await page.locator('#figureImageFile').setInputFiles({name:'second.png',mimeType:'image/png',buffer:second});
      await page.waitForFunction(()=>document.querySelectorAll('.figure-card').length===2&&!document.querySelector('#importFigure').disabled);
      await inspectFigure(page);await card.locator('.figure-choice input').check();await figureView(page,'r');
      await page.locator('#nextFigure').click();assert.match(await page.locator('#figureInspectorTitle').textContent(),/second/);
      assert.equal(await page.locator('.figure-card:visible').count(),1);await page.locator('#previousFigure').click();
      assert.equal(await card.locator('[role=tab][aria-selected=true]').textContent(),'R');
      await figureView(page,'analysis');assert.match(await card.locator('.figure-output').textContent(),/STREAM_COMPLETE/);
      await closeInspector(page);assert.equal(await page.locator('.figure-tile input:checked').count(),1);
      await inspectFigure(page);
    });
    await check('Nested inspector Esc keeps the expanded workspace and restores focus',async()=>{
      await closeInspector(page);await page.locator('#expandFigureWorkbench').click();await inspectFigure(page);
      assert.equal(await page.locator('dialog:modal').count(),2);await page.keyboard.press('Escape');
      assert.equal(await page.locator('#figureWorkbenchFocus:modal').count(),1);
      assert.equal(await page.evaluate(()=>document.activeElement?.textContent),'打开解析浮窗');
      await page.keyboard.press('Escape');assert.equal(await page.locator('dialog:modal').count(),0);await inspectFigure(page);
    });
    await check('Inspector content, source image and controls fit desktop and narrow screens',async()=>{
      for(const width of [1440,768,390,320]){
        await page.setViewportSize({width,height:width<650?844:1000});
        assert.ok(await page.evaluate(()=>[document.documentElement,document.querySelector('#figureInspector'),document.querySelector('.figure-inspector-content'),document.querySelector('.figure-card:not([hidden]) .figure-detail-body')].every(e=>e.scrollWidth<=e.clientWidth+1)),'Overflow at '+width);
        for(const id of ['closeFigureInspector','previousFigure','nextFigure']){const box=await page.locator('#'+id).boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1);}
        await page.screenshot({path:path.join(path.dirname(reportPath),'figure-workflow-'+width+'.png')});
      }
      assert.deepEqual(errors,[]);
    });
    await check('Removing the current figure advances to the remaining one; removing the last closes safely',async()=>{
      await removeFigure(page);assert.match(await page.locator('#figureInspectorTitle').textContent(),/second/);
      assert.equal(await page.locator('#figureInspectorPosition').textContent(),'1 / 1');await removeFigure(page);
      assert.equal(await page.locator('#figureInspector[open]').count(),0);assert.equal(await page.locator('.figure-tile').count(),0);
    });
  }catch(error){results.push({name:'setup',passed:false,error:error.stack});console.error(error);}
  finally{
    await context?.close();server.closeAllConnections();await new Promise(r=>server.close(r));
    const resolved=path.resolve(scratch);if(!resolved.startsWith(path.join(os.tmpdir(),'qf-figure-workflow-')))throw new Error('Invalid scratch cleanup target');fs.rmSync(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:200});
    const report={scope:'Synthetic provider in isolated Edge. Tests UI, shared compilation, explicit two-image revision and provenance guards; no live recognition or AI code execution.',passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results};
    fs.writeFileSync(reportPath,JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failed:report.failed}));if(report.failed)process.exitCode=1;
  }
})();
