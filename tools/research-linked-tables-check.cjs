/* Isolated Edge with synthetic APIs. Optional public DOM fixtures stay outside releases. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),reportPath=path.resolve(process.argv[2]||'linked-table-results.json');
const articlePath=process.argv[3],tablePath=process.argv[4],version=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'))).version;
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'qudadflow-linked-')),results=[],errors=[],calls=[],requests=[],tableRequests=[];
const png=fs.readFileSync(path.join(root,'assets/icon128.png'));
const caption='Table 1 Overview of basic information included in the study';
const tableRows=Array.from({length:53},(_,i)=>`<tr><td>Study${i+1}</td><td>RCT</td><td>18–65</td><td>Country${i+1}</td><td>Site${i+1}</td></tr>`).join('');
const tableHtml=`<!doctype html><meta charset="utf-8"><main><h1>${caption}</h1><div class="c-article-table-container"><table><tr><th>Article</th><th>Study Type</th><th>Age</th><th>Country</th><th>Site</th></tr>${tableRows}</table><p class="table-footnote">RCT: randomized controlled trial.</p></div></main>`;
const tableLink=(n=1,href='/tables/'+n)=>`<div class="c-article-table" id="table-${n}"><figure><figcaption>Table ${n} Overview of basic information included in the study</figcaption><a href="${href}" aria-label="Full size table ${n}">Full size table <svg width="16" height="16"><path d="M0 0h16v16z"/></svg></a></figure></div>`;
const img=n=>`https://media.springernature.com/lw685/springer-static/image/art%3Apaper/MediaObjects/Paper_Fig${n}_HTML.png`;
const figures=Array.from({length:5},(_,i)=>`<figure><figcaption>Fig. ${i+1}</figcaption><picture><source srcset="${img(i+1)}?as=webp"><img src="${img(i+1)}" aria-describedby="figure-${i+1}-desc" alt="Fig. ${i+1}"></picture><div id="figure-${i+1}-desc">Detailed evidence for outcome ${i+1}.</div><a href="#download"><svg width="16" height="16"><path d="M0 0h16v16z"/></svg></a></figure>`).join('');
const duplicates=Array.from({length:5},(_,i)=>`<figure><figcaption>Fig. ${i+1}</figcaption><picture><source data-srcset="${img(i+1).replace('/lw685/','/lw200/')}?"><img data-src="${img(i+1)}" alt="Fig. ${i+1}"></picture></figure>`).join('');
const shell=body=>`<!doctype html><meta charset="utf-8"><title>Linked table study</title><style>body{font:16px Arial}img{width:240px;height:100px}figure{margin:20px}svg{display:inline-block}</style><main><h1>Linked table study</h1><p>See Figures 1–5 and Table 1. OBSERVATIONAL_EVIDENCE.</p>${body}</main>`;
let context,worker,base,origin,site,companion,parser,captureId,tableMode='normal',tableDelay=0;
const server=http.createServer(async(req,res)=>{
  if(req.method==='POST'){
    let raw='';for await(const chunk of req)raw+=chunk;calls.push(JSON.parse(raw));
    res.writeHead(200,{'Content-Type':'text/event-stream'});return res.end('data: '+JSON.stringify({choices:[{delta:{content:'## Simulated table analysis\n\nThe study rows need verification against the source.'}}]})+'\n\ndata: [DONE]\n\n');
  }
  requests.push(req.url);
  if(req.url.startsWith('/tables/')){
    tableRequests.push({url:req.url,cookie:req.headers.cookie||'',authorization:req.headers.authorization||'',apiKey:req.headers['x-api-key']||'',custom:req.headers['x-qf-api-test']||''});
    if(tableDelay)await new Promise(resolve=>setTimeout(resolve,tableDelay));
    const mode=new URL(req.url,'http://fixture').searchParams.get('mode')||tableMode;
    if(mode==='http'){res.writeHead(401);return res.end('Login required');}
    if(mode==='redirect'){res.writeHead(302,{Location:'/redirect-target'});return res.end();}
    if(mode==='mime'){res.writeHead(200,{'Content-Type':'application/pdf'});return res.end('%PDF');}
    if(mode==='large'){res.writeHead(200,{'Content-Type':'text/html','Content-Length':6*1024*1024});return res.end(Buffer.alloc(6*1024*1024));}
    if(mode==='chunked'){res.writeHead(200,{'Content-Type':'text/html'});res.write(Buffer.alloc(3*1024*1024));return res.end(Buffer.alloc(3*1024*1024));}
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(mode==='challenge'?'<html><h1>Verify you are human</h1></html>':tableHtml);
  }
  if(req.url.endsWith('.png')){res.writeHead(200,{'Content-Type':'image/png'});return res.end(png);}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"script-src 'none'; style-src 'unsafe-inline'; img-src * data:; connect-src 'none'; frame-src 'none'"});
  res.end(shell(figures+tableLink())+duplicates);
});
async function check(name,fn){try{const detail=await fn();results.push({name,passed:true,...(detail?{detail}:{})});console.log('PASS '+name);}catch(error){results.push({name,passed:false,error:error.stack});console.error('FAIL '+name+': '+error.message);}}
async function tabId(page){return worker.evaluate(async url=>(await chrome.tabs.query({})).find(t=>t.url===url).id,page.url());}
async function extract(page){return worker.evaluate(async id=>(await chrome.scripting.executeScript({target:{tabId:id},files:['src/research-capture.js']}))[0].result,await tabId(page));}
async function fixture(body){await site.setContent(shell(body));return extract(site);}
async function parse(html,link={caption,identity:'table:1'}){return parser.evaluate(async({html,link})=>(await import('./src/research-linked-tables.mjs')).parseLinkedTable(html,link),{html,link});}
async function openCapture(){const opened=context.waitForEvent('page');await worker.evaluate(id=>captureResearch(id),await tabId(site));const page=await opened;await page.waitForURL(/research.html#capture=/);return page;}
async function boundCapture(href){return worker.evaluate(async({id,href})=>{
  const tab=await chrome.tabs.get(id),result=(await chrome.scripting.executeScript({target:{tabId:id},func:()=>({href:location.href,title:document.title})}))[0];
  return QFResearch.capturePut({title:result.result.title,text:'Table 1. Source material',figures:[],tables:[],linkedTables:[{url:href,caption:'Table 1. Data',identity:'table:1',status:'pending'}],binding:{tabId:id,windowId:tab.windowId,documentId:result.documentId,title:result.result.title,urlKey:await researchUrlKey(result.result.href)}});
},{id:await tabId(site),href});}
async function fetched(id,extra={}){return worker.evaluate(({id,extra})=>fetchResearchTable({captureId:id,index:0,...extra}),{id,extra});}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;fs.mkdirSync(path.dirname(reportPath),{recursive:true});
  try{
    const extension=path.join(scratch,'extension');fs.mkdirSync(extension);
    for(const name of ['manifest.json','popup.html','popup.css','popup.js','reader.html','reader.css','reader.js','research.html','research.css','research.js','options.html','options.css','options.js','privacy.html','src','vendor','assets','_locales'])fs.cpSync(path.join(root,name),path.join(extension,name),{recursive:true});
    const manifest=JSON.parse(fs.readFileSync(path.join(extension,'manifest.json')));manifest.host_permissions=['<all_urls>'];fs.writeFileSync(path.join(extension,'manifest.json'),JSON.stringify(manifest));
    context=await chromium.launchPersistentContext(path.join(scratch,'profile'),{channel:'msedge',headless:true,viewport:{width:1440,height:1000},args:['--disable-extensions-except='+extension,'--load-extension='+extension]});
    context.setDefaultTimeout(12000);context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
    await context.route('https://media.springernature.com/**',route=>route.fulfill({body:png,contentType:'image/png'}));
    worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');base='chrome-extension://'+new URL(worker.url()).host+'/';
    await worker.evaluate(endpoint=>chrome.storage.local.set({apiStyle:'openai-compatible',endpoint,apiKey:'SYNTHETIC-LINKED-TEST',customHeaders:'{"X-QF-API-Test":"SYNTHETIC-HEADER"}',model:'fixture-model',targetLanguage:'zh-CN',streamOpenAi:true}),origin+'/v1/chat/completions');
    parser=await context.newPage();await parser.goto(base+'research.html');site=await context.newPage();await site.goto(origin+'/paper');
    await check('Springer reading-companion size/format duplicates collapse to five complete captions and one linked table',async()=>{
      const value=await extract(site);assert.equal(value.figures.length,5);assert.deepEqual(value.figures.map(f=>f.caption),Array.from({length:5},(_,i)=>`Fig. ${i+1} · Detailed evidence for outcome ${i+1}.`));assert.equal(value.tables.length,0);assert.equal(value.linkedTables.length,1);assert.equal(value.linkedTables[0].identity,'table:1');assert.equal(value.linkedTables[0].url,origin+'/tables/1');
    });
    await check('Distinct panels and query identities survive; small download controls disappear but real SVG charts remain',async()=>{
      const value=await fixture('<figure><img src="/panel.png?panel=A"><img src="/panel.png?panel=B"><figcaption>Figure 7. Panels</figcaption><button><img src="/control.png"></button><svg width="16" height="16"></svg></figure><figure><svg width="500" height="300"><rect width="500" height="300" fill="blue"/></svg><figcaption>Figure 8. SVG plot</figcaption></figure>');
      assert.equal(value.figures.length,3);assert.equal(value.figures.filter(f=>f.caption==='Figure 7. Panels').length,2);assert.equal(value.figures.filter(f=>f.kind==='svg').length,1);
    });
    await check('Link discovery rejects citations, external origins, binary downloads and already readable tables; repeated links merge',async()=>{
      const value=await fixture(tableLink()+tableLink(1,'/tables/1#table')+tableLink(2,'https://example.org/tables/2')+tableLink(3,'/full-table.pdf')+tableLink(4)+ '<table><caption>Table 4. Already readable</caption><tr><td>Group</td><td>4</td></tr></table><p>See <a href="/citation/9">Table 9</a></p>');
      assert.deepEqual(value.linkedTables.map(link=>link.url),[origin+'/tables/1']);assert.equal(value.tables.length,1);
    });
    await check('Linked table parser preserves complete 54-by-5 grid, captions, notes and Markdown',async()=>{
      const value=await parse(tableHtml);assert.equal(value.rows,54);assert.equal(value.columns,5);assert.equal(value.grid[1][0],'Study1');assert.equal(value.grid[53][4],'Site53');assert.match(value.markdown,/Study53/);assert.match(value.notes,/randomized/);assert.equal(value.caption,caption);assert.equal(value.truncated,false);
    });
    await check('Span expansion retains table values and accessible captions',async()=>{
      const value=await parse('<section><h2 id="caption">Table 1. Span values</h2><table aria-labelledby="caption"><tr><th rowspan="2">Group</th><th colspan="2">Results</th></tr><tr><td>A</td><td>B</td></tr><tr><td>Cohort</td><td>1</td><td>2</td></tr></table><p class="table-note">NOTE_WITH_UNITS</p></section>');
      assert.deepEqual(value.grid,[['Group','Results','Results'],['Group','A','B'],['Cohort','1','2']]);assert.match(value.notes,/NOTE_WITH_UNITS/);
    });
    await check('Remote scripts, image handlers and frames stay inert while hidden/script text is excluded',async()=>{
      const before=requests.length;
      const value=await parse('<script>globalThis.UNSAFE=true</script><img src="'+origin+'/UNSAFE.png" onerror="globalThis.UNSAFE=true"><iframe src="'+origin+'/UNSAFE"></iframe><table><caption>Table 1. Safe data</caption><tr><td>A<script>UNSAFE_CELL</script><span hidden>HIDDEN</span></td><td>5</td></tr></table>');
      assert.equal(value.grid[0][0],'A');assert.equal(await parser.evaluate(()=>globalThis.UNSAFE),undefined);assert.equal(requests.length,before);
    });
    await check('Challenge pages, wrong table numbers and ambiguous different same-number tables fail explicitly',async()=>{
      for(const html of ['<h1>Login required</h1>',tableHtml.replace('Table 1','Table 2'),'<table><caption>Table 1. A</caption><tr><td>A</td><td>1</td></tr></table><table><caption>Table 1. B</caption><tr><td>B</td><td>2</td></tr></table>'])await assert.rejects(()=>parse(html),/未返回匹配|多个同编号/);
    });
    if(articlePath)await check('Saved real Springer article has exactly five figures, one table link and full descriptions',async()=>{
      const page=await context.newPage(),url='https://link.springer.com/article/10.1186/s40001-026-04947-z';
      try{await page.route('**/*',route=>route.request().isNavigationRequest()?route.fulfill({body:fs.readFileSync(articlePath),contentType:'text/html',headers:{'Content-Security-Policy':"script-src 'none'; style-src 'unsafe-inline'; img-src 'none'; frame-src 'none'; connect-src 'none'"}}):route.abort());await page.goto(url);const value=await extract(page);assert.equal(value.figures.length,5);assert.deepEqual(value.figures.map(f=>f.caption.match(/^Fig\.?\s*\d+/)[0]),['Fig. 1','Fig. 2','Fig. 3','Fig. 4','Fig. 5']);assert.ok(value.figures.every(f=>f.caption.length>20));assert.equal(value.linkedTables.length,1);assert.equal(value.linkedTables[0].url,url+'/tables/1');assert.equal(value.tables.length,0);return {figures:value.figures.map(f=>({caption:f.caption,src:f.src})),linkedTables:value.linkedTables};}finally{await page.close();}
    });
    if(tablePath)await check('Saved real Springer Table 1 yields all 54 rows and 5 columns with exact first/last study data',async()=>{
      const value=await parse(fs.readFileSync(tablePath,'utf8'));assert.equal(value.rows,54);assert.equal(value.columns,5);assert.deepEqual(value.grid[0],['Article','Study Type','Age','Country','Site']);assert.match(value.grid[1][0],/Johnson\s*2015/);assert.equal(value.grid[1][3],'United States');assert.match(value.grid.at(-1)[0],/Ala\s*2018/);assert.equal(value.grid.at(-1)[3],'Iran');return {rows:value.rows,columns:value.columns,first:value.grid[1],last:value.grid.at(-1)};
    });
    await check('Research window reads source-bound tables with site cookies, without API credentials or AI, and persists copyable data',async()=>{
      await context.addCookies([{name:'QF_SITE_SESSION',value:'synthetic-session',url:origin}]);
      await site.goto(origin+'/paper');companion=await openCapture();await companion.waitForFunction(()=>document.querySelector('#linkedTableStatus').textContent.includes('已补全 1'));captureId=new URLSearchParams(new URL(companion.url()).hash.slice(1)).get('capture');
      const download=tableRequests.find(request=>request.url==='/tables/1');assert.ok(download);assert.match(download.cookie,/(?:^|;\s*)QF_SITE_SESSION=synthetic-session(?:;|$)/);assert.equal(download.authorization,'');assert.equal(download.apiKey,'');assert.equal(download.custom,'');
      assert.equal(await companion.locator('.figure-tile').count(),5);assert.equal(await companion.locator('.paper-table-card').count(),1);assert.match(await companion.locator('#tableCount').textContent(),/1 张文字表格/);assert.match(await companion.locator('#paperMaterial').inputValue(),/Study53/);assert.match(await companion.locator('#linkedTableList').textContent(),/已读取 · 可复制/);assert.equal(await companion.locator('#paperTables button:text-is("复制 TSV（Excel）")').count(),1);assert.equal(calls.length,0);
      const saved=await worker.evaluate(id=>QFResearch.captureGet(id),captureId);assert.equal(saved.tables[0].grid.length,54);assert.equal(saved.linkedTables[0].status,'loaded');assert.match(saved.text,/Study53/);
    });
    await check('Table export and explicit paper Q&A include all rows without selecting an image',async()=>{
      const download=companion.waitForEvent('download');await companion.locator('#paperTables button:text-is("下载 .tsv")').click();const file=await download;const data=fs.readFileSync(await file.path(),'utf8');assert.match(data,/Study1\tRCT/);assert.match(data,/Study53\tRCT/);assert.equal(data.trim().split(/\r?\n/).length,54);
      await companion.locator('#researchQuestion').fill('Compare the first and last studies in Table 1.');await companion.locator('#analyzePaper').click();await companion.waitForFunction(()=>document.querySelector('#paperStatus').textContent.includes('完成'));assert.equal(calls.length,1);assert.match(JSON.stringify(calls[0]),/Study53/);assert.match(JSON.stringify(calls[0]),/OBSERVATIONAL_EVIDENCE/);
    });
    await check('Reload retains downloaded tables without duplicate material or a repeated network request',async()=>{
      const before=requests.filter(url=>url==='/tables/1').length;await companion.reload();await companion.waitForFunction(()=>document.querySelectorAll('.paper-table-card').length===1);assert.equal((await companion.locator('#paperMaterial').inputValue()).match(/Study53/g).length,1);assert.equal(requests.filter(url=>url==='/tables/1').length,before);
    });
    await check('A failed table remains linked and retryable; user material edits survive retry',async()=>{
      await companion.close();tableMode='challenge';companion=await openCapture();await companion.waitForFunction(()=>document.querySelector('#linkedTableStatus').textContent.includes('未完成'));assert.equal(await companion.locator('.paper-table-card').count(),0);assert.match(await companion.locator('#linkedTableList').textContent(),/未返回匹配/);assert.equal(await companion.locator('#loadLinkedTables').isEnabled(),true);
      try{if(!await companion.locator('#editMaterial').isVisible())await companion.locator('#sourcePanel>summary').click();await companion.locator('#editMaterial').click();await companion.locator('#paperMaterial').fill('USER_EDITED_MATERIAL\nTable 1.');tableMode='normal';await companion.locator('#loadLinkedTables').click();await companion.waitForFunction(()=>document.querySelector('#linkedTableStatus').textContent.includes('已补全 1'));assert.match(await companion.locator('#paperMaterial').inputValue(),/^USER_EDITED_MATERIAL/);assert.match(await companion.locator('#paperMaterial').inputValue(),/Study53/);assert.equal(calls.length,1);}finally{tableMode='normal';}
    });
    await check('Downloads only use stored same-origin links and reject invalid indices and privileged page callers',async()=>{
      const id=await boundCapture(origin+'/tables/1');try{const value=await fetched(id,{url:origin+'/UNREQUESTED',href:origin+'/UNREQUESTED'});assert.match(value.html,/Study53/);assert.ok(!requests.includes('/UNREQUESTED'));await assert.rejects(()=>fetched(id,{index:-1}),/不存在/);await assert.rejects(()=>fetched(id,{index:.5}),/不存在/);
        const options=await context.newPage();try{await options.goto(base+'options.html');const denied=await options.evaluate(id=>chrome.runtime.sendMessage({type:'RESEARCH_TABLE_FETCH',captureId:id,index:0}),id);assert.equal(denied.ok,false);}finally{await options.close();}
      }finally{await worker.evaluate(id=>QFResearch.captureDelete(id),id);}
      for(const url of ['https://example.org/tables/1','javascript:alert(1)']){const id=await boundCapture(url);try{await assert.rejects(()=>fetched(id),/原论文网站/);}finally{await worker.evaluate(id=>QFResearch.captureDelete(id),id);}}
    });
    await check('HTTP errors, redirects, wrong MIME and oversized declared/streamed table pages fail without following redirects',async()=>{
      for(const mode of ['http','redirect','mime','large','chunked']){const id=await boundCapture(origin+'/tables/1?mode='+mode);try{await assert.rejects(()=>fetched(id));}finally{await worker.evaluate(id=>QFResearch.captureDelete(id),id);}}
      assert.ok(!requests.includes('/redirect-target'));
    });
    await check('Navigated or expired source documents cannot fetch linked tables',async()=>{
      const id=await boundCapture(origin+'/tables/1');await site.goto(origin+'/changed-paper');try{await assert.rejects(()=>fetched(id),/刷新|切换|跳转/);}finally{await worker.evaluate(id=>QFResearch.captureDelete(id),id);}
      await assert.rejects(()=>fetched('missing-capture'),/过期/);
    });
    await check('Source changes during a table download reject stale results before they reach material',async()=>{
      const id=await boundCapture(origin+'/tables/1');tableDelay=500;
      try{const pending=fetched(id).then(value=>({value}),error=>({error}));await site.waitForRequest('**/tables/1');await site.goto(origin+'/another-paper');const result=await pending;assert.ok(result.error);assert.match(result.error.message,/刷新|切换|跳转/);}finally{tableDelay=0;await worker.evaluate(id=>QFResearch.captureDelete(id),id);}
    });
    await check('Queued concurrent saves append once and reject invalid table grids',async()=>{
      const id=await boundCapture(origin+'/tables/1'),table=await parse(tableHtml);
      try{const values=await worker.evaluate(({id,table})=>Promise.all([QFResearch.captureSaveTable(id,0,table),QFResearch.captureSaveTable(id,0,table)]),{id,table});assert.equal(values.filter(v=>v.duplicate).length,1);const saved=await worker.evaluate(id=>QFResearch.captureGet(id),id);assert.equal(saved.tables.length,1);assert.equal(saved.text.match(/Study53/g).length,1);}finally{await worker.evaluate(id=>QFResearch.captureDelete(id),id);}
      const bad=await boundCapture(origin+'/tables/1');try{await assert.rejects(()=>worker.evaluate(id=>QFResearch.captureSaveTable(id,0,{grid:[[42]],markdown:'42'}),bad),/无效/);}finally{await worker.evaluate(id=>QFResearch.captureDelete(id),bad);}
    });
    await check('Loaded tables clear reference gaps; pending or failed table links stay explicitly unread',async()=>{
      const assess=async value=>parser.evaluate(async value=>(await import('./src/research-coverage.mjs')).assessResearchCapture(value).issues,value);
      assert.equal((await assess({text:'Table 1.',linkedTables:[{identity:'table:1',caption}]}))[0].reason,'linked');assert.match((await assess({text:'Table 1.',linkedTables:[{identity:'table:1',error:'failed'}]}))[0].text,/未完成/);assert.deepEqual(await assess({text:'Table 1.',tables:[{caption}]}),[]);
    });
    await check('All four interfaces show the running version at the bottom; research stays usable at narrow widths',async()=>{
      for(const file of ['popup.html','options.html','reader.html','research.html']){const page=await context.newPage();try{await page.goto(base+file);await page.locator('.product-version').waitFor();assert.equal(await page.locator('.product-version').textContent(),'QudadFlow Translator · v'+version);assert.equal(await page.evaluate(()=>document.body.lastElementChild.matches('.product-version')),true);if(file==='reader.html'){const box=await page.locator('.product-version').boundingBox();assert.ok(box.y>=0&&box.y+box.height<=1001);}}finally{await page.close();}}
      await companion.close();await site.goto(origin+'/paper');companion=await openCapture();
      await companion.waitForFunction(()=>document.querySelector('#linkedTableStatus').textContent.includes('已补全 1'));
      await companion.getByRole('button',{name:'展开全部表格',exact:true}).click();
      for(const width of [390,620,1440]){await companion.setViewportSize({width,height:1000});assert.equal(await companion.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await companion.screenshot({path:path.join(path.dirname(reportPath),`qudadflow-linked-tables-${width}-v${version}.png`),fullPage:true});}
    });
    await check('No unhandled browser errors and no automatic AI calls',async()=>{assert.deepEqual(errors,[]);assert.equal(calls.length,1);});
  }catch(error){results.push({name:'setup',passed:false,error:error.stack});console.error(error);}
  finally{
    await context?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
    assert.ok(path.resolve(scratch).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(scratch).startsWith('qudadflow-linked-'));fs.rmSync(scratch,{recursive:true,force:true,maxRetries:5,retryDelay:200});
    const report={version,scope:'Isolated Edge, synthetic API and optional saved public Springer DOM. No user profile, live publisher fetch or real AI accuracy test.',passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results};fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,failed:report.failed}));if(report.failed)process.exitCode=1;
  }
})();
