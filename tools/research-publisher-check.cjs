/* Isolated Edge + synthetic originals/API. Optional saved public HTML and JPEG stay outside the package. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),reportPath=path.resolve(process.argv[2]||'publisher-results.json');
const htmlPath=process.argv[3]&&path.resolve(process.argv[3]),jpegPath=process.argv[4]&&path.resolve(process.argv[4]);
const version=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'))).version,scratch=fs.mkdtempSync(path.join(os.tmpdir(),'qudadflow-publisher-'));
const results=[],errors=[],calls=[],imageRequests=[],png=fs.readFileSync(path.join(root,'assets/icon128.png'));
let context,worker,origin,base,jpeg,site,companion,capture;
const shell=body=>`<!doctype html><meta charset="utf-8"><title>Publisher fixture</title><style>body{font:16px Arial}img{width:240px;height:100px}article{max-width:950px}td{padding:10px}</style><article><h1>Image table study</h1><p>Study methods and limitations. See Table 1 and Table 2, and Figure 1.</p>${body}<p>END_OF_PAPER: These data do not prove causation.</p></article>`;
const panel=(label,index)=>`<div id="target-${index}"></div><a name="target-${index}"></a><table class="arbitrary-publisher-layout"><tr><td><a href="/original-${index}.jpg"><img src="/thumb-${index}.png" alt="${index===0?'A descriptive image label':''}"></a></td><td><p class="arbitrary-title"><strong>${label}</strong> Outcomes and uncertainty ${index}.</p></td></tr></table>`;
const paper=()=>shell(panel('Figure 1',0)+panel('Table 1',1)+panel('Table 2',2)+'<table><caption>Table 3. Readable native data</caption><tr><th>Group</th><th>Rate</th></tr><tr><td><img src="/icon.png" style="width:12px;height:12px">Treatment</td><td>42.5</td></tr></table>');
const server=http.createServer(async(req,res)=>{
  if(req.method==='GET'){
    if(/\.(png|jpg)(?:\?|$)/.test(req.url)){
      imageRequests.push(req.url);
      if(req.url==='/html.jpg')return res.end('<html><body>Login required</body></html>');
      if(req.url==='/spoof.jpg'){res.setHeader('Content-Type','image/png');return res.end('<html>not an image</html>');}
      if(req.url==='/wrong-type.jpg'){res.setHeader('Content-Type','text/html');return res.end(jpeg);}
      if(req.url==='/truncated.jpg')return res.end(Buffer.from([255,216,255,225,0,0]));
      if(req.url==='/oversize.jpg')return res.end(Buffer.alloc(10*1024*1024+1));
      if(req.url==='/publisher-original.jpg'&&jpegPath)return res.end(fs.readFileSync(jpegPath));
      if(req.url.startsWith('/original-')){if(req.url.includes('-1'))res.setHeader('Content-Type','application/octet-stream');if(req.url.includes('-2'))res.setHeader('Content-Type','image/jpeg');return res.end(jpeg);}
      res.setHeader('Content-Type','image/png');return res.end(png);
    }
    res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(paper());
  }
  let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);calls.push(body);
  res.setHeader('Content-Type','text/event-stream');
  res.end('data: '+JSON.stringify({choices:[{delta:{content:'## Simulated table comparison\n\n| Group | Rate |\n| --- | --- |\n| Treatment | 42.5 |\n\nVerify every value against the original.'}}]})+'\n\ndata: [DONE]\n\n');
});
async function check(name,fn){try{const detail=await fn();results.push({name,passed:true,...(detail?{detail}:{})});console.log('PASS '+name);}catch(error){results.push({name,passed:false,error:error.stack});console.log('FAIL '+name+': '+error.message);}}
async function tabId(page){return worker.evaluate(async url=>(await chrome.tabs.query({})).find(tab=>tab.url===url).id,page.url());}
async function extract(page){await page.waitForFunction(()=>[...document.images].every(img=>img.complete));return worker.evaluate(async id=>(await chrome.scripting.executeScript({target:{tabId:id},files:['src/research-capture.js']}))[0].result,await tabId(page));}
async function setFixture(body){await site.setContent(shell(body));return extract(site);}
async function dimensions(data){return worker.evaluate(async data=>{const image=await createImageBitmap(await(await fetch(data)).blob());try{return {width:image.width,height:image.height};}finally{image.close();}},data);}
async function fetchOriginal(src,extra={}){return worker.evaluate(async({src,extra})=>{const id=await QFResearch.capturePut({title:'Original test',text:'',figures:[{src,caption:'Table 1. Test'}]});try{return await fetchResearchImage({captureId:id,index:0,...extra});}finally{await QFResearch.captureDelete(id);}}, {src,extra});}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;fs.mkdirSync(path.dirname(reportPath),{recursive:true});
  try{
    const extension=path.join(scratch,'extension');fs.mkdirSync(extension);
    for(const name of ['manifest.json','offscreen-translation.html','popup.html','popup.css','popup.js','reader.html','reader.css','reader.js','research.html','research.css','research.js','options.html','options.css','options.js','privacy.html','src','vendor','assets','_locales'])fs.cpSync(path.join(root,name),path.join(extension,name),{recursive:true});
    const manifest=JSON.parse(fs.readFileSync(path.join(extension,'manifest.json')));manifest.host_permissions=['<all_urls>'];fs.writeFileSync(path.join(extension,'manifest.json'),JSON.stringify(manifest));
    context=await chromium.launchPersistentContext(path.join(scratch,'profile'),{channel:'msedge',headless:true,viewport:{width:1440,height:1100},args:['--disable-extensions-except='+extension,'--load-extension='+extension]});
    context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
    worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');base='chrome-extension://'+new URL(worker.url()).host+'/';
    await worker.evaluate(endpoint=>chrome.storage.local.set({apiStyle:'openai-compatible',endpoint,apiKey:'SYNTHETIC-PUBLISHER-KEY',model:'fixture-vision',targetLanguage:'zh-CN',streamOpenAi:true}),origin+'/v1/chat/completions');
    const maker=await context.newPage();await maker.goto(base+'research.html');
    jpeg=Buffer.from((await maker.evaluate(()=>{const c=document.createElement('canvas');c.width=2500;c.height=900;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,2500,900);g.fillStyle='#172b4d';g.font='44px Arial';g.fillText('Table 1. SYNTHETIC HIGH RESOLUTION ORIGINAL',80,90);for(let i=0;i<8;i++){g.fillRect(80,150+i*85,2340,2);g.fillText('Group '+i+'                      42.5%                        p = 0.031',100,210+i*85);}return c.toDataURL('image/jpeg',.92);})).split(',')[1],'base64');await maker.close();
    site=await context.newPage();await site.goto(origin+'/paper');
    await check('Numbered captions classify image tables; thumbnail layout is excluded while native data and small icons remain correct',async()=>{
      capture=await extract(site);assert.equal(capture.figures.length,3);assert.deepEqual(capture.figures.map(f=>f.contentType),['figure','table','table']);assert.equal(capture.tables.length,1);assert.match(capture.tables[0].markdown,/Treatment \| 42\.5/);assert.match(capture.text,/Table 2 Outcomes/);assert.match(capture.text,/END_OF_PAPER/);
      assert.ok(capture.figures.every(f=>f.previewOnly&&f.data&&f.src.includes('/original-')));assert.ok(capture.figures.every(f=>!f.captionInferred));assert.equal(imageRequests.filter(url=>url.startsWith('/original-')).length,0);
    });
    await check('Exact same-page references and blank named anchors identify otherwise uncaptioned images',async()=>{
      const value=await setFixture('<p>Results in <a href="#asset8">Table 8</a>.</p><a name="asset8"></a><div><img src="/thumb-8.png" data-zoom-image="/original-8.jpg" alt="Outcome rows"></div><p>Separate paragraph.</p>');
      assert.equal(value.figures.length,1);assert.equal(value.figures[0].caption,'Table 8. Outcome rows');assert.equal(value.figures[0].captionSource,'anchor-reference');assert.equal(value.figures[0].id,'asset8');assert.equal(value.figures[0].contentType,'table');assert.ok(value.figures[0].src.endsWith('/original-8.jpg'));
    });
    await check('Adjacent and accessible captions retain supplementary/Chinese names; distinct panels sharing a caption survive',async()=>{
      const value=await setFixture('<a href="/original-4.jpg"><img src="/thumb-4.png"></a><p><strong>Supplementary Table S2</strong> Detailed results</p><div><img src="/thumb-5.png" aria-labelledby="cap5"><span id="cap5">表 5 分层结果</span></div><figure><img data-srcset="/panel-a.png 300w, /panel-a-large.png 1800w" alt="Figure 7 panel A"><img data-original="/panel-b.png" alt="Figure 7 panel B"><figcaption>Figure 7. Both panels; compare Figure 8.</figcaption></figure>');
      assert.equal(value.figures.length,4);assert.match(value.figures[0].caption,/^Supplementary Table S2/);assert.equal(value.figures[1].contentType,'table');assert.match(value.figures[1].caption,/^表 5/);assert.ok(value.figures.some(f=>f.src.endsWith('/panel-a-large.png')));assert.equal(value.figures.filter(f=>f.caption.startsWith('Figure 7.')).length,2);
    });
    await check('Broad multi-figure containers and linked prose references do not mislabel unrelated images',async()=>{
      const value=await setFixture('<div><p><a href="#not-here">Table 9</a> is mentioned in prose.</p><img src="/unlabelled.png" alt="Neutral overview"><figure><img src="/panel-2.png"><figcaption>Figure 2. Reference to Figure 4.</figcaption></figure><figure><img src="/panel-3.png"><figcaption>Figure 3. Different results.</figcaption></figure></div>');
      assert.equal(value.figures.length,2);assert.ok(value.figures.every(f=>f.paperFigure));assert.match(value.figures[0].caption,/^Figure 2\./);assert.match(value.figures[1].caption,/^Figure 3\./);assert.ok(!value.figures.some(f=>f.caption==='Neutral overview'));
    });
    await check('Paper-only inventory drops ordinary photos, banners and unlabeled canvases but keeps semantic charts and captions',async()=>{
      const value=await setFixture('<img src="/photo.png" alt="Neutral overview"><canvas width="500" height="300"></canvas><figure><img src="/captioned.png"><figcaption>Study population and enrolment</figcaption></figure><img src="/chart.png" alt="Chart of treatment response"><figure><img src="/numbered.png"><figcaption>Table S1. Cohort data</figcaption></figure>');
      assert.equal(value.figures.length,3);assert.ok(value.figures.every(f=>f.paperFigure));assert.ok(value.figures.some(f=>f.caption==='Study population and enrolment'));assert.ok(value.figures.some(f=>f.caption==='Chart of treatment response'));assert.equal(value.figures.filter(f=>f.contentType==='table').length,1);assert.ok(!value.figures.some(f=>f.src.endsWith('/photo.png')||f.kind==='canvas'));
    });
    await check('Loaded thumbnails persist as previews, never as analysis-ready originals; image tables can be selected in one click',async()=>{
      await site.goto(origin+'/paper');await extract(site);await site.bringToFront();const opened=context.waitForEvent('page');await worker.evaluate(id=>captureResearch(id),await tabId(site));companion=await opened;
      await companion.waitForFunction(()=>document.querySelectorAll('.figure-tile').length===3);assert.equal(await companion.locator('.figure-tile img').count(),3);assert.equal(await companion.locator('.figure-card').count(),0);
      assert.match(await companion.locator('#captureStatus').textContent(),/2 张图片表格/);assert.match(await companion.locator('#tableCount').textContent(),/1 张文字表格 · 2 张图片表格/);assert.match(await companion.locator('.figure-tile-state').first().textContent(),/缩略预览 · 原图待载入/);
      await companion.locator('#selectImageTables').click();assert.deepEqual(await companion.locator('.figure-tile:has(input:checked)').evaluateAll(nodes=>nodes.map(node=>node.dataset.key)),['web-1','web-2']);
      // The current workbench collapses analysis options by default. Open its
      // visible summary before interacting, just as a user does.
      const analysisTab=companion.locator('#figure-tab-analysis');
      if(await analysisTab.getAttribute('aria-selected')!=='true')await analysisTab.click();
      const analysisDetails=companion.locator('details.research-controls');
      if(await analysisDetails.count()&&!(await analysisDetails.evaluate(e=>e.open)))await analysisDetails.locator(':scope > summary').click();
      await companion.locator('#analyzePaper').click();assert.match(await companion.locator('#paperStatus').textContent(),/2 项尚未载入/);assert.equal(calls.length,0);assert.equal(imageRequests.filter(url=>url.startsWith('/original-')).length,0);
      await companion.locator('#figure-tab-gallery').click();
    });
    await check('Batch loading fetches full-size linked originals with generic MIME, keeps selection/order and preserves 2500-pixel detail',async()=>{
      await companion.locator('#loadSelectedFigures').click();await companion.waitForFunction(()=>document.querySelectorAll('.figure-card').length===2&&!document.querySelector('#figureSearch').disabled);
      assert.deepEqual(imageRequests.filter(url=>url.startsWith('/original-')),['/original-1.jpg','/original-2.jpg']);assert.equal(await companion.locator('.figure-tile input:checked').count(),2);
      assert.deepEqual(await companion.locator('.figure-tile').evaluateAll(nodes=>nodes.map(node=>node.dataset.key)),['web-0','web-1','web-2']);
      for(const data of await companion.locator('.figure-card>img').evaluateAll(nodes=>nodes.map(node=>node.src)))assert.deepEqual(await dimensions(data),{width:2500,height:900});assert.equal(calls.length,0);
    });
    await check('Missing MIME originals load too; explicit Q&A transmits selected full-resolution images, numbered captions and native table text',async()=>{
      await companion.locator('#selectAllFigures').click();await companion.locator('#loadSelectedFigures').click();await companion.waitForFunction(()=>document.querySelectorAll('.figure-card').length===3&&!document.querySelector('#figureSearch').disabled);
      assert.ok(imageRequests.includes('/original-0.jpg'));await companion.locator('#selectImageTables').click();await companion.locator('#figure-tab-analysis').click();await companion.locator('#researchQuestion').fill('Compare Table 1 and Table 2 with the native data.');await companion.locator('#analyzePaper').click();await companion.waitForFunction(()=>document.querySelector('#paperStatus').textContent.startsWith('分析完成'));
      assert.equal(calls.length,1);const parts=calls[0].messages.at(-1).content,images=parts.filter(part=>part.type==='image_url'),prompt=parts.find(part=>part.type==='text').text;assert.equal(images.length,2);
      for(const image of images)assert.equal((await dimensions(image.image_url.url)).width,2500);
      assert.match(prompt,/INPUT IMAGE 1: Table 1/);assert.match(prompt,/INPUT IMAGE 2: Table 2/);assert.match(prompt,/Outcomes and uncertainty/);assert.match(prompt,/\| Treatment \| 42\.5 \|/);assert.match(prompt,/END_OF_PAPER/);
      await companion.locator('#figure-tab-gallery').click();
    });
    await check('Original resize limit differs from screenshot limit without upscaling',async()=>{
      const data='data:image/jpeg;base64,'+jpeg.toString('base64');const limited=await worker.evaluate(async data=>researchImage(await(await fetch(data)).arrayBuffer()),data);assert.equal((await dimensions(limited)).width,1600);
      const small=await fetchOriginal(origin+'/icon.png');assert.equal((await dimensions(small.data)).width,128);
      const huge=await worker.evaluate(async()=>{const canvas=new OffscreenCanvas(4000,1000);canvas.getContext('2d').fillRect(0,0,4000,1000);return researchImage(await(await canvas.convertToBlob({type:'image/png'})).arrayBuffer(),'image/png',3200);});assert.deepEqual(await dimensions(huge),{width:3200,height:800});
    });
    await check('Missing/misleading MIME never accepts HTML, corrupt images or oversized responses',async()=>{
      for(const file of ['html.jpg','spoof.jpg','wrong-type.jpg','truncated.jpg','oversize.jpg'])await assert.rejects(()=>fetchOriginal(origin+'/'+file),undefined,file);
    });
    await check('Original downloads use only stored source URLs and enforce source permissions before fetching',async()=>{
      const before=imageRequests.length;await worker.evaluate(()=>{globalThis.originalPermissionsContains=permissionsContains;permissionsContains=async()=>false;});
      try{await assert.rejects(()=>fetchOriginal(origin+'/original-9.jpg'),/允许此图片来源/);assert.equal(imageRequests.length,before);}finally{await worker.evaluate(()=>{permissionsContains=globalThis.originalPermissionsContains;delete globalThis.originalPermissionsContains;});}
      const loaded=await fetchOriginal(origin+'/original-9.jpg',{src:origin+'/html.jpg'});assert.equal((await dimensions(loaded.data)).width,2500);await assert.rejects(()=>fetchOriginal('javascript:alert(1)'),/来源无效/);
    });
    if(htmlPath)await check('Saved Dovepress paper produces two named figures and three image tables, zero layout data tables and unread supplementary notices',async()=>{
      const page=await context.newPage(),url='https://www.dovepress.com/loop-gain-in-obstructive-sleep-apnea-from-physiological-endotype-to-cl-peer-reviewed-fulltext-article-NSS';
      try{await page.route('**/*',route=>route.request().isNavigationRequest()?route.fulfill({body:fs.readFileSync(htmlPath),headers:{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"script-src 'none'; style-src 'unsafe-inline'; img-src 'none'; frame-src 'none'; connect-src 'none'"}}):route.abort());await page.goto(url);
        const value=await extract(page);assert.equal(value.figures.length,5);assert.equal(value.tables.length,0);assert.deepEqual(value.figures.map(f=>f.caption.match(/^(Figure|Table) \d+/)[0]),['Figure 1','Table 1','Table 2','Figure 2','Table 3']);assert.equal(value.figures.filter(f=>f.contentType==='table').length,3);assert.ok(value.figures.every(f=>f.previewOnly&&!f.captionInferred&&!f.src.includes('_Thumb')&&f.src.endsWith('.jpg')));assert.ok(value.figures.every(f=>f.caption.length>50));
        const coverage=await companion.evaluate(async value=>(await import('./src/research-coverage.mjs')).assessResearchCapture(value),value);assert.equal(coverage.issues.filter(issue=>issue.reason==='image').length,3);assert.ok(coverage.issues.some(issue=>issue.label==='Table S1'&&issue.reason==='supplement'));assert.ok(coverage.issues.some(issue=>issue.label==='Table S2'&&issue.reason==='supplement'));
        return {characters:value.text.length,figures:2,imageTables:3,nativeTables:0};
      }finally{await page.close();}
    });
    if(jpegPath)await check('Saved publisher JPEG without Content-Type retains its actual 2029 by 712 dimensions through the original-loading path',async()=>assert.deepEqual(await dimensions((await fetchOriginal(origin+'/publisher-original.jpg')).data),{width:2029,height:712}));
    await check('Image-table overview and controls fit 390, 620 and 1440 pixel windows',async()=>{
      for(const width of [390,620,1440]){await companion.setViewportSize({width,height:1100});assert.ok(await companion.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page overflows at '+width);await companion.locator('.figure-picker').screenshot({path:path.join(path.dirname(reportPath),`qudadflow-publisher-picker-${width}-v${version}.png`)});}
      await companion.locator('#tablePanel').screenshot({path:path.join(path.dirname(reportPath),`qudadflow-publisher-tables-v${version}.png`)});
    });
    await check('No uncaught browser errors and no automatic AI requests',async()=>{assert.deepEqual(errors,[]);assert.equal(calls.length,1);});
  }catch(error){results.push({name:'setup',passed:false,error:error.stack});console.error(error);}
  finally{
    await context?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
    assert.ok(path.resolve(scratch).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(scratch).startsWith('qudadflow-publisher-'));fs.rmSync(scratch,{recursive:true,force:true,maxRetries:5,retryDelay:200});
    const report={version,scope:'Isolated Edge, generated fixtures and mock AI. Optional saved public paper/image are inspected locally, not bundled. No user profile or real-model accuracy test.',passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results};fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,failed:report.failed}));if(report.failed)process.exitCode=1;
  }
})();
