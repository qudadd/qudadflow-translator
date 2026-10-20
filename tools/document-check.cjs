/* Isolated Edge + real bundled parsers. Uses synthetic API credentials and generated fixtures only. */
const fs=require('node:fs'), path=require('node:path'), os=require('node:os'), http=require('node:http'), assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'), reportPath=path.resolve(process.argv[2]||'document-results.json');
const {zipSync,strToU8}=require(path.join(root,'vendor/fflate/umd/index.js'));
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'qudadflow-documents-'));
const results=[], requests=[], browserErrors=[], unexpectedUrls=[];
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let mode='normal', scenario=0, context, smoke, origin, active=0, peak=0;
async function check(name,fn){const start=Date.now();try{await fn();results.push({name,passed:true,milliseconds:Date.now()-start});console.log('PASS '+name);}catch(error){results.push({name,passed:false,error:error.message,milliseconds:Date.now()-start});console.log('FAIL '+name+': '+error.message);}}
// A valid multi-page PDF: single column, two columns, then an image-like page without text.
function makePdf(streams,rotation=0){
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Count '+streams.length+' /Kids ['+streams.map((_,i)=>(4+i*2)+' 0 R').join(' ')+'] >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  for(const stream of streams){const id=objects.length+1;objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Rotate '+rotation+' /Resources << /Font << /F1 3 0 R >> >> /Contents '+(id+1)+' 0 R >>','<< /Length '+Buffer.byteLength(stream)+' >>\nstream\n'+stream+'\nendstream');}
  let pdf='%PDF-1.4\n',offsets=[0];objects.forEach((object,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=(i+1)+' 0 obj\n'+object+'\nendobj\n';});
  const xref=Buffer.byteLength(pdf);pdf+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('');
  pdf+='trailer\n<< /Size '+(objects.length+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';return Buffer.from(pdf);
}
const line=(text,x,y,size=12)=>'BT /F1 '+size+' Tf '+x+' '+y+' Td ('+text+') Tj ET\n';
const pdf=makePdf([
  '0.18 0.31 0.52 rg\n'+line('QudadFlow Document Reader',48,720,24)+line('Hello world. Read the original beside its translation.',48,670)+line('Good morning. Your document stays in this browser.',48,625)+line('Translate only when you choose to begin.',48,580),
  Array.from({length:6},(_,i)=>line('Left column line '+(i+1)+'.',48,700-i*20)+line('Right column line '+(i+1)+'.',330,700-i*20)).join(''),
  '0.88 0.91 0.97 rg 60 120 480 560 re f'
]);
const xml='<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Hello world</w:t></w:r></w:p><w:p><w:r><w:t>Good morning 中文🙂</w:t></w:r><w:r><w:tab/><w:t>Second phrase.</w:t></w:r><w:del><w:r><w:delText>DELETED SECRET</w:delText></w:r></w:del><w:r><w:rPr><w:vanish/></w:rPr><w:t>HIDDEN SECRET</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Table cell text</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>';
const docx=zipSync({'[Content_Types].xml':strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),'word/document.xml':strToU8(xml),'word/header1.xml':strToU8('<secret>HEADER SECRET</secret>')});
const translate=text=>'译文：'+String(text).replace(/Hello world/g,'你好，世界').replace(/Good morning/g,'早上好').replace(/Read the original beside its translation./g,'对照原文阅读译文。').replace(/Your document stays in this browser./g,'你的文档保留在浏览器中。').replace(/Translate only when you choose to begin./g,'只有主动点击后才开始翻译。');
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(req.method==='GET'){
    if(url.pathname==='/sample.pdf'){res.writeHead(200,{'Content-Type':'application/pdf'});return res.end(pdf);}
    if(url.pathname==='/oversized.pdf'){res.writeHead(200,{'Content-Type':'application/pdf','Content-Length':30*1024*1024});return res.end();}
    if(url.pathname==='/slow.pdf'){await delay(1500);res.writeHead(200,{'Content-Type':'application/pdf'});return res.end(pdf);}
    if(url.pathname==='/attachment'){res.writeHead(200,{'Content-Type':'text/plain','Content-Disposition':"attachment; filename*=UTF-8''notes.txt"});return res.end('Hello world attachment');}
    res.writeHead(200,{'Content-Type':'text/html'});return res.end('<!doctype html><title>Fixture</title><p>Hello world</p>');
  }
  let raw='';for await(const chunk of req)raw+=chunk;
  const body=JSON.parse(raw),text=body.messages?.at(-1)?.content||body.prompt||'';
  const record={text,finished:false,aborted:false};requests.push(record);active++;peak=Math.max(peak,active);let counted=true;
  const finished=()=>{if(counted){active--;counted=false;}};
  res.on('finish',()=>{record.finished=true;finished();});res.on('close',()=>{record.aborted=!res.writableEnded;finished();});
  let output=translate(text);if(mode==='no-markers')output=output.replace(/__QF_DOC_\d+__/g,'');
  if(mode==='html')output='<img src="https://untrusted.invalid/x" onerror="globalThis.injected=true">';
  if(mode==='fail'){res.writeHead(401,{'Content-Type':'application/json'});return res.end('{"error":{"message":"synthetic failure"}}');}
  if(body.stream){
    res.writeHead(200,{'Content-Type':'text/event-stream'});
    const event=chunk=>res.write('data: '+JSON.stringify({choices:[{delta:{content:chunk}}]})+'\n\n');
    const first=output.indexOf('__QF_DOC_')>=0?output.indexOf('__',output.indexOf('__QF_DOC_')+2)+5:6;
    event(output.slice(0,first));if(mode==='stall')return;
    await delay(mode==='slow'?800:180);if(res.destroyed)return;event(output.slice(first));res.end('data: [DONE]\n\n');
  }else {await delay(60);res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({data:{translation:output}}));}
});
(async()=>{
  fs.mkdirSync(path.dirname(reportPath),{recursive:true});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
  let version;
  try{
    const format=await import(pathToFileURL(path.join(root,'src/document-format.mjs')).href);
    await check('Text: UTF-8/UTF-16 and safe Unicode splitting',()=>{
      assert.equal(format.decodeText(Buffer.from('中文🙂')),'中文🙂');assert.equal(format.decodeText(Buffer.concat([Buffer.from([255,254]),Buffer.from('中文🙂','utf16le')])),'中文🙂');
      const text='文'.repeat(1499)+'🙂'+'字'.repeat(20),parts=format.splitParagraph(text);assert.equal(parts.join(''),text);assert.ok(parts.every(p=>p.length<=1500));assert.throws(()=>format.decodeText(Buffer.from([0,1,0])));
    });
    await check('Text: reading page and character limits',()=>{assert.ok(format.textPages(Array.from({length:31},()=> 'Hello world')).length===2);assert.throws(()=>format.textPages(['x'.repeat(1000001)]),/100 万/);});
    await check('Batch markers: missing/duplicate rejected; split stream marker hidden',()=>{
      const batch=format.translationBatches([{text:'one'},{text:'two'}])[0];assert.deepEqual(format.markedTranslations('__QF_DOC_0__\n一\n__QF_DOC_1__\n二',batch),['一','二']);assert.equal(format.markedTranslations('__QF_DOC_0__\n一',batch),null);assert.equal(format.markedTranslations('__QF_DOC_0__\n__QF_DOC_0__\n一\n__QF_DOC_1__\n二',batch),null);assert.deepEqual(format.markedTranslations('__QF_DOC_0__\n一\n__QF_DO',batch,true),['一']);
    });
    // First load the UNCHANGED production manifest, with no API credentials or added permissions.
    smoke=await chromium.launchPersistentContext(path.join(scratch,'production-profile'),{channel:'msedge',headless:true,viewport:{width:1440,height:1000},args:['--disable-extensions-except='+root,'--load-extension='+root]});
    const smokeWorker=smoke.serviceWorkers()[0]||await smoke.waitForEvent('serviceworker');const smokeId=new URL(smokeWorker.url()).host;
    await check('Production manifest: real PDF canvas + text layer with no host grants',async()=>{
      const page=await smoke.newPage();page.on('pageerror',e=>browserErrors.push(e.message));await page.goto('chrome-extension://'+smokeId+'/reader.html');
      await page.locator('#file').setInputFiles({name:'production.pdf',mimeType:'application/pdf',buffer:pdf});
      await page.waitForFunction(()=>document.querySelector('.textLayer')?.textContent.includes('Hello world'));
      assert.equal(await page.locator('#pageCount').textContent(),'3');assert.equal(await page.locator('#status').evaluate(e=>e.classList.contains('error')),false);
      const permissions=await smokeWorker.evaluate(()=>chrome.permissions.getAll());assert.ok(!permissions.origins?.length);assert.equal(await page.locator('.pdf-sheet > canvas').count(),1);
    });
    await smoke.close();smoke=undefined;
    const extension=path.join(scratch,'extension');fs.mkdirSync(extension);
    for(const file of ['manifest.json','reader.html','reader.css','reader.js','popup.html','popup.css','popup.js','options.html','options.css','options.js','privacy.html','src','assets','_locales','vendor'])fs.cpSync(path.join(root,file),path.join(extension,file),{recursive:true});
    const manifest=JSON.parse(fs.readFileSync(path.join(extension,'manifest.json'),'utf8'));version=manifest.version;manifest.host_permissions=['http://127.0.0.1/*'];fs.writeFileSync(path.join(extension,'manifest.json'),JSON.stringify(manifest));
    context=await chromium.launchPersistentContext(path.join(scratch,'test-profile'),{channel:'msedge',headless:true,acceptDownloads:true,viewport:{width:1440,height:1000},args:['--disable-extensions-except='+extension,'--load-extension='+extension]});
    const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host,base='chrome-extension://'+id+'/';
    const page=await context.newPage();page.setDefaultTimeout(8000);page.on('pageerror',e=>browserErrors.push(e.message));
    context.on('request',request=>{if(/^https?:/.test(request.url())&&!request.url().startsWith(origin))unexpectedUrls.push(request.url().split('?')[0]);});
    async function configure(extra={}){mode='normal';await worker.evaluate(settings=>chrome.storage.local.set(settings),{apiStyle:'openai-compatible',endpoint:origin+'/v1/chat/completions',apiKey:'SYNTHETIC-DOCUMENT-TEST-KEY',model:'document-'+(++scenario),targetLanguage:'zh-CN',sourceLanguage:'auto',streamOpenAi:true,requestTimeoutSeconds:45,...extra});await delay(40);}
    async function openFile(name,buffer){await page.locator('#file').setInputFiles({name,mimeType:'application/octet-stream',buffer:Buffer.from(buffer)});await page.waitForFunction(()=>document.querySelector('#cancelLoad').hidden);}
    async function ready(){await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('文档已打开'));}
    async function translated(){await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('翻译完成'));}
    await configure();await page.goto(base+'reader.html');
    await check('PDF: render real pages locally; opening does not call API',async()=>{const before=requests.length;await openFile('sample.pdf',pdf);await ready();assert.equal(requests.length,before);assert.match(await page.locator('.textLayer').textContent(),/QudadFlow Document Reader/);assert.equal(await page.locator('#sourceLabel').textContent(),'PDF 原页 · 文字可选');});
    await check('PDF: streamed translation appears before completion',async()=>{mode='slow';await page.locator('#translatePage').click();await page.waitForFunction(()=>document.querySelector('#translationContent .pending')?.textContent.length>0);assert.ok(requests.some(r=>!r.finished));await translated();assert.match(await page.locator('#translationContent').textContent(),/你好，世界/);assert.doesNotMatch(await page.locator('#translationContent').textContent(),/__QF_DOC_/);mode='normal';});
    await check('PDF: two-column extraction reads left column before right',async()=>{await page.locator('#next').click();await page.waitForFunction(()=>document.querySelector('.textLayer')?.textContent.includes('Left column'));await page.locator('#translatePage').click();await translated();const sent=requests.at(-1).text;assert.ok(sent.indexOf('Left column line 6')<sent.indexOf('Right column line 1'),sent);});
    await check('PDF: page without text shows OCR guidance and sends no API request',async()=>{await page.locator('#next').click();await page.waitForFunction(()=>document.querySelector('.empty-page'));const before=requests.length;await page.locator('#translatePage').click();await translated();assert.equal(requests.length,before);assert.match(await page.locator('#translationContent').textContent(),/OCR/);});
    await check('PDF: returning to a page restores its completed translation',async()=>{await page.locator('#pageNumber').fill('1');await page.locator('#pageNumber').press('Enter');await page.waitForFunction(()=>document.querySelector('#translationContent').textContent.includes('你好，世界'));await page.screenshot({path:path.join(path.dirname(reportPath),'qudadflow-document-pdf-v'+version+'.png')});});
    await check('PDF: rotated page retains logical reading order',async()=>{await configure();await openFile('rotated.pdf',makePdf([line('FIRST LINE',48,700)+line('SECOND LINE',48,620)],90));await ready();await page.locator('#translatePage').click();await translated();assert.ok(requests.at(-1).text.indexOf('FIRST LINE')<requests.at(-1).text.indexOf('SECOND LINE'));const canvas=await page.locator('.pdf-sheet > canvas').boundingBox();assert.ok(canvas.width>canvas.height);});
    await check('DOCX: body, headings, Unicode and table text; hidden/deleted/header excluded',async()=>{await openFile('sample.docx',docx);await ready();const source=await page.locator('#sourceContent').textContent();assert.match(source,/Hello world/);assert.match(source,/中文🙂/);assert.match(source,/Table cell text/);assert.doesNotMatch(source,/SECRET/);assert.equal(await page.locator('#sourceContent .heading').count(),1);});
    await check('DOCX: corresponding blocks align at equal heights after translation',async()=>{await page.locator('#translatePage').click();await translated();await delay(50);const differences=await page.evaluate(()=>Array.from(document.querySelectorAll('#sourceContent .document-block'),(node,i)=>Math.abs(node.getBoundingClientRect().top-document.querySelectorAll('#translationContent .document-block')[i].getBoundingClientRect().top)));assert.ok(differences.every(n=>n<2),JSON.stringify(differences));await page.screenshot({path:path.join(path.dirname(reportPath),'qudadflow-document-word-v'+version+'.png')});});
    await check('Word: explicitly visible runs are retained; malformed XML rejected',async()=>{await openFile('visible.docx',zipSync({'word/document.xml':strToU8(xml.replace('<w:vanish/>','<w:vanish w:val="false"/>'))}));await ready();assert.match(await page.locator('#sourceContent').textContent(),/HIDDEN SECRET/);await openFile('malformed.docx',zipSync({'word/document.xml':strToU8('<w:document>broken')}));assert.match(await page.locator('#status').textContent(),/结构/);});
    await check('TXT: UTF-16 local input and bilingual export',async()=>{await openFile('unicode.txt',Buffer.concat([Buffer.from([255,254]),Buffer.from('Hello world 中文🙂\n\nGood morning','utf16le')]));await ready();await page.locator('#translatePage').click();await translated();const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadPromise;const output=fs.readFileSync(await download.path(),'utf8');assert.match(output,/原文\nHello world 中文🙂/);assert.match(output,/你好，世界/);assert.equal(download.suggestedFilename(),'unicode.bilingual.txt');});
    await check('Markdown and provider HTML render as text without executing',async()=>{await configure();await openFile('safe.md',Buffer.from('# Hello world\n\n<img src="https://untrusted.invalid/x" onerror="globalThis.injected=true">'));await ready();mode='html';await page.locator('#translatePage').click();await translated();assert.equal(await page.locator('#workspace img').count(),0);assert.equal(await page.evaluate(()=>globalThis.injected),undefined);assert.match(await page.locator('#sourceContent').textContent(),/<img/);mode='normal';});
    await check('Malformed DOCX and entity declarations produce visible errors',async()=>{await openFile('broken.docx',Buffer.from('PKbroken'));assert.match(await page.locator('#status').textContent(),/invalid|Word|zip/i);const unsafe=zipSync({'word/document.xml':strToU8('<!DOCTYPE x [<!ENTITY a SYSTEM "https://untrusted.invalid/secret">]>'+xml)});await openFile('unsafe.docx',unsafe);assert.match(await page.locator('#status').textContent(),/XML 声明/);});
    await check('Limits: reject oversized archive body, files and >300 PDF pages',async()=>{await openFile('large.docx',zipSync({'word/document.xml':new Uint8Array(8*1024*1024+1)}));assert.match(await page.locator('#status').textContent(),/正文过大/);await openFile('large.txt',Buffer.alloc(25*1024*1024+1));assert.match(await page.locator('#status').textContent(),/25 MB/);await openFile('pages.pdf',makePdf(Array(301).fill('')));assert.match(await page.locator('#status').textContent(),/300/);});
    await check('Whole document: 2 request cap, stop/resume preserves completed blocks',async()=>{
      await configure();peak=0;mode='slow';await openFile('long.txt',Buffer.from(Array.from({length:35},(_,i)=>'Hello world paragraph '+i+' '+('word '.repeat(110))).join('\n\n')));await ready();await page.locator('#translateAll').click();
      await page.waitForFunction(()=>document.querySelectorAll('#translationContent .translated').length>=6);await page.locator('#stop').click();await page.waitForFunction(()=>document.querySelector('#stop').hidden);await delay(100);assert.ok(peak<=2,'peak '+peak);assert.equal(active,0);const before=requests.length;await delay(250);assert.equal(requests.length,before);assert.ok(await page.locator('#translationContent .translated').count()>0);
      mode='normal';await page.locator('#translateAll').click();await translated();const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();const text=fs.readFileSync(await(await downloadPromise).path(),'utf8');assert.doesNotMatch(text,/尚未翻译|尚未提取/);assert.match(text,/paragraph 34/);assert.ok(peak<=2);
    });
    await check('Reading layout: synchronized scroll and resize preserve paragraph pairing',async()=>{
      await page.setViewportSize({width:950,height:700});await delay(200);await page.locator('#sourcePane').evaluate(e=>{e.scrollTop=400;});await delay(100);
      let positions=await page.evaluate(()=>['sourcePane','translationPane'].map(id=>document.getElementById(id).scrollTop));assert.ok(Math.abs(positions[0]-positions[1])<2,JSON.stringify(positions));
      await page.locator('#syncScroll').uncheck();await page.locator('#sourcePane').evaluate(e=>{e.scrollTop=0;});await delay(100);positions=await page.evaluate(()=>['sourcePane','translationPane'].map(id=>document.getElementById(id).scrollTop));assert.ok(positions[1]>100);await page.locator('#syncScroll').check();await page.setViewportSize({width:1440,height:1000});
    });
    await check('Document replacement cancels old stream and ignores stale output',async()=>{await configure();mode='stall';await openFile('old.txt',Buffer.from('OLD DOCUMENT'));await ready();await page.locator('#translatePage').click();await page.waitForFunction(()=>document.querySelector('.pending'));await openFile('new.txt',Buffer.from('NEW DOCUMENT'));await ready();await delay(100);assert.equal(active,0);assert.doesNotMatch(await page.locator('#workspace').textContent(),/OLD DOCUMENT/);assert.match(await page.locator('#translationContent').textContent(),/等待翻译/);});
    await check('Settings changes cancel stream and clear old-language results',async()=>{await configure();mode='stall';await page.locator('#translatePage').click();await page.waitForFunction(()=>document.querySelector('.pending'));await page.locator('#targetLanguage').selectOption('en');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('配置已更改'));await delay(100);assert.equal(active,0);assert.equal(await page.locator('.pending,.translated').count(),0);});
    await check('Marker loss falls back per paragraph without wrong pairing',async()=>{await configure();mode='no-markers';await openFile('markers.txt',Buffer.from('Hello world\n\nGood morning'));await ready();const before=requests.length;await page.locator('#translatePage').click();await translated();assert.equal(requests.length-before,3);const blocks=await page.locator('#translationContent .translated').allTextContents();assert.match(blocks[0],/你好，世界/);assert.match(blocks[1],/早上好/);});
    await check('HTTP error is visible and does not mark unfinished blocks complete',async()=>{await configure();mode='fail';await openFile('failure.txt',Buffer.from('Hello world failure'));await ready();await page.locator('#translatePage').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('翻译未完成'));assert.match(await page.locator('#status').textContent(),/401|API Key/);assert.equal(await page.locator('.translated').count(),0);});
    await check('Custom JSON provider also translates document text',async()=>{await configure({apiStyle:'custom-json',endpoint:origin+'/custom',customHeaders:'{}',requestTemplate:'{"prompt": {{text}}}',responsePath:'data.translation'});await openFile('custom.txt',Buffer.from('Hello world custom'));await ready();await page.locator('#translatePage').click();await translated();assert.match(await page.locator('#translationContent').textContent(),/你好，世界/);});
    async function link(url){if(await page.locator('#linkForm').isHidden())await page.locator('#showLink').click();await page.locator('#documentUrl').fill(url);await page.locator('#linkForm button').click();}
    await check('URL: current document prefill is cleared from reader history',async()=>{await page.goto(base+'reader.html#url='+encodeURIComponent(origin+'/sample.pdf'));await page.waitForFunction(()=>document.querySelector('#documentUrl').value.includes('/sample.pdf'));assert.equal(await page.locator('#documentUrl').inputValue(),origin+'/sample.pdf');assert.equal(new URL(page.url()).hash,'');await page.locator('#linkForm button').click();await ready();assert.equal(await page.locator('#pageCount').textContent(),'3');});
    await check('URL: attachment filename enables TXT without a suffix',async()=>{await link(origin+'/attachment');await ready();assert.match(await page.locator('#sourceContent').textContent(),/Hello world attachment/);});
    await check('URL: oversized response and login HTML are actionable errors',async()=>{await link(origin+'/oversized.pdf');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('25 MB'));await link(origin+'/login');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('网页登录页'));});
    await check('URL: denied permission shows local-file alternative',async()=>{await page.evaluate(()=>{globalThis.originalPermissionRequest=chrome.permissions.request;chrome.permissions.request=async()=>false;});try{await link(origin+'/sample.pdf');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('未获得'));}finally{await page.evaluate(()=>{chrome.permissions.request=globalThis.originalPermissionRequest;delete globalThis.originalPermissionRequest;});}});
    await check('URL load replaced by local file does not overwrite the new document',async()=>{await link(origin+'/slow.pdf');await page.waitForFunction(()=>!document.querySelector('#cancelLoad').hidden);await openFile('latest.txt',Buffer.from('Latest local document'));await ready();await delay(1700);assert.equal(await page.locator('#fileName').textContent(),'latest.txt');assert.match(await page.locator('#sourceContent').textContent(),/Latest local/);});
    await check('Cancel loading keeps reader idle without a stale document',async()=>{await link(origin+'/slow.pdf');await page.waitForFunction(()=>!document.querySelector('#cancelLoad').hidden);await page.locator('#cancelLoad').click();await delay(1700);assert.equal(await page.locator('#translatePage').isDisabled(),true);assert.match(await page.locator('#status').textContent(),/已取消/);});
    await check('Closing one reader cancels only its own pending port requests',async()=>{await configure();mode='stall';await openFile('one.txt',Buffer.from('reader one'));await ready();await page.locator('#translatePage').click();await page.waitForFunction(()=>document.querySelector('.pending'));const other=await context.newPage();await other.goto(base+'reader.html');await other.locator('#file').setInputFiles({name:'two.txt',mimeType:'text/plain',buffer:Buffer.from('reader two')});await other.waitForFunction(()=>!document.querySelector('#translatePage').disabled);await other.locator('#translatePage').click();await other.waitForFunction(()=>document.querySelector('.pending'));await other.close();await delay(150);assert.equal(active,1);await page.locator('#stop').click();await delay(100);assert.equal(active,0);});
    await check('Worker port: third concurrent request rejected, disconnect aborts both',async()=>{await configure();mode='stall';const result=await page.evaluate(()=>new Promise(resolve=>{const connection=chrome.runtime.connect({name:'qudadflow-document'});connection.onMessage.addListener(message=>{if(message.type==='RESULT'&&message.requestId==='third'){resolve(message);connection.disconnect();}});for(const requestId of ['first','second','third'])connection.postMessage({type:'TRANSLATE',requestId,text:'Port test '+requestId});}));assert.equal(result.ok,false);assert.match(result.error,/两个/);await delay(100);assert.equal(active,0);});
    await check('Popup opens reader with active PDF URL; context menu registered',async()=>{
      await worker.evaluate(url=>chrome.tabs.create({url,active:true}),origin+'/sample.pdf');
      const popup=await context.newPage();await popup.goto(base+'popup.html');
      await worker.evaluate(async url=>{const tab=(await chrome.tabs.query({})).find(t=>t.url===url);await chrome.tabs.update(tab.id,{active:true});},origin+'/sample.pdf');
      await popup.reload();await popup.waitForFunction(()=>!document.querySelector('#selection').textContent.includes('正在读取'));const created=context.waitForEvent('page');await popup.locator('#openDocument').click();const reader=await created;await reader.waitForLoadState();assert.equal(await reader.locator('#documentUrl').inputValue(),origin+'/sample.pdf');await reader.close();
      const error=await worker.evaluate(()=>new Promise(resolve=>chrome.contextMenus.update('translate-document',{title:'用 QudadFlow 打开 PDF / 文档对照阅读'},()=>resolve(chrome.runtime.lastError?.message||''))));assert.equal(error,'');
    });
    await check('No parser/page errors or unexpected document network requests',()=>{assert.deepEqual(browserErrors,[]);assert.deepEqual(unexpectedUrls,[]);});
  }catch(error){results.push({name:'suite setup',passed:false,error:error.stack});console.error(error);}
  finally{
    await context?.close();await smoke?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
    fs.rmSync(scratch,{recursive:true,force:true,maxRetries:5,retryDelay:200});
    const report={version,scope:'Generated PDF/DOCX/TXT/Markdown fixtures; isolated Edge; synthetic API only. No user profile or live credentials accessed.',passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results};fs.writeFileSync(reportPath,JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failed:report.failed,reportPath}));if(report.failed)process.exitCode=1;
  }
})();
