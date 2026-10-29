/* Real local PDFs with manually annotated crop fixtures, synthetic vision API.
 * The external fixture file and all page/crop pixels stay outside packages. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),reportPath=path.resolve(process.argv[2]),samples=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'qf-pdf-samples-')),results=[],calls=[],errors=[],unexpected=[];
const version=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'))).version;
let context,active,next=0,origin;
async function check(name,fn){try{const detail=await fn();results.push({name,passed:true,...(detail?{detail}:{})});console.log('PASS '+name);}catch(error){results.push({name,passed:false,error:error.stack});console.log('FAIL '+name+': '+error.message);throw error;}}
const server=http.createServer(async(req,res)=>{
 try{
  let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw),parts=body.messages.at(-1).content,prompt=parts.find(p=>p.type==='text').text;
  assert.match(body.messages[0].content,/Locate scientific figures/);assert.ok(active.annotations[next],'Unexpected localisation retry');
  const annotation=active.annotations[next++],size=prompt.match(/Submitted image size: (\d+) x (\d+) pixels/);assert.ok(size);
  const [width,height]=size.slice(1).map(Number),unit=annotation.unit||'normalized_1000',format=annotation.format||'xywh';
  let box=annotation.box.slice();if(format==='xyxy')box=[box[0],box[1],box[0]+box[2],box[1]+box[3]];
  if(unit==='normalized_1')box=box.map(n=>n/1000);if(unit==='pixels')box=box.map((n,j)=>n*(j%2?height:width)/1000);
  calls.push({sample:active.id,page:annotation.page,body,width,height});
  const content=JSON.stringify({coordinate_system:unit,box_format:format,figures:[{kind:annotation.kind,label:annotation.label,caption:'Manually annotated test crop: '+annotation.label,box}]});
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({choices:[{message:{content}}]}));
 }catch(error){errors.push(error.message);res.writeHead(500);res.end('Fixture failure');}
});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
try{
 const extension=path.join(scratch,'extension');fs.mkdirSync(extension);
 for(const name of ['manifest.json','offscreen-translation.html','popup.html','popup.css','popup.js','reader.html','reader.css','reader.js','research.html','research.css','research.js','options.html','options.css','options.js','privacy.html','src','vendor','assets','_locales'])fs.cpSync(path.join(root,name),path.join(extension,name),{recursive:true});
 const manifest=JSON.parse(fs.readFileSync(path.join(extension,'manifest.json')));manifest.host_permissions=['http://127.0.0.1/*'];fs.writeFileSync(path.join(extension,'manifest.json'),JSON.stringify(manifest));
 context=await chromium.launchPersistentContext(path.join(scratch,'profile'),{channel:'msedge',headless:true,viewport:{width:1480,height:1050},args:['--disable-extensions-except='+extension,'--load-extension='+extension]});
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 context.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(origin))unexpected.push(r.url().split('?')[0]);});
 await worker.evaluate(endpoint=>chrome.storage.local.set({apiStyle:'openai-compatible',endpoint,apiKey:'SYNTHETIC-SAMPLE-KEY',model:'fixture-samples',streamOpenAi:false}),origin+'/v1/chat/completions');
 await page.goto('chrome-extension://'+new URL(worker.url()).host+'/reader.html');fs.mkdirSync(path.dirname(reportPath),{recursive:true});
 const finish=()=>page.waitForFunction(()=>document.getElementById('stopExtraction').hidden,null,{timeout:120000});
 async function open(sample){await page.locator('#file').setInputFiles({name:sample.id+'.pdf',mimeType:'application/pdf',buffer:fs.readFileSync(sample.path)});await page.waitForFunction(()=>document.getElementById('cancelLoad').hidden&&!document.getElementById('enhancePdfFigures').disabled);}
 async function extract(){await page.locator('#figureWorkflow').evaluate(e=>e.open=true);await page.locator('#figure-tab-acquire').click();await page.locator('#extractDocumentFigures').click();await finish();}
 for(const sample of samples){
  await check(sample.id+': full local extraction retains every expected named figure/table segment and excludes legends-only pages',async()=>{
   await open(sample);assert.equal(Number(await page.locator('#pageCount').textContent()),sample.pages);const before=calls.length;await extract();
   const labels=await page.locator('.figure-card strong').allTextContents();assert.equal(labels.length,sample.local.length,JSON.stringify(labels));
   for(const item of sample.local)assert.equal(labels.filter(l=>l.startsWith('第 '+item.page+' 页')&&l.includes(item.label)).length,1,JSON.stringify(item));
   assert.equal(calls.length,before);assert.equal(await page.locator('#figure-tab-gallery').getAttribute('aria-selected'),'true');
   await page.screenshot({path:path.join(path.dirname(reportPath),`qudadflow-${sample.id}-local-v${version}.png`)});
   return {pages:sample.pages,segments:labels.length};
  });
  await check(sample.id+': native table exports preserve expected columns with one header per continued segment',async()=>{
   const tables=await page.locator('.document-tables table').evaluateAll(nodes=>nodes.map(t=>Array.from(t.rows,r=>Array.from(r.cells,c=>c.textContent))));
   assert.deepEqual(tables.map(g=>g[0].length),sample.columns);assert.ok(tables.every(g=>g.every(r=>r.length===g[0].length)));
   assert.doesNotMatch(JSON.stringify(tables),/ARTICLE IN PRESS|ACCEPTED MANUSCRIPT/);
   for(const grid of tables){const header=JSON.stringify(grid[0].map(v=>v.replace(/\s/g,'').toLowerCase()));assert.ok(grid.slice(1).every(row=>JSON.stringify(row.map(v=>v.replace(/\s/g,'').toLowerCase()))!==header));}
   return {tables:tables.length,columns:sample.columns};
  });
  await check(sample.id+': repeating local extraction does not duplicate crops or send API requests',async()=>{
   const before=calls.length;await extract();assert.equal(await page.locator('.figure-card').count(),sample.local.length);assert.equal(calls.length,before);
  });
  await check(sample.id+': real page images accept annotated fractional, pixel and corner formats without aborting the selected page batch',async()=>{
   await open(sample);active=sample;next=0;const before=calls.length;await page.locator('#figureWorkflow').evaluate(e=>e.open=true);await page.locator('#figure-tab-gallery').click();if(!await page.locator('#aiFigureControls').evaluate(e=>e.open))await page.locator('#aiFigureControls>summary').click();
   await page.locator('#aiFigurePages').fill(sample.annotations.map(a=>a.page).join(','));assert.equal(calls.length,before);await page.locator('#enhancePdfFigures').click();await page.locator('.pdf-detection-preview').waitFor({timeout:120000});
   assert.equal(calls.length-before,sample.annotations.length);assert.equal(await page.locator('.pdf-detection-card').count(),sample.annotations.length);assert.equal(await page.locator('.figure-card').count(),0);
   const sizes=await page.locator('.pdf-detection-card img').evaluateAll(imgs=>Promise.all(imgs.map(async i=>{await i.decode();return [i.naturalWidth,i.naturalHeight];})));
   sizes.forEach(([width,height],i)=>{const annotation=sample.annotations[i],call=calls[before+i],expected=(annotation.box[2]/annotation.box[3])*(call.width/call.height);assert.ok(Math.abs(width/height-expected)<.025,JSON.stringify({i,width,height,expected}));assert.ok(width>60&&height>60);});
   assert.equal(await page.locator('dialog:modal').count(),0);assert.equal(await page.locator('#next').isEnabled(),true);
   await page.screenshot({path:path.join(path.dirname(reportPath),`qudadflow-${sample.id}-ai-preview-v${version}.png`)});
   return {pagesSent:sample.annotations.map(a=>a.page),formats:sample.annotations.map(a=>(a.unit||'normalized_1000')+'/'+(a.format||'xywh'))};
  });
  await check(sample.id+': explicit confirmation adds bounded crops and keeps the gallery supplement entry in place',async()=>{
   await page.getByRole('button',{name:'加入所选（'+sample.annotations.length+'）',exact:true}).click();await finish();assert.equal(await page.locator('.figure-card').count(),sample.annotations.length);
   assert.equal(await page.locator('#figure-tab-gallery').getAttribute('aria-selected'),'true');assert.equal(await page.locator('#aiFigureControls').evaluate(e=>e.closest('[role=tabpanel]').id),'figure-panel-gallery');
   const crops=await page.locator('.figure-card img').evaluateAll(imgs=>imgs.map(i=>i.src));crops.forEach((data,i)=>fs.writeFileSync(path.join(path.dirname(reportPath),`qudadflow-${sample.id}-ai-crop-${i+1}-v${version}.jpg`),Buffer.from(data.split(',')[1],'base64')));
  });
  await check(sample.id+': subsequent AI localisation recognizes existing crops without replacing analyses or showing duplicate candidates',async()=>{
   next=0;await page.locator('#enhancePdfFigures').click();await finish();assert.equal(await page.locator('.pdf-detection-preview').count(),0);assert.equal(await page.locator('.figure-card').count(),sample.annotations.length);assert.match(await page.locator('#figureStatus').textContent(),/未发现新的/);
  });
 }
 await check('No uncaught errors, external network requests or unexpected correction calls',async()=>{assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);});
}catch(error){if(!results.some(r=>!r.passed))results.push({name:'setup',passed:false,error:error.stack});console.error(error.message);}
finally{
 await context?.close();server.closeAllConnections();await new Promise(r=>server.close(r));assert.ok(path.resolve(scratch).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(scratch).startsWith('qf-pdf-samples-'));fs.rmSync(scratch,{recursive:true,force:true,maxRetries:5,retryDelay:200});
 const report={version,scope:'Three user-supplied local PDFs; isolated Edge and manually annotated simulated vision responses. No real model accuracy claim. Private fixtures, page pixels and filenames are excluded from packages.',passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results};fs.mkdirSync(path.dirname(reportPath),{recursive:true});fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,failed:report.failed}));if(report.failed)process.exitCode=1;
}})();
