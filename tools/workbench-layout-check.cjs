/* Isolated Edge only. Generated papers, images and synthetic AI responses; no user profile or credentials. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),reportPath=path.resolve(process.argv[2]||'workbench-layout-results.json');
const {zipSync,strToU8}=require(path.join(root,'vendor/fflate/umd/index.js'));
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'qf-workbench-')),results=[],calls=[],errors=[],unexpected=[],images=[];
const version=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'))).version;
let context,worker,origin,base,research,reader,hold=false,release;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn){for(let i=0;i<200;i++){if(await fn())return;await delay(25);}throw new Error('Condition did not settle');}
async function check(name,fn){try{await fn();results.push({name,passed:true});console.log('PASS '+name);}catch(error){results.push({name,passed:false,error:error.stack});console.error('FAIL '+name+': '+error.message);}}
async function stage(page,key){await page.locator('#figureWorkflow').evaluate(e=>e.open=true);await page.locator('#figure-tab-'+key).click();}
async function expanded(page,value=true){if(await page.locator('#expandFigureWorkbench').getAttribute('aria-expanded')!==String(value))await page.locator('#expandFigureWorkbench').click();}
async function noOverflow(page){const size=await page.evaluate(()=>{const shell=document.querySelector('.workbench-focus-shell[open]');return {width:innerWidth,page:document.documentElement.scrollWidth,shell:shell?.clientWidth,content:shell?.scrollWidth};});assert.ok(size.page<=size.width+1&&(!size.shell||size.content<=size.shell+1),JSON.stringify(size));}
const answer='# Evidence review · simulated response\n\nThis is a generated paper and a synthetic answer used to check the interface.\n\n## What the figure contributes\n\nThe chart compares three cohorts over the same observation period. Compare the effect size, uncertainty and study design before interpreting the apparent trend.\n\n| Evidence | Observation | Limitation |\n| --- | --- | --- |\n| Figure 1 | Cohort differences | No causal inference |\n| Table 1 | Group definitions | Generated sample data |\n\n'+Array.from({length:10},(_,i)=>`## Check ${i+1}\n\nThe full answer stays in the reading column. The question, selected figures and export controls remain available without opening another small scroll box.`).join('\n\n');
const server=http.createServer(async(req,res)=>{
  if(req.method==='GET'){
    if(req.url.endsWith('/models')){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({data:[{id:'example-vision-model'}]}));}
    if(req.url.startsWith('/figure-')){res.setHeader('Content-Type','image/png');return res.end(images[Number(req.url.match(/figure-(\d+)/)[1])-1]);}
    res.setHeader('Content-Type','text/html; charset=utf-8');return res.end('<!doctype html><meta charset="utf-8"><title>Generated evidence study</title><article style="max-width:900px;font:16px Arial"><h1>Generated evidence study</h1><p>Local UI fixture only. This paper compares cohort responses and their uncertainty, with no real patient data.</p><table><caption>Table 1. Cohort definitions</caption><tr><th>Group</th><th>Participants</th><th>Response</th></tr><tr><td>Control</td><td>120</td><td>0.42</td></tr><tr><td>Treatment</td><td>118</td><td>0.67</td></tr></table>'+images.map((_,i)=>`<figure><img src="/figure-${i+1}.png" width="540" height="312"><figcaption>Figure ${i+1}. Cohort response comparison.</figcaption></figure>`).join('')+'</article>');
  }
  let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);const call={body,aborted:false};calls.push(call);res.once('close',()=>call.aborted=!res.writableEnded);
  const prompt=JSON.stringify(body.messages||body.input||'');
  if(/locali[sz]|bounding|coordinate_system/i.test(prompt)){
    res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({coordinate_system:'normalized_1000',figures:[{kind:'figure',label:'Figure 2',caption:'Generated chart on page two',box:[70,200,800,550]}]})}}]}));
  }
  res.writeHead(200,{'Content-Type':'text/event-stream'});res.write('data: '+JSON.stringify({choices:[{delta:{content:answer.slice(0,80)}}]})+'\n\n');
  const finish=()=>{if(!res.destroyed)res.end('data: '+JSON.stringify({choices:[{delta:{content:answer.slice(80)}}]})+'\n\ndata: [DONE]\n\n');};
  if(hold)release=finish;else finish();
});
function pdf(){
  const line=(s,x,y)=>`BT /F1 12 Tf ${x} ${y} Td (${s}) Tj ET\n`;
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Count 2 /Kids [4 0 R 6 0 R] >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  for(const n of [1,2]){const text=line('Generated PDF study - page '+n,45,748)+'0.2 0.4 0.7 rg 60 400 110 160 re f 0.2 0.65 0.65 rg 210 400 110 230 re f 0.6 0.7 0.85 rg 360 400 110 120 re f\n'+line(n===1?'Figure 1. Cohort response comparison.':'Local generated chart without a formal caption.',45,365);const id=objects.length+1;objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${id+1} 0 R >>`,`<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`);}
  let text='%PDF-1.4\n',offsets=[];objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(text));text+=`${i+1} 0 obj\n${o}\nendobj\n`;});const xref=Buffer.byteLength(text);return Buffer.from(text+`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
}
async function openDocument(name,buffer){await reader.locator('#file').setInputFiles({name,mimeType:'application/octet-stream',buffer:Buffer.from(buffer)});await reader.waitForFunction(()=>document.getElementById('cancelLoad').hidden);assert.match(await reader.locator('#status').textContent(),/文档已打开/);}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;fs.mkdirSync(path.dirname(reportPath),{recursive:true});
  try{
    const extension=path.join(scratch,'extension');const {runtimeFiles}=await import(pathToFileURL(path.join(root,'tools/package-files.mjs')));
    for(const file of runtimeFiles(root)){fs.mkdirSync(path.dirname(path.join(extension,file)),{recursive:true});fs.copyFileSync(path.join(root,file),path.join(extension,file));}
    const manifest=JSON.parse(fs.readFileSync(path.join(extension,'manifest.json')));manifest.host_permissions=['http://127.0.0.1/*'];fs.writeFileSync(path.join(extension,'manifest.json'),JSON.stringify(manifest));
    context=await chromium.launchPersistentContext(path.join(scratch,'profile'),{channel:'msedge',headless:true,viewport:{width:1440,height:1000},args:['--disable-extensions-except='+extension,'--load-extension='+extension]});
    context.on('page',page=>{page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));});
    context.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(origin))unexpected.push(r.url().split('?')[0]);});
    worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');base='chrome-extension://'+new URL(worker.url()).host+'/';
    const painter=await context.newPage();const generated=await painter.evaluate(()=>Array.from({length:8},(_,i)=>{
      const c=document.createElement('canvas');c.width=900;c.height=520;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,900,520);x.fillStyle='#203653';x.font='bold 23px Arial';x.fillText('Figure '+(i+1)+'. Cohort response',45,46);x.font='14px Arial';x.fillStyle='#7a8aa1';x.fillText('GENERATED INTERFACE SAMPLE · NO CLINICAL DATA',45,74);
      for(let j=0;j<5;j++){const y=380-j*65;x.strokeStyle='#e4eaf2';x.beginPath();x.moveTo(80,y);x.lineTo(850,y);x.stroke();x.fillStyle='#7c8da5';x.fillText(String(j*20),42,y+5);}
      ['Control','Treatment A','Treatment B'].forEach((label,j)=>{const h=130+(j*53+i*23)%150,px=150+j*230;x.fillStyle=['#4b78d2','#4aa69e','#97add3'][j];x.fillRect(px,380-h,115,h);x.strokeStyle='#243c60';x.lineWidth=2;x.beginPath();x.moveTo(px+57,380-h-23);x.lineTo(px+57,380-h+23);x.moveTo(px+42,380-h-23);x.lineTo(px+72,380-h-23);x.stroke();x.fillStyle='#516680';x.font='17px Arial';x.fillText(label,px-3,415);});
      x.fillStyle='#7a8aa1';x.font='14px Arial';x.fillText('Illustrative response rate · 95% uncertainty interval',80,477);return c.toDataURL('image/png').split(',')[1];
    }));images.push(...generated.map(s=>Buffer.from(s,'base64')));await painter.close();
    await worker.evaluate(endpoint=>chrome.storage.local.set({apiStyle:'openai-compatible',endpoint,apiKey:'SYNTHETIC-WORKBENCH-KEY',model:'example-vision-model',targetLanguage:'zh-CN',streamOpenAi:true}),origin+'/v1/chat/completions');
    const site=await context.newPage();await site.goto(origin+'/paper');const tabId=await worker.evaluate(async url=>(await chrome.tabs.query({})).find(t=>t.url===url).id,site.url());
    const opened=context.waitForEvent('page');await worker.evaluate(id=>captureResearch(id),tabId);research=await opened;await research.waitForFunction(()=>document.querySelectorAll('.figure-tile').length===8);
    await stage(research,'gallery');if(await research.locator('#loadFilteredFigures').isVisible())await research.locator('#loadFilteredFigures').click();await research.waitForFunction(()=>document.querySelectorAll('.figure-card').length===8&&!document.querySelector('#figureSearch').disabled);
    await check('Research expands to a modal workspace with larger previews, native tables and the same selections',async()=>{
      await stage(research,'analysis');await research.locator('#researchQuestion').fill('Keep this draft and selected figure.');await stage(research,'gallery');await research.locator('#figureSearch').fill('Figure 2');await research.locator('#selectVisibleFigures').click();
      const before=calls.length;await expanded(research);assert.equal(await research.locator('dialog:modal').count(),1);assert.equal(await research.locator('.workbench-focus-shell #tablePanel table').count(),1);assert.match(await research.locator('.workbench-focus-shell>.product-version').textContent(),new RegExp('v'+version.replaceAll('.','\\.')));
      const box=await research.locator('.workbench-focus-shell').boundingBox();assert.ok(box.width>1400&&box.height>960,JSON.stringify(box));assert.ok((await research.locator('.figure-tile:not([hidden]) .figure-tile-preview').boundingBox()).height>=190);await noOverflow(research);
      await research.keyboard.press('Escape');assert.equal(await research.locator('dialog[open]').count(),0);assert.equal(await research.locator('.source-column #tablePanel table').count(),1);assert.equal(await research.locator('#figureSearch').inputValue(),'Figure 2');assert.equal(await research.locator('.figure-tile input:checked').count(),1);assert.equal(await research.locator('#researchQuestion').inputValue(),'Keep this draft and selected figure.');assert.equal(calls.length,before);assert.equal(await research.locator('#expandFigureWorkbench').evaluate(e=>e===document.activeElement),true);
    });
    await check('Expanded gallery keeps bulk actions visible while scrolling and keyboard focus stays inside',async()=>{
      await expanded(research);await research.locator('#figureSearch').fill('');await research.locator('#selectAllFigures').click();assert.equal(await research.locator('.figure-tile input:checked').count(),8);
      await research.locator('#figure-panel-gallery').evaluate(e=>e.scrollTop=400);const toolbar=await research.locator('.figure-picker-toolbar').boundingBox(),panel=await research.locator('#figure-panel-gallery').boundingBox();assert.ok(toolbar.y>=panel.y-20&&toolbar.y<panel.y+30,JSON.stringify({toolbar,panel}));
      await research.locator('#expandFigureWorkbench').focus();for(let i=0;i<32;i++){await research.keyboard.press('Tab');assert.equal(await research.evaluate(()=>!!document.activeElement.closest('dialog')),true);}
      await research.locator('#figure-panel-gallery').evaluate(e=>e.scrollTop=0);await research.screenshot({path:path.join(path.dirname(reportPath),'workbench-gallery-desktop.png')});
    });
    await check('Expanding and returning during an AI answer preserves the request, draft and full response',async()=>{
      await research.locator('#clearFigureSelection').click();await stage(research,'analysis');await research.locator('#researchQuestion').fill('Explain the evidence and its limitations.');hold=true;const before=calls.length;await research.locator('#analyzePaper').click();await until(()=>calls.length>before);await research.waitForFunction(()=>document.querySelector('#paperOutput').textContent.length>0);
      await expanded(research,false);assert.equal(calls.length,before+1);assert.equal(calls.at(-1).aborted,false);await expanded(research);assert.equal(calls.length,before+1);assert.equal(calls.at(-1).aborted,false);hold=false;release();await research.waitForFunction(()=>document.querySelector('#paperStatus').textContent.startsWith('分析完成'));
      assert.match(await research.locator('#paperOutput').textContent(),/Check 10/);const style=await research.locator('#paperOutput').evaluate(e=>({height:e.clientHeight,scroll:e.scrollHeight,max:getComputedStyle(e).maxHeight}));assert.equal(style.max,'none');assert.ok(style.scroll<=style.height+1,JSON.stringify(style));
      const compose=await research.locator('.workbench-compose').boundingBox(),answers=await research.locator('.workbench-answers').boundingBox();assert.ok(answers.x>compose.x+compose.width);await noOverflow(research);await research.screenshot({path:path.join(path.dirname(reportPath),'workbench-analysis-desktop.png')});
    });
    reader=await context.newPage();await reader.goto(base+'reader.html');await openDocument('generated-study.pdf',pdf());
    await check('PDF extraction and expanded workbench preserve the document, loaded figures and crop return path',async()=>{
      await stage(reader,'acquire');const before=calls.length;await reader.locator('#extractDocumentFigures').click();await reader.waitForFunction(()=>document.getElementById('stopExtraction').hidden);assert.ok(await reader.locator('.figure-card').count()>=1);await expanded(reader);await stage(reader,'gallery');await noOverflow(reader);assert.equal(calls.length,before);
      await reader.screenshot({path:path.join(path.dirname(reportPath),'workbench-pdf-desktop.png')});await stage(reader,'acquire');await reader.locator('.workbench-manual').evaluate(e=>e.open=true);await reader.locator('#cropFigure').click();assert.equal(await reader.locator('dialog[open]').count(),0);assert.equal(await reader.locator('.figure-crop-layer').count(),1);await reader.keyboard.press('Escape');assert.equal(await reader.locator('dialog:modal').count(),0);assert.equal(await reader.locator('.figure-crop-layer').count(),0);assert.equal(await reader.locator('#pageNumber').inputValue(),'1');
      await expanded(reader);await reader.locator('#cropFigure').click();const crop=await reader.locator('.figure-crop-layer').boundingBox();await reader.mouse.move(crop.x+35,crop.y+35);await reader.mouse.down();await reader.mouse.move(crop.x+175,crop.y+110);await reader.mouse.up();await until(async()=>await reader.locator('dialog:modal').count()===1);assert.equal(await reader.locator('.figure-crop-layer').count(),0);assert.equal(calls.length,before);
    });
    await check('AI candidate review can reveal the original PDF page and return without losing the candidate',async()=>{
      await expanded(reader);await stage(reader,'gallery');await reader.locator('#aiFigureControls').evaluate(e=>e.open=true);await reader.locator('#aiFigurePages').fill('2');await reader.locator('#enhancePdfFigures').click();await reader.waitForFunction(()=>document.querySelector('.pdf-detection-preview'));assert.equal(await reader.locator('dialog:modal').count(),1);
      await reader.locator('.pdf-detection-source').click();assert.equal(await reader.locator('dialog[open]').count(),0);await reader.waitForFunction(()=>document.querySelector('#pageNumber').value==='2');assert.equal(await reader.locator('.pdf-detection-card').count(),1);await expanded(reader);await reader.getByRole('button',{name:/加入所选/}).click();await reader.waitForFunction(()=>document.querySelector('#stopExtraction').hidden);assert.equal(await reader.locator('.pdf-detection-preview').count(),0);assert.ok(await reader.locator('.figure-card').count()>=2);
    });
    await check('DOCX, TXT and Markdown share the focused workbench and retain their figures on return',async()=>{
      const docx=zipSync({'word/document.xml':strToU8('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Generated Word material for the shared workbench.</w:t></w:r></w:p></w:body></w:document>')});
      for(const [name,data]of [['study.docx',docx],['study.txt',Buffer.from('Generated plain text study material.')],['study.md',Buffer.from('# Generated study\n\nMarkdown evidence material.')]]){
        await expanded(reader,false);await openDocument(name,data);await stage(reader,'acquire');await reader.locator('#figureImageFile').setInputFiles({name:'Figure 1.png',mimeType:'image/png',buffer:images[0]});await reader.waitForFunction(()=>document.querySelectorAll('.figure-card').length===1);await expanded(reader);await stage(reader,'gallery');await reader.locator('#selectAllFigures').click();await reader.keyboard.press('Escape');assert.equal(await reader.locator('.figure-tile input:checked').count(),1);assert.equal(await reader.locator('.figure-card').count(),1);assert.equal(await reader.locator('#translatePage').isEnabled(),true);
      }
    });
    await check('Research and document workbenches remain usable at laptop and phone sizes without page overflow',async()=>{
      for(const page of [research,reader]){await expanded(page);for(const [width,height]of [[820,720],[390,844]]){await page.setViewportSize({width,height});await stage(page,'gallery');await noOverflow(page);await stage(page,'analysis');await noOverflow(page);assert.equal(await page.locator('#researchQuestion').isVisible(),true);await page.locator('#expandFigureWorkbench').scrollIntoViewIfNeeded();assert.equal(await page.locator('#expandFigureWorkbench').isVisible(),true);}
        await stage(page,'gallery');await page.screenshot({path:path.join(path.dirname(reportPath),page===research?'workbench-research-phone.png':'workbench-reader-phone.png')});await page.keyboard.press('Escape');await noOverflow(page);
      }
    });
    await check('UI operations have no uncaught browser errors or non-fixture network requests',()=>{assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);});
  }catch(error){results.push({name:'Harness',passed:false,error:error.stack});console.error(error.stack);}
  finally{
    hold=false;release?.();await context?.close();server.closeAllConnections?.();await new Promise(resolve=>server.close(resolve));
    const report={version,scope:'Generated papers and figures in isolated Edge; synthetic API only. No user browser, credentials or publication.',passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results};fs.writeFileSync(reportPath,JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failed:report.failed}));
    const target=path.resolve(scratch),tempRoot=path.resolve(os.tmpdir());assert.equal(path.dirname(target),tempRoot);assert.ok(path.basename(target).startsWith('qf-workbench-'));fs.rmSync(target,{recursive:true,force:true});if(report.failed)process.exitCode=1;
  }
})();
