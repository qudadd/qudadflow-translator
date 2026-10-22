/* Isolated Microsoft Edge, synthetic API only. Optional third argument: saved public Ovid HTML. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),reportPath=path.resolve(process.argv[2]||'research-companion-results.json');
const fixturePath=process.argv[3]&&path.resolve(process.argv[3]),version=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'))).version;
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'qudadflow-companion-')),results=[],calls=[],errors=[],imageRequests=[];let imageFailure='',imageDelay=0;
const delay=ms=>new Promise(r=>setTimeout(r,ms));let context,worker,base,page,origin,mode='normal',capture;
const png=fs.readFileSync(path.join(root,'assets/icon128.png')),image='data:image/png;base64,'+png.toString('base64');
const answer='# 证据解读（模拟接口）\n\n**当前问题**需要联合正文与原图核验。\n\n| 证据 | 可以判断 | 尚不能判断 |\n| --- | --- | --- |\n| Figure 1 | 研究间存在差异 | 不能直接证明因果 |\n| Table 1 | 纳入标准 | 未报告的混杂因素 |\n\n## 下一步核查\n\n- 检查分组与置信区间。\n- 返回原文的方法与局限。\n\n```python\n# 未执行；需要原始数据\nvalues = read_source_data()\n```\n\n<img src=x onerror=alert(1)> [原文](https://example.org/paper)';
const paper=()=>`<!doctype html><meta charset="utf-8"><title>Companion fixture</title><style>body{font:16px Arial}figure img{width:300px;height:160px}article{max-width:900px}.sr-only{position:absolute}</style><article><p>TEASER_ONLY</p></article><article><h1>Controlled evidence study</h1><p>COMPLETE_PAPER_TEXT: The <em>pooled</em> evidence <button class="citation">1</button> supports an association.</p><p hidden>PRIVATE_HIDDEN</p><div class="sr-only">PRIVATE_HELPER</div><h2>Methods</h2><p>Eligibility and bias were evaluated separately.</p><div id="T1" class="article-table"><h3>Table 1. Eligibility</h3><table><tr><th>Population</th><th>Criteria</th></tr><tr><td rowspan="2">Adults</td><td>A</td></tr><tr><td>B</td></tr></table></div><div style="height:4000px"></div>${[1,2,3,4,5].map(n=>`<figure id="F${n}"><a href="/image-api/figure${n}/width/1200.webp"><img loading="lazy" src="/image-api/figure${n}/width/710.png"><span class="sr-only">Open multimedia modal</span></a><figcaption>Figure ${n}. Cohort comparison ${n}.</figcaption></figure>`).join('')}<figure><img src="/image-api/figure1/width/400.jpg"><figcaption>Figure 1. Cohort comparison 1.</figcaption></figure><a href="https://example.org/supplement.pdf">Supplemental material</a><h2>Conclusion</h2><p>END_OF_PAPER: observational evidence only.</p></article>`;
const server=http.createServer(async(req,res)=>{
  if(req.method==='GET'){
    if(req.url.startsWith('/image-api/')){imageRequests.push(req.url);if(imageDelay)await delay(imageDelay);if(imageFailure&&req.url.includes(imageFailure)){res.writeHead(503);return res.end('Synthetic original-image failure');}res.writeHead(200,{'Content-Type':'image/png'});return res.end(png);}
    if(req.url.startsWith('/next-paper')){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end('<!doctype html><meta charset="utf-8"><title>Next paper</title><main><h1>NEXT_PAPER_TITLE</h1><p>NEXT_PAPER_EVIDENCE: A separate cohort has different limitations.</p><table><caption>Table 1. New cohort</caption><tr><th>New group</th><th>Result</th></tr><tr><td>NEW_TABLE_EVIDENCE</td><td>19</td></tr></table><figure><img src="/image-api/new-cohort.png" width="300" height="160"><figcaption>Figure 1. New cohort evidence.</figcaption></figure><p>NEXT_PAPER_END</p></main>');}
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"script-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; font-src 'none'; frame-src 'none'; connect-src 'none'"});return res.end(req.url.startsWith('/ovid')&&fixturePath?fs.readFileSync(fixturePath):paper());
  }
  let raw='';for await(const part of req)raw+=part;
  const body=JSON.parse(raw),content=body.messages?.at(-1)?.content||body.input,parts=Array.isArray(content)?(content[0]?.content||content):[];
  const record={body,prompt:parts.length?parts.find(p=>p.text)?.text:String(content),images:parts.filter(p=>p.type==='image_url'||p.type==='input_image'),mode,aborted:false};calls.push(record);res.on('close',()=>{record.aborted=!res.writableEnded;});
  if(record.mode==='http-error'){res.writeHead(422,{'Content-Type':'application/json'});return res.end(JSON.stringify({error:{message:'Synthetic model does not accept images'}}));}
  if(record.mode==='delayed')await delay(36000);
  if(res.destroyed)return;
  res.writeHead(200,{'Content-Type':'text/event-stream'});
  const event=data=>res.write('data: '+JSON.stringify(data)+'\n\n');
  const send=text=>event(body.input?{type:'response.output_text.delta',delta:text}:{choices:[{delta:{content:text}}]});
  send(answer.slice(0,68));
  if(record.mode==='stall')return;
  await delay(300);
  if(res.destroyed)return;
  if(record.mode==='stream-error'){event({error:{message:'Synthetic upstream failure'}});return res.end();}
  if(record.mode==='eof')return res.end();
  send(answer.slice(68));
  if(body.input)event({type:'response.completed',response:{output_text:answer}});
  res.end('data: [DONE]\n\n');
});
async function check(name,fn){try{await fn();results.push({name,passed:true});console.log('PASS '+name);}catch(error){results.push({name,passed:false,error:error.stack});console.log('FAIL '+name+': '+error.message);}finally{mode='normal';}}
async function waitDone(){await page.waitForFunction(()=>document.querySelector('#paperStatus').textContent.startsWith('分析完成'),{},{timeout:55000});}
async function ask(question='请结合图表说明证据与局限'){await page.locator('#researchQuestion').fill(question);await page.locator('#analyzePaper').click();await waitDone();}
async function stream(message){return page.evaluate(message=>new Promise(resolve=>{const port=chrome.runtime.connect({name:'qudadflow-document'});port.onMessage.addListener(m=>{if(m.type==='RESULT'){resolve(m);port.disconnect();}});port.postMessage({requestId:'test-'+Date.now(),...message});}),message);}
async function extract(site){const tabId=await worker.evaluate(async url=>(await chrome.tabs.query({})).find(t=>t.url===url).id,site.url());return worker.evaluate(async id=>(await chrome.scripting.executeScript({target:{tabId:id},files:['src/research-capture.js']}))[0].result,tabId);}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;fs.mkdirSync(path.dirname(reportPath),{recursive:true});
  try{
    const extension=path.join(scratch,'extension');fs.mkdirSync(extension);
    for(const name of ['manifest.json','popup.html','popup.css','popup.js','reader.html','reader.css','reader.js','research.html','research.css','research.js','options.html','options.css','options.js','privacy.html','src','vendor','assets','_locales'])fs.cpSync(path.join(root,name),path.join(extension,name),{recursive:true});
    const manifest=JSON.parse(fs.readFileSync(path.join(extension,'manifest.json')));manifest.host_permissions=['<all_urls>'];fs.writeFileSync(path.join(extension,'manifest.json'),JSON.stringify(manifest));
    context=await chromium.launchPersistentContext(path.join(scratch,'profile'),{channel:'msedge',headless:true,viewport:{width:1440,height:1050},args:['--disable-extensions-except='+extension,'--load-extension='+extension]});
    context.on('page',p=>p.on('pageerror',error=>errors.push(error.message)));
    worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');base='chrome-extension://'+new URL(worker.url()).host+'/';
    await worker.evaluate(endpoint=>chrome.storage.local.set({apiStyle:'openai-compatible',endpoint,apiKey:'SYNTHETIC-COMPANION-KEY',model:'fixture-vision',targetLanguage:'zh-CN',streamOpenAi:true,requestTimeoutSeconds:10}),origin+'/v1/chat/completions');
    await check('Capture chooses substantive article, preserves inline prose, citations and tables, and inventories lazy figures without duplicates',async()=>{
      const site=await context.newPage();await site.goto(origin+'/paper');capture=await extract(site);
      assert.match(capture.text,/The pooled evidence 1 supports an association/);assert.match(capture.text,/END_OF_PAPER/);assert.doesNotMatch(capture.text,/TEASER_ONLY|PRIVATE_HIDDEN|PRIVATE_HELPER|Open multimedia/);
      assert.equal(capture.tables.length,1);assert.match(capture.text,/\| Adults \| B \|/);assert.equal(capture.figures.length,5);assert.ok(capture.figures.every(f=>f.src.endsWith('/width/1200.webp')));assert.equal(capture.attachments.length,1);assert.equal(calls.length,0);
      await site.bringToFront();const id=await worker.evaluate(async url=>(await chrome.tabs.query({})).find(t=>t.url===url).id,site.url());
      const opened=context.waitForEvent('page');await worker.evaluate(id=>captureResearch(id),id);page=await opened;await page.waitForURL(/research.html/);await page.waitForFunction(()=>document.querySelector('#captureStatus').textContent.includes('5 幅图'));
    });
    await check('Research opens as an independent popup; source tables and unread attachments are visible',async()=>{
      assert.equal(await page.evaluate(async()=>(await chrome.windows.getCurrent()).type),'popup');assert.equal(await page.locator('#sourcePreview table').count(),1);assert.match(await page.locator('#paperAttachments').textContent(),/未读取内容/);
      assert.equal(await page.locator('#tablePanel').isVisible(),true);assert.equal(await page.locator('#paperTables .paper-table-card').count(),1);assert.match(await page.locator('#paperTables').textContent(),/Adults/);assert.match(await page.locator('#paperTables').textContent(),/Criteria/);
      await page.locator('#sourcePanel').evaluate(e=>e.open=false);assert.equal(await page.locator('#paperTables table').isVisible(),true);await page.locator('.ask-table').click();assert.match(await page.locator('#researchQuestion').inputValue(),/Table 1\. Eligibility/);assert.equal(calls.length,0);await page.locator('#sourcePanel').evaluate(e=>e.open=true);
      await page.locator('#resizeResearch').click();assert.equal(await page.evaluate(async()=>(await chrome.windows.getCurrent()).state),'maximized');assert.equal(await page.locator('#resizeResearch').textContent(),'还原窗口');await page.locator('#resizeResearch').click();
    });
    await check('Overview inventories remote figures without loading originals or AI; filters and selection work without opening details',async()=>{
      assert.equal(await page.locator('.figure-tile').count(),5);assert.equal(await page.locator('.figure-tile img').count(),0);assert.equal(imageRequests.filter(url=>url.includes('/width/1200')).length,0);assert.equal(calls.length,0);
      await page.locator('#figureSearch').fill('Figure 2');await page.locator('#selectVisibleFigures').click();assert.equal(await page.locator('.figure-tile input:checked').count(),1);
      await page.locator('#figureSearch').fill('no such figure');assert.match(await page.locator('#figureSelectionStatus').textContent(),/1 项不在当前筛选/);assert.match(await page.locator('#figurePickerEmpty').textContent(),/没有匹配/);
      await page.locator('#figureSearch').fill('');await page.locator('#selectAllFigures').click();assert.equal(await page.locator('.figure-tile input:checked').count(),5);
      const before=calls.length;await page.locator('#analyzePaper').click();assert.match(await page.locator('#paperStatus').textContent(),/5 项尚未载入/);assert.equal(calls.length,before);
      await page.evaluate(()=>{window.originalImagePermission=chrome.permissions.request;window.permissionCalls=[];chrome.permissions.request=args=>{window.permissionCalls.push(args);return Promise.resolve(false);};});
      await page.locator('#loadSelectedFigures').click();await page.waitForFunction(()=>document.querySelector('#imageLoadStatus').textContent.includes('未获得'));assert.equal(await page.locator('.figure-card').count(),0);assert.equal(imageRequests.filter(url=>url.includes('/width/1200')).length,0);assert.equal(await page.locator('.figure-tile input:checked').count(),5);
      await page.evaluate(()=>{chrome.permissions.request=args=>{window.permissionCalls.push({...args,active:navigator.userActivation.isActive});return window.originalImagePermission(args);};});
    });
    await check('Select all includes filtered-out and pending figures; cancel clears every selection without loading images or calling AI',async()=>{
      const before=calls.length,images=imageRequests.length;
      assert.match(await page.locator('#selectAllFigures').textContent(),/全选图表（5）/);assert.equal(await page.locator('#selectAllFigures').isDisabled(),true);
      await page.locator('#figureSearch').fill('Figure 2');await page.getByRole('button',{name:'取消全选',exact:true}).click();
      assert.equal(await page.locator('.figure-tile input:checked').count(),0);assert.equal(await page.locator('#selectVisibleFigures').isVisible(),true);
      await page.getByRole('button',{name:'全选图表（5）',exact:true}).click();
      assert.equal(await page.locator('.figure-tile input:checked').count(),5);assert.match(await page.locator('#figureSelectionStatus').textContent(),/5 项待载入.*4 项不在当前筛选/);
      await page.locator('#clearFigureSelection').click();await page.locator('#figureSearch').fill('no matching figure');
      assert.equal(await page.locator('#selectVisibleFigures').isDisabled(),true);assert.equal(await page.locator('#selectAllFigures').isEnabled(),true);
      await page.locator('#selectAllFigures').click();assert.equal(await page.locator('.figure-tile input:checked').count(),5);
      await page.locator('#figureSearch').fill('');assert.equal(await page.locator('#selectVisibleFigures').isVisible(),false);
      assert.equal(calls.length,before);assert.equal(imageRequests.length,images);assert.equal(await page.locator('.figure-card').count(),0);
      assert.match(await page.locator('.figure-picker>.research-hint').first().textContent(),/文字表格全部随正文/);
    });
    await check('One click loads all originals without selection; one permission request, failed originals can be selected and retried',async()=>{
      imageFailure='/figure3/width/1200';imageDelay=100;
      assert.equal(await page.locator('#loadFilteredFigures').isVisible(),true);assert.match(await page.locator('#loadFilteredFigures').textContent(),/全部原图.*5/);
      await page.locator('#clearFigureSelection').click();
      try{
        const before=calls.length;await page.locator('#loadFilteredFigures').click();assert.equal(await page.locator('#selectAllFigures').isDisabled(),true);assert.equal(await page.locator('#analyzePaper').isDisabled(),true);assert.equal(await page.locator('#supplementResearchView').isDisabled(),true);
        await page.waitForFunction(()=>!document.querySelector('#figureSearch').disabled);assert.equal(await page.locator('.figure-card').count(),4);assert.equal(await page.locator('.figure-tile').count(),5);assert.equal(await page.locator('.figure-tile input:checked').count(),0);assert.match(await page.locator('#imageLoadStatus').textContent(),/1 张失败/);await page.locator('#selectAllFigures').click();
        await page.locator('#analyzeFigures').click();assert.match(await page.locator('#figureStatus').textContent(),/1 项尚未载入/);await page.locator('#analyzePaper').click();assert.match(await page.locator('#paperStatus').textContent(),/1 项尚未载入/);assert.equal(calls.length,before);
        const permissions=await page.evaluate(()=>window.permissionCalls);assert.equal(permissions.length,2);assert.equal(permissions[1].origins.length,1);assert.equal(permissions[1].active,true);
        imageFailure='';const beforeRetry=imageRequests.length;await page.locator('#loadSelectedFigures').click();await page.waitForFunction(()=>!document.querySelector('#figureSearch').disabled);
        assert.equal(imageRequests.length-beforeRetry,1);assert.equal(await page.locator('.figure-card').count(),5);assert.equal(await page.locator('.figure-choice input:checked').count(),5);assert.equal(calls.length,before);
        assert.deepEqual(await page.locator('.figure-tile').evaluateAll(nodes=>nodes.map(node=>node.dataset.key)),['web-0','web-1','web-2','web-3','web-4']);
      }finally{imageFailure='';imageDelay=0;}
    });
    await check('Bulk selection, next groups and detail checkboxes stay synchronized; oversized Q&A sends no request',async()=>{
      const before=calls.length;await page.locator('#analyzePaper').click();assert.match(await page.locator('#paperStatus').textContent(),/最多结合 4 张/);assert.equal(calls.length,before);
      await page.locator('#nextFigureGroup').click();assert.equal(await page.locator('.figure-choice input:checked').count(),4);await page.locator('#nextFigureGroup').click();assert.equal(await page.locator('.figure-choice input:checked').count(),1);assert.equal(await page.locator('.figure-tile[data-key="web-4"] input').isChecked(),true);
      await page.locator('#nextFigureGroup').click();assert.equal(await page.locator('.figure-choice input:checked').count(),4);await page.locator('#clearFigureSelection').click();assert.equal(await page.locator('.figure-choice input:checked').count(),0);
      await page.locator('.figure-tile[data-key="web-0"] input').check();await page.locator('.figure-choice input').nth(1).check();assert.equal(await page.locator('.figure-tile input:checked').count(),2);
      await page.locator('#researchQuestion').fill('KEEP_CUSTOM_QUESTION');await page.locator('#askSelectedFigures').click();assert.equal(await page.locator('#researchQuestion').inputValue(),'KEEP_CUSTOM_QUESTION');assert.equal(calls.length,before);
    });
    await check('Overview fits narrow and wide windows and remains collapsible',async()=>{
      for(const width of [390,620,1440]){await page.setViewportSize({width,height:1100});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overview overflow at '+width);await page.locator('.figure-picker').screenshot({path:path.join(path.dirname(reportPath),`qudadflow-figure-picker-${width}-v${version}.png`)});}
      await page.locator('.figure-picker>summary').click();assert.equal(await page.locator('#figureSearch').isVisible(),false);await page.locator('.figure-picker>summary').click();assert.equal(await page.locator('.figure-tile input:checked').count(),2);
    });
    await check('Combined Chat Completions request contains two original images, matching captions and full paper material',async()=>{
      await ask('比较 Figure 1 和 Figure 2，哪些结果支持结论？');const call=calls.at(-1);assert.equal(call.images.length,2);assert.match(call.prompt,/INPUT IMAGE 1: Figure 1/);assert.match(call.prompt,/INPUT IMAGE 2: Figure 2/);assert.match(call.prompt,/END_OF_PAPER/);assert.match(call.prompt,/Table 1\. Eligibility/);assert.match(call.prompt,/\| Adults \| B \|/);assert.match(call.prompt,/CURRENT USER QUESTION/);assert.equal(call.body.messages[1].content[1].image_url.detail,'high');
    });
    await check('Results render headings, comparison tables and code safely; narrow and wide layouts do not overflow',async()=>{
      assert.equal(await page.locator('#paperOutput table').count(),1);assert.equal(await page.locator('#paperOutput pre code').count(),1);assert.equal(await page.locator('#paperOutput img').count(),0);assert.match(await page.locator('#paperOutput').textContent(),/<img src=x/);
      for(const width of [620,1440]){await page.setViewportSize({width,height:1050});await page.locator('#sourcePanel').evaluate((e,width)=>e.open=width>1000,width);await page.evaluate(()=>scrollTo(0,0));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal page overflow at '+width);await page.screenshot({path:path.join(path.dirname(reportPath),`qudadflow-companion-${width}-v${version}.png`)});}
    });
    await check('Follow-up carries completed local history; export retains questions and selected figure labels',async()=>{
      await page.locator('#researchQuestion').fill('FOLLOWUP_QUESTION: 这种证据能否判断因果？');await page.locator('#researchQuestion').press('Control+Enter');await waitDone();assert.match(calls.at(-1).prompt,/LOCAL CONVERSATION/);assert.match(calls.at(-1).prompt,/比较 Figure 1/);assert.match(calls.at(-1).prompt,/FOLLOWUP_QUESTION/);assert.equal(await page.locator('.research-turn').count(),1);
      const download=page.waitForEvent('download');await page.locator('#downloadPaper').click();const value=fs.readFileSync(await(await download).path(),'utf8');assert.match(value,/FOLLOWUP_QUESTION/);assert.match(value,/Figures: Figure 1/);assert.doesNotMatch(value,/SYNTHETIC-COMPANION-KEY|data:image/);
      await page.locator('#newConversation').click();await ask('FRESH_CONVERSATION');assert.doesNotMatch(calls.at(-1).prompt,/LOCAL CONVERSATION|FOLLOWUP_QUESTION/);
    });
    await check('Invalid oversized selection preserves completed answer and conversation; filtered bulk analysis sends only selected figures in sequence',async()=>{
      const before=calls.length,answer=await page.locator('#paperOutput').textContent(),turns=await page.locator('#paperConversation').textContent();
      await page.locator('#selectAllFigures').click();await page.locator('#analyzePaper').click();assert.equal(calls.length,before);assert.equal(await page.locator('#paperOutput').textContent(),answer);assert.equal(await page.locator('#paperConversation').textContent(),turns);assert.equal(await page.locator('#downloadPaper').isEnabled(),true);
      await page.locator('#clearFigureSelection').click();await page.locator('#figureSearch').fill('Figure 3');await page.locator('#selectVisibleFigures').click();await page.locator('#figureSearch').fill('Figure 5');await page.locator('#selectVisibleFigures').click();await page.locator('#figureSearch').fill('');
      await page.locator('#analyzeFigures').click();assert.equal(await page.locator('#figureSearch').isDisabled(),true);await page.waitForFunction(()=>!document.querySelector('#figureSearch').disabled);assert.match(await page.locator('#figureStatus').textContent(),/已完成/);
      assert.equal(calls.length-before,2);assert.match(calls.at(-2).prompt,/Figure 3/);assert.match(calls.at(-1).prompt,/Figure 5/);assert.ok(calls.slice(before).every(call=>call.images.length===1));
      await page.locator('#selectUnfinishedFigures').click();assert.deepEqual(await page.locator('.figure-tile:has(input:checked)').evaluateAll(nodes=>nodes.map(n=>n.dataset.key)),['web-0','web-1','web-3']);
      await page.locator('#clearFigureSelection').click();for(const key of ['web-0','web-1'])await page.locator(`.figure-tile[data-key="${key}"] input`).check();
    });
    await check('Stopping a selected batch cancels the active image and does not start remaining images',async()=>{
      const before=calls.length;mode='stall';await page.locator('#analyzeFigures').click();await page.waitForFunction(()=>document.querySelector('.figure-card .figure-output').textContent.includes('证据解读'));await page.locator('#stopFigures').click();await delay(150);
      assert.equal(calls.length-before,1);assert.equal(calls.at(-1).aborted,true);assert.equal(await page.locator('#figureSearch').isEnabled(),true);assert.equal(await page.locator('.figure-tile input:checked').count(),2);
    });
    await check('Responses protocol sends each selected original as an input_image and renders the result',async()=>{
      await worker.evaluate(endpoint=>chrome.storage.local.set({endpoint}),origin+'/v1/responses');await page.waitForFunction(()=>!document.querySelector('#analyzePaper').disabled);await ask('RESPONSES_COMBINED');assert.equal(calls.at(-1).images.length,2);assert.equal(calls.at(-1).images[0].type,'input_image');assert.equal(calls.at(-1).body.store,false);
    });
    await check('Analysis waits beyond 30 seconds before response headers despite the 10-second translation timeout',async()=>{
      mode='delayed';const start=Date.now();await ask('LONG_WAIT_ANALYSIS');assert.ok(Date.now()-start>=35000);assert.equal(calls.at(-1).aborted,false);assert.match(await page.locator('#paperOutput').textContent(),/证据解读/);
    });
    await check('Provider stream errors preserve partial answers and exclude them from follow-up context',async()=>{
      await page.locator('#newConversation').click();mode='stream-error';await page.locator('#researchQuestion').fill('FAILED_TURN_MARKER');await page.locator('#analyzePaper').click();await page.waitForFunction(()=>document.querySelector('#paperStatus').textContent.includes('Synthetic upstream failure'));assert.match(await page.locator('#paperOutput').textContent(),/证据解读/);assert.equal(await page.locator('#downloadPaper').isEnabled(),true);
      const download=page.waitForEvent('download');await page.locator('#downloadPaper').click();assert.match(fs.readFileSync(await(await download).path(),'utf8'),/未完成/);mode='normal';await ask('RECOVERY_QUESTION');assert.doesNotMatch(calls.at(-1).prompt,/FAILED_TURN_MARKER/);
    });
    await check('Premature EOF and HTTP model errors surface actionable messages instead of successful completion',async()=>{
      mode='eof';await page.locator('#analyzePaper').click();await page.waitForFunction(()=>document.querySelector('#paperStatus').classList.contains('error'));assert.match(await page.locator('#paperOutput').textContent(),/证据解读/);assert.doesNotMatch(await page.locator('#paperStatus').textContent(),/^分析完成/);
      mode='http-error';await page.locator('#analyzePaper').click();await page.waitForFunction(()=>document.querySelector('#paperStatus').textContent.includes('422'));assert.match(await page.locator('#paperStatus').textContent(),/支持图片输入/);
    });
    await check('Stopping an analysis aborts its HTTP request and leaves partial output exportable',async()=>{
      mode='stall';await page.locator('#analyzePaper').click();await page.waitForFunction(()=>document.querySelector('#paperOutput').textContent.includes('证据解读'));await page.locator('#stopPaper').click();await delay(150);assert.equal(calls.at(-1).aborted,true);assert.equal(await page.locator('#downloadPaper').isEnabled(),true);assert.match(await page.locator('#paperStatus').textContent(),/保留/);
    });
    await check('Bounded history and image validation reject excessive or malformed data before network calls',async()=>{
      const before=calls.length;
      for(const extra of [{figures:Array(5).fill({data:image})},{figures:[{data:'https://untrusted.invalid/pixel'}]},{conversation:Array(7).fill({question:'Q',answer:'A'})},{conversation:[{question:'Q',answer:'x'.repeat(12001)}]}])assert.equal((await stream({type:'RESEARCH_ANALYZE',text:'INPUT_VALIDATION',...extra})).ok,false);
      assert.equal(calls.length,before);
      assert.equal((await stream({type:'RESEARCH_ANALYZE',text:'IGNORE_LEGACY_IMAGE',imageData:'https://untrusted.invalid/pixel'})).ok,true);assert.equal(calls.at(-1).images.length,0);
      assert.equal((await stream({type:'RESEARCH_ANALYZE',text:'',figures:[{data:image,label:'Scanned page'}]})).ok,true);assert.equal(calls.at(-1).images.length,1);
      const bounds=await page.evaluate(async()=>{const {ResearchControls}=await import('./src/research-ui.mjs');const controls=Object.create(ResearchControls.prototype);controls.turns=Array.from({length:10},(_,i)=>({question:'Q'+i,answer:'x'.repeat(12000),complete:i!==9}));return controls.history();});assert.ok(bounds.length<=6);assert.ok(bounds.reduce((n,t)=>n+t.question.length+t.answer.length,0)<=24000);assert.equal(bounds.at(-1).question,'Q8');
    });
    await check('New papers with main/itemprop/plain-body markup preserve lazy figures and distinct panels sharing one caption',async()=>{
      const site=await context.newPage();await site.goto(origin+'/alternative');
      for(const [open,close]of [['<main><article><p>Teaser</p></article>','</main>'],['<div itemprop="articleBody">','</div>'],['<div>','</div>']]){
        await site.setContent(open+'<h1>ANOTHER_PAPER</h1><p>'+('Evidence and limitations. '.repeat(100))+'</p><div class="fig-section"><img data-src="/panel-a.png" alt="Figure 1 panel A"><img data-original="/panel-b.png" alt="Figure 1 panel B"><div class="caption">Figure 1. Both panels matter.</div></div><img data-lazy-src="/graph.png" alt="Graph 2 evidence">'+close);
        const value=await extract(site);assert.match(value.text,/ANOTHER_PAPER/);assert.equal(value.figures.length,3);assert.ok(value.figures.some(f=>f.src.endsWith('panel-a.png')));assert.ok(value.figures.some(f=>f.src.endsWith('panel-b.png')));
      }
      await site.close();
    });
    await check('Tables outside the article, wrapped ARIA cells, captions, notes and duplicate panels produce independent readable cards',async()=>{
      const outcome='<section class="results-table"><div class="table-header"><h2>Table 9.</h2><p>Outcomes</p></div><div class="table-body"><table class="data-table"><tr><th>Group</th><th>Rate</th></tr><tr><td>A</td><td>0.42</td></tr></table><p class="table-footnote">Rates are proportions; CI not reported.</p></div></section>';
      const site=await context.newPage();await site.goto(origin+'/outside-table');await site.setContent('<article><h1>ARTICLE_WITHOUT_PANEL_TABLE</h1><p>'+('Paper body. '.repeat(30))+'</p></article>'+outcome+outcome+'<div role="table" aria-label="Table 10. Safety"><div role="row"><div><span role="columnheader">Event</span><span role="columnheader">Count</span></div></div><div role="row"><span role="rowheader">Headache</span><span role="cell">7</span></div></div><table><caption>Table 11. Single column</caption><tr><th>Measurement</th></tr><tr><td>ONE_COLUMN_MARKER &lt;img src=x onerror=alert(1)&gt;</td></tr></table><footer><table><tr><td>EXCLUDE_FOOTER_TABLE</td></tr></table></footer><table hidden><tr><td>EXCLUDE_HIDDEN_TABLE</td></tr></table>');
      const value=await extract(site);assert.equal(value.tables.length,3);assert.match(value.text,/\| Group \| Rate \|/);assert.match(value.text,/\| Event \| Count \|/);assert.equal(value.text.split('| A | 0.42 |').length-1,1);assert.doesNotMatch(value.text,/EXCLUDE_FOOTER_TABLE|EXCLUDE_HIDDEN_TABLE/);assert.equal(value.tables[0].caption,'Table 9. Outcomes');assert.match(value.tables[0].notes,/Rates are proportions/);assert.ok(value.tables.every(table=>table.markdown.includes('|')));
      await site.bringToFront();const tabId=await worker.evaluate(async url=>(await chrome.tabs.query({})).find(t=>t.url===url).id,site.url()),opened=context.waitForEvent('page');await worker.evaluate(id=>captureResearch(id),tabId);const companion=await opened;
      await companion.waitForFunction(()=>document.querySelectorAll('.paper-table-card').length===3);await companion.locator('#sourcePanel').evaluate(e=>e.open=false);assert.equal(await companion.locator('#paperTables table').first().isVisible(),true);assert.match(await companion.locator('#paperTables').textContent(),/Rates are proportions/);await companion.locator('.paper-table-card').nth(2).evaluate(e=>e.open=true);assert.equal(await companion.locator('#paperTables table').count(),3);assert.equal(await companion.locator('#paperTables img').count(),0);assert.match(await companion.locator('#paperTables').textContent(),/ONE_COLUMN_MARKER <img/);
      await companion.getByRole('button',{name:'收起全部表格',exact:true}).click();assert.equal(await companion.locator('.paper-table-card[open]').count(),0);await companion.getByRole('button',{name:'展开全部表格',exact:true}).click();assert.equal(await companion.locator('.paper-table-card[open]').count(),3);assert.match(await companion.locator('#tableHint').textContent(),/无需逐张/);
      for(const width of [620,1440]){await companion.setViewportSize({width,height:1050});assert.equal(await companion.locator('#paperTables table').first().isVisible(),true);assert.ok(await companion.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'table page overflow at '+width);await companion.screenshot({path:path.join(path.dirname(reportPath),`qudadflow-tables-${width}-v${version}.png`)});}await companion.close();await site.close();
    });
    await check('Long paper capture and analysis preserve the final paragraph beyond former 60k and 140k limits',async()=>{
      const text='Long paper evidence. '.repeat(10000)+' FINAL_LONG_PAPER_MARKER';
      const site=await context.newPage();await site.goto(origin+'/long');await site.setContent('<article><h1>Long paper</h1><p>'+text+'</p></article>');const value=await extract(site);assert.equal(value.truncated,false);assert.match(value.text,/FINAL_LONG_PAPER_MARKER$/);assert.ok(value.text.length>200000);await site.close();
      await page.locator('#sourcePanel').evaluate(e=>e.open=true);await page.locator('#editMaterial').click();await page.locator('#paperMaterial').fill(value.text);await ask('LONG_COMPLETE_PAPER');assert.match(calls.at(-1).prompt,/FINAL_LONG_PAPER_MARKER/);assert.ok(calls.at(-1).prompt.length>200000);assert.equal(await page.locator('#paperMaterial').getAttribute('maxlength'),null);
    });
    await check('Navigating to a later paper creates fresh source material and figures without mixing the existing companion',async()=>{
      const before=calls.length,existing=await page.locator('#paperMaterial').inputValue(),site=await context.newPage();await site.goto(origin+'/paper');await site.goto(origin+'/next-paper');await site.bringToFront();
      const tabId=await worker.evaluate(async url=>(await chrome.tabs.query({})).find(t=>t.url===url).id,site.url()),opened=context.waitForEvent('page');await worker.evaluate(id=>captureResearch(id),tabId);const next=await opened;
      await next.waitForFunction(()=>document.querySelector('#paperTitle')?.textContent==='NEXT_PAPER_TITLE');const text=await next.locator('#paperMaterial').inputValue();assert.match(text,/NEXT_PAPER_END/);assert.doesNotMatch(text,/COMPLETE_PAPER_TEXT|FINAL_LONG_PAPER_MARKER/);assert.equal(await next.locator('.figure-card,.remote-figure').count(),1);assert.equal(await next.locator('.paper-table-card').count(),1);assert.match(await next.locator('#paperTables').textContent(),/NEW_TABLE_EVIDENCE/);assert.doesNotMatch(await next.locator('#paperTables').textContent(),/Adults|Outcomes|ONE_COLUMN_MARKER/);assert.equal(await next.locator('#paperSource').getAttribute('href'),origin+'/next-paper');assert.equal(await page.locator('#paperMaterial').inputValue(),existing);assert.equal(calls.length,before);await next.close();await site.close();
    });
    await check('Analysis options collapse by default; settings sections fold, persist, and open from navigation',async()=>{
      assert.equal(await page.locator('#researchOptions').evaluate(e=>e.open),false);await page.locator('#researchOptions>summary').click();assert.equal(await page.locator('#researchSkill').isVisible(),true);await page.locator('#researchOptions>summary').click();
      const options=await context.newPage();await options.goto(base+'options.html');await options.waitForFunction(()=>document.querySelector('#managedNotebook')?.options.length);
      await options.locator('#collapseSettings').click();assert.equal(await options.locator('.settings-section[open]').count(),0);await options.locator('a[href="#researchSettings"]').click();assert.equal(await options.locator('#researchSettings').evaluate(e=>e.open),true);
      await options.locator('#expandSettings').click();assert.equal(await options.locator('.settings-section[open]').count(),8);await options.locator('#collapseSettings').click();await delay(100);await options.reload();await options.waitForFunction(()=>document.body.dataset.ready==='true');assert.equal(await options.locator('#connectionSettings').evaluate(e=>e.open),false);assert.equal(await options.locator('#researchSettings').evaluate(e=>e.open),true);
      await options.setViewportSize({width:1100,height:1000});await options.locator('#collapseSettings').click();await options.evaluate(()=>scrollTo(0,0));await options.screenshot({path:path.join(path.dirname(reportPath),`qudadflow-settings-folded-v${version}.png`)});await options.close();
    });
    if(fixturePath)await check('Real Ovid paper fixture yields four unique figures, four tables, full sections and an explicitly unread supplement',async()=>{
      const site=await context.newPage();await site.goto(origin+'/ovid');const value=await extract(site);
      assert.equal(value.figures.length,4);assert.equal(value.tables.length,4);assert.equal(value.truncated,false);assert.match(value.text,/Introduction/i);assert.match(value.text,/Methods/i);assert.match(value.text,/Discussion/i);assert.match(value.text,/Conclusion/i);assert.doesNotMatch(value.text,/Open multimedia modal/);assert.ok(value.figures.every(f=>f.src.includes('/width/1200.')));assert.ok(value.attachments.some(a=>a.url.includes('links.lww.com/MD/P909')));
      value.tables.forEach((table,index)=>{assert.match(table.caption,new RegExp('^Table '+(index+1)+'\\b'));assert.ok(table.markdown.length>100);assert.ok(table.notes);});
      await site.bringToFront();const tabId=await worker.evaluate(async url=>(await chrome.tabs.query({})).find(t=>t.url===url).id,site.url()),opened=context.waitForEvent('page');await worker.evaluate(id=>captureResearch(id),tabId);const companion=await opened;await companion.waitForFunction(()=>document.querySelectorAll('.paper-table-card').length===4);assert.match(await companion.locator('#paperTables').textContent(),/PECO framework/);assert.equal(await companion.locator('#paperTables table').count(),4);await companion.close();
      results.push({name:'Ovid extraction measurements',passed:true,characters:value.text.length,figures:value.figures.map(f=>({id:f.id,caption:f.caption,source:f.src})),tables:value.tables.map(({id,caption,rows,columns,truncated,markdown,notes})=>({id,caption,rows,columns,truncated,markdownCharacters:markdown.length,notesCharacters:notes.length})),attachments:value.attachments});await site.close();
    });
    await check('Configuration changes discard in-flight image loads; retry and removal keep the overview selection consistent',async()=>{
      const probe=await context.newPage();await probe.goto(page.url());await probe.waitForFunction(()=>document.querySelectorAll('.figure-tile').length===5);
      try{
        await probe.locator('#selectAllFigures').click();const before=imageRequests.length;imageDelay=800;await probe.locator('#loadSelectedFigures').click();await delay(160);assert.ok(imageRequests.length>before);
        await worker.evaluate(()=>chrome.storage.local.set({temperature:0.21}));await probe.waitForFunction(()=>!document.querySelector('#figureSearch').disabled);await delay(950);
        assert.equal(await probe.locator('.figure-card').count(),0);assert.equal(await probe.locator('.figure-tile input:checked').count(),5);assert.equal(imageRequests.length-before,1);assert.equal(await probe.locator('.figure-tile-state').filter({hasText:'正在载入'}).count(),0);
        imageDelay=0;await probe.locator('#loadAllFigures').click();await probe.waitForFunction(()=>document.querySelectorAll('.figure-card').length===5&&!document.querySelector('#figureSearch').disabled);
        await probe.locator('.figure-card').first().getByRole('button',{name:'移除',exact:true}).click();assert.equal(await probe.locator('.figure-tile').count(),4);assert.equal(await probe.locator('.figure-tile input:checked').count(),4);
        await probe.reload();await probe.waitForFunction(()=>document.querySelectorAll('.figure-tile').length===5);assert.equal(await probe.locator('.figure-tile input:checked').count(),0);
      }finally{imageDelay=0;await probe.close();}
    });
    await check('No uncaught Edge page errors',async()=>assert.deepEqual(errors,[]));
  }catch(error){results.push({name:'setup',passed:false,error:error.stack});console.error(error);}
  finally{
    await context?.close();server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(scratch,{recursive:true,force:true,maxRetries:5,retryDelay:200});
    const report={version,scope:'Isolated Edge; generated fixtures and optional saved public Ovid HTML; synthetic API, no user settings or real AI calls. Delayed-header test waits 36 seconds. Screenshots show simulated answers.',passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results};fs.writeFileSync(reportPath,JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failed:report.failed}));if(report.failed)process.exitCode=1;
  }
})();
