/* Isolated Edge, generated documents and mock vision API. No real user settings. */
async function workbenchView(page,stage){await page.locator('#figureWorkflow').evaluate(e=>e.open=true);const tab=page.locator('#figure-tab-'+stage);if(await tab.getAttribute('aria-selected')!=='true')await tab.click();if(stage==='acquire'){const manual=page.locator('.workbench-manual');if(await manual.count())await manual.evaluate(e=>e.open=true);}}
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),reportPath=path.resolve(process.argv[2]||'table-export-results.json');
const version=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'))).version;
const {zipSync,strToU8}=require(path.join(root,'vendor/fflate/umd/index.js'));
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'qudadflow-table-export-')),results=[],calls=[],errors=[];
const png=fs.readFileSync(path.join(root,'assets/icon128.png')),delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const answer='## Table 1. Cohorts\n\n| Group | N | Risk | Note |\n| --- | --- | --- | --- |\n| Control | 0012 | -0.003 | A\\|B |\n| Trial | 24 | +0.20 | line<br>two |\n\nFootnote: * denominators differ.\n\n## Limitations\n\nAI transcription needs verification. <img src=x onerror=alert(1)>';
let context,worker,base,origin,page,reader,mode='normal',formats;
const server=http.createServer(async(req,res)=>{
  if(req.method==='GET'){
    if(req.url.startsWith('/image')){res.setHeader('Content-Type','image/png');return res.end(png);}
    res.setHeader('Content-Type','text/html; charset=utf-8');
    return res.end('<!doctype html><meta charset="utf-8"><title>Table evidence</title><style>body{font:16px Arial}td,th{padding:8px}img{width:220px;height:100px}</style><article><h1>Controlled comparison</h1><p>Evidence with original numeric strings.</p><div class="table-wrap"><table><caption>Table 1. Original data</caption><tr><th rowspan="2">Group</th><th colspan="2">Outcome</th></tr><tr><th>N</th><th>Risk</th></tr><tr><td>A|B</td><td>0012</td><td>-0.003</td></tr></table><p class="table-footnote">* Original footnote.</p></div><table><caption>Table 2. Long table</caption><tr><th>Record</th><th>Value</th></tr>'+Array.from({length:350},(_,i)=>'<tr><td>Row '+i+'</td><td>'+i+'</td></tr>').join('')+'</table><figure><img src="/image1.png"><figcaption>Table 3. Image data</figcaption></figure></article>');
  }
  let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw),record={body,mode,aborted:false};calls.push(record);res.on('close',()=>record.aborted=!res.writableEnded);
  res.writeHead(200,{'Content-Type':'text/event-stream'});
  const value=mode==='no-table'?'No actual table is visible. Please provide a complete, sharper crop.':answer;
  const send=text=>res.write('data: '+JSON.stringify({choices:[{delta:{content:text}}]})+'\n\n');
  send(value.slice(0,32));if(mode==='stall')return;await delay(120);if(res.destroyed)return;send(value.slice(32));res.end('data: [DONE]\n\n');
});
async function check(name,fn){try{await fn();results.push({name,passed:true});console.log('PASS '+name);}catch(error){results.push({name,passed:false,error:error.stack});console.log('FAIL '+name+': '+error.message);}finally{mode='normal';}}
async function mockClipboard(tab,deny=false){await tab.evaluate(deny=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{if(deny)throw new Error('synthetic denial');window.copiedTable=value;}}}),deny);}
async function copied(tab,button){const description=button.toString();if(description.includes('document-tables'))await workbenchView(tab,'gallery');else if(description.includes('figure-output'))await workbenchView(tab,'analysis');await button.click();return tab.evaluate(()=>window.copiedTable);}
async function opened(name,buffer){await reader.locator('#file').setInputFiles({name,mimeType:name.endsWith('.docx')?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':name.endsWith('.pdf')?'application/pdf':'text/plain',buffer:Buffer.from(buffer)});await reader.waitForFunction(()=>document.getElementById('status').textContent.includes('文档已打开'));await reader.locator('#figureWorkflow').evaluate(node=>node.open=true);}
async function transcribed(tab,selector){await workbenchView(tab,selector.toString().includes('transcribeSelectedTables')?'gallery':'analysis');await selector.click();await tab.waitForFunction(()=>document.getElementById('figureStatus').textContent.startsWith('已转写'));}
function pdf(){
  const stream='BT /F1 20 Tf 40 740 Td (Table 1. PDF evidence) Tj ET\nq 0.2 0.3 0.5 rg 40 420 380 180 re f Q';
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Count 1 /Kids [4 0 R] >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let data='%PDF-1.4\n',offsets=[0];for(const [i,obj]of objects.entries()){offsets.push(Buffer.byteLength(data));data+=`${i+1} 0 obj\n${obj}\nendobj\n`;}const xref=Buffer.byteLength(data);data+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;return Buffer.from(data);
}
(async()=>{
  fs.mkdirSync(path.dirname(reportPath),{recursive:true});formats=await import(pathToFileURL(path.join(root,'src/table-export.mjs')));
  await check('Markdown roundtrip preserves escaped pipes, backslashes, blank cells and Unicode',async()=>{
    const grid=[['名称','Path','Empty'],['A|B','C:\\data\\',''],['tail|','\\|','0012']];assert.deepEqual(formats.markdownTables(formats.gridMarkdown(grid))[0].grid,grid);
    assert.deepEqual(formats.markdownCells('a | b\\|'),['a','b|']);assert.deepEqual(formats.markdownCells('| a | end\\\\ |'),['a','end\\']);
  });
  await check('Markdown table extraction keeps captions/footnotes and ignores code samples in both fence styles',async()=>{
    const value='````md\n'+answer+'\n```\n'+answer+'\n````\n~~~md\n'+answer+'\n~~~\n'+answer;const tables=formats.markdownTables(value);assert.equal(tables.length,1);assert.equal(tables[0].caption,'Table 1. Cohorts');assert.equal(tables[0].notes,'Footnote: * denominators differ.');
  });
  await check('TSV retains numeric strings, quotes multiline cells, pads missing fields and literalizes formulas',async()=>{
    assert.equal(formats.tableTsv([['ID','Value','Note'],['0012','-1.2e-3','a\tb\n"c"'],['+0.20','-1+2','=SUM(A1)'],['last']]),'ID\tValue\tNote\r\n0012\t-1.2e-3\t"a\tb\n""c"""\r\n+0.20\t\'-1+2\t\'=SUM(A1)\r\nlast\t\t');
  });
  await check('Plain prose or a chart description does not become a copyable table',async()=>assert.equal(formats.markdownTables('A chart increased from baseline; exact values unavailable.').length,0));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
  try{
    const extension=path.join(scratch,'extension');fs.mkdirSync(extension);for(const name of ['manifest.json','offscreen-translation.html','popup.html','popup.css','popup.js','reader.html','reader.css','reader.js','research.html','research.css','research.js','options.html','options.css','options.js','privacy.html','src','vendor','assets','_locales'])fs.cpSync(path.join(root,name),path.join(extension,name),{recursive:true});
    const manifest=JSON.parse(fs.readFileSync(path.join(extension,'manifest.json')));manifest.host_permissions=['<all_urls>'];fs.writeFileSync(path.join(extension,'manifest.json'),JSON.stringify(manifest));
    context=await chromium.launchPersistentContext(path.join(scratch,'profile'),{channel:'msedge',headless:true,viewport:{width:1440,height:1100},args:['--disable-extensions-except='+extension,'--load-extension='+extension]});context.on('page',tab=>tab.on('pageerror',error=>errors.push(error.message)));
    worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');base='chrome-extension://'+new URL(worker.url()).host+'/';
    await worker.evaluate(endpoint=>chrome.storage.local.set({apiStyle:'openai-compatible',endpoint,apiKey:'SYNTHETIC-TABLE-KEY',model:'fixture-vision',targetLanguage:'zh-CN',streamOpenAi:true}),origin+'/v1/chat/completions');
    const site=await context.newPage();await site.goto(origin+'/paper');await site.evaluate(()=>{const row=document.querySelectorAll('table')[1].insertRow();for(const text of ['**literal**','`code` <br> [x](https://example.com)'])row.insertCell().textContent=text;});await site.bringToFront();const id=await worker.evaluate(async url=>(await chrome.tabs.query({})).find(tab=>tab.url===url).id,site.url());const created=context.waitForEvent('page');await worker.evaluate(id=>captureResearch(id),id);page=await created;await page.waitForFunction(()=>document.querySelectorAll('#paperTables .paper-table-card').length===2);await mockClipboard(page);
    await check('Web native tables expose Markdown and TSV immediately, with repeated merged headers, caption and footnote and no AI',async()=>{
      const card=page.locator('#paperTables .paper-table-card').first();const md=await copied(page,card.getByRole('button',{name:'复制 Markdown',exact:true}));assert.match(md,/Table 1\. Original data/);assert.match(md,/\| Group \| N \| Risk \|/);assert.match(md,/\| A\\\|B \| 0012 \| -0\.003 \|/);assert.match(md,/Original footnote/);assert.doesNotMatch(md,/AI 转写/);
      assert.equal(await copied(page,card.getByRole('button',{name:'复制 TSV（Excel）',exact:true})),'Group\tOutcome\tOutcome\r\nGroup\tN\tRisk\r\nA|B\t0012\t-0.003');assert.equal(calls.length,0);
    });
    await check('A 350-row native table is fully copyable without the former 300-row truncation',async()=>{
      const card=page.locator('#paperTables .paper-table-card').nth(1);await card.evaluate(node=>node.open=true);const md=await copied(page,card.getByRole('button',{name:'复制 Markdown',exact:true}));assert.match(md,/Row 349 \| 349/);assert.doesNotMatch(md,/truncated|已截断/i);
    });
    await check('Native table display and TSV preserve literal Markdown punctuation, link syntax and HTML-like text',async()=>{
      const card=page.locator('#paperTables .paper-table-card').nth(1),last=card.locator('tr').last();assert.equal(await last.locator('td').first().textContent(),'**literal**');assert.equal(await last.locator('td').nth(1).textContent(),'`code` <br> [x](https://example.com)');assert.equal(await last.locator('strong,code,a,br').count(),0);assert.ok((await copied(page,card.getByRole('button',{name:'复制 TSV（Excel）',exact:true}))).endsWith('**literal**\t`code` <br> [x](https://example.com)'));
    });
    await check('Markdown/TSV downloads contain the same table and TSV has a UTF-8 BOM',async()=>{
      const tools=page.locator('#paperTables .table-copy-tools').first();for(const ext of ['md','tsv']){const pending=page.waitForEvent('download');await tools.getByRole('button',{name:'下载 .'+ext,exact:true}).click();const downloaded=await pending,bytes=fs.readFileSync(await downloaded.path());assert.equal(downloaded.suggestedFilename(),'QudadFlow-table.'+ext);if(ext==='tsv'){assert.deepEqual([...bytes.subarray(0,3)],[239,187,191]);assert.match(bytes.toString('utf8'),/0012/);}else assert.match(bytes.toString('utf8'),/Original footnote/);}
    });
    await check('Clipboard denial exposes selected read-only manual copy text instead of claiming success',async()=>{
      await mockClipboard(page,true);const tools=page.locator('#paperTables .table-copy-tools').first();await tools.getByRole('button',{name:'复制 TSV（Excel）',exact:true}).click();assert.match(await tools.locator('.table-copy-status').textContent(),/未能访问剪贴板/);assert.match(await tools.locator('textarea').inputValue(),/0012/);assert.equal(await tools.locator('textarea').evaluate(node=>node.readOnly&&node.selectionEnd===node.value.length),true);await mockClipboard(page);
    });
    await check('Native table expansion preserves rowSpan=0, line breaks and numeric text, and removes generated/hidden text',async()=>{
      const result=await page.evaluate(async()=>{const {elementTable}=await import('./src/table-export.mjs'),table=document.createElement('table');table.innerHTML='<tbody><tr><th rowspan="0">Cohort</th><td>0012<br>42.5<span hidden>PRIVATE</span><span data-edge-wt-immersive-translation>TRANSLATION</span></td></tr><tr><td>-0.02</td></tr></tbody>';return elementTable(table);});assert.deepEqual(result.grid,[['Cohort','0012\n42.5'],['Cohort','-0.02']]);assert.equal(result.truncated,false);
    });
    await check('Image tables load locally and batch transcription is explicit, carries original pixels and faithful-data instructions',async()=>{
      await page.locator('#selectImageTables').click();await workbenchView(page,'gallery');if(await page.locator('#loadSelectedFigures').isEnabled())await page.locator('#loadSelectedFigures').click();await page.waitForFunction(()=>document.querySelectorAll('.figure-card').length===1&&!document.querySelector('#figureSearch').disabled);assert.equal(calls.length,0);await transcribed(page,page.locator('#transcribeSelectedTables'));assert.equal(calls.length,1);const body=calls[0].body;assert.match(body.messages[0].content,/EVERY visible table/);assert.match(body.messages[0].content,/leading zeros/);assert.match(body.messages[0].content,/do not fabricate/i);assert.ok(body.messages.at(-1).content.some(part=>part.type==='image_url'));
    });
    await check('AI table results provide copy/download tools, preserve escaped pipes, and mark the transcription as unverified',async()=>{
      const output=page.locator('.figure-output').first();assert.equal(await output.locator('table').count(),1);assert.equal(await output.locator('img').count(),0);assert.equal(await output.locator('td br').count(),1);const md=await copied(page,output.getByRole('button',{name:'复制 Markdown',exact:true}));assert.match(md,/AI 转写，未经核验/);assert.match(md,/Footnote/);assert.equal(await copied(page,output.getByRole('button',{name:'复制 TSV（Excel）',exact:true})),'Group\tN\tRisk\tNote\r\nControl\t0012\t-0.003\tA|B\r\nTrial\t24\t+0.20\t"line\ntwo"');
    });
    await check('Per-image transcription gives an honest no-table outcome without fabricating a table or keeping stale data',async()=>{
      mode='no-table';await workbenchView(page,'analysis');await page.locator('.figure-card').first().getByRole('button',{name:'提取可复制表格',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#figureStatus').textContent.includes('未返回可复制表格'));assert.equal(await page.locator('.figure-output table,.figure-output .table-copy-tools').count(),0);assert.match(await page.locator('.figure-output').first().textContent(),/No actual table/);
    });
    await check('A later successful transcription replaces the empty result and can be copied again',async()=>{await transcribed(page,page.locator('.figure-card').first().getByRole('button',{name:'提取可复制表格',exact:true}));assert.equal(await page.locator('.figure-output .table-copy-tools').count(),1);});
    await check('Copy controls, table scrolling and results fit 390, 620 and 1440 pixel windows',async()=>{
      for(const width of [390,620,1440]){await page.setViewportSize({width,height:1100});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow at '+width);await page.locator('#paperTables .paper-table-card').first().screenshot({path:path.join(path.dirname(reportPath),`qudadflow-copy-table-${width}-v${version}.png`)});}
    });
    reader=await context.newPage();await reader.goto(base+'reader.html');await mockClipboard(reader);
    await check('Markdown reader extracts whole-document tables across paragraph/page splitting without AI',async()=>{
      const count=calls.length;await opened('study.md',Buffer.from('Preface.\n\n'+answer+'\n\n'+('Long paragraph. '.repeat(2000))));await reader.locator('.document-tables').evaluate(node=>node.open=true);assert.equal(await reader.locator('.document-tables .table-copy-tools').count(),1);const tsv=await copied(reader,reader.locator('.document-tables').getByRole('button',{name:'复制 TSV（Excel）',exact:true}));assert.match(tsv,/0012\t-0.003\tA\|B/);assert.ok(tsv.endsWith('24\t+0.20\t"line\ntwo"'));assert.equal(calls.length,count);
    });
    await check('TXT supports text tables and replacing a document clears the prior table inventory',async()=>{
      await opened('study.txt',Buffer.from(answer));assert.equal(await reader.locator('.document-tables .table-copy-tools').count(),1);await opened('no-tables.txt',Buffer.from('A new document with no tabular data.'));assert.equal(await reader.locator('.document-tables').isHidden(),true);assert.equal(await reader.locator('.document-tables .table-copy-tools').count(),0);
    });
    await check('Word table cells are locally copyable through the shared document workflow',async()=>{
      const tc=text=>'<w:tc><w:p><w:r><w:t>'+text+'</w:t></w:r></w:p></w:tc>',row=values=>'<w:tr>'+values.map(tc).join('')+'</w:tr>';
      const xml='<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Word study</w:t></w:r></w:p><w:tbl><w:tblPr/><w:tblGrid><w:gridCol w:w="2400"/><w:gridCol w:w="2400"/></w:tblGrid>'+row(['Group','N'])+row(['Control','0012'])+'</w:tbl></w:body></w:document>';
      await opened('study.docx',zipSync({'word/document.xml':strToU8(xml)}));await reader.locator('.document-tables').evaluate(node=>node.open=true);assert.equal(await reader.locator('.document-tables .table-copy-tools').count(),1);assert.equal(await copied(reader,reader.locator('.document-tables').getByRole('button',{name:'复制 TSV（Excel）',exact:true})),'Group\tN\r\nControl\t0012');
    });
    await check('PDF whole-page capture uses the same explicit AI-to-copyable-table workflow',async()=>{
      await opened('study.pdf',pdf());assert.equal(await reader.locator('.document-tables').isHidden(),true);await workbenchView(reader,'acquire');await reader.locator('#capturePage').click();assert.equal(await reader.locator('.figure-card').count(),1);await transcribed(reader,reader.locator('.figure-card').first().getByRole('button',{name:'提取可复制表格',exact:true}));assert.equal(await reader.locator('.figure-output .table-copy-tools').count(),1);assert.match(calls.at(-1).body.messages.at(-1).content.find(part=>part.type==='text').text,/"page":"1"/);
    });
    await check('Stopping table transcription aborts HTTP, retains no stale prior table and permits retry',async()=>{
      mode='stall';await workbenchView(reader,'analysis');await reader.locator('.figure-card').first().getByRole('button',{name:'提取可复制表格',exact:true}).click();await reader.waitForFunction(()=>document.querySelector('.figure-output')?.textContent.includes('Table 1'));await reader.locator('#stopFigures').click();await delay(150);assert.equal(calls.at(-1).aborted,true);assert.equal(await reader.locator('.figure-output table').count(),0);mode='normal';await transcribed(reader,reader.locator('.figure-card').first().getByRole('button',{name:'提取可复制表格',exact:true}));
    });
    await check('Code blocks remain inert and do not expose false table-copy controls',async()=>{
      const count=await page.evaluate(async answer=>{const {renderResearch}=await import('./src/research-render.mjs'),holder=document.createElement('div');renderResearch(holder,'~~~md\n'+answer+'\n~~~');return {tables:holder.querySelectorAll('table').length,tools:holder.querySelectorAll('.table-copy-tools').length,pre:holder.querySelectorAll('pre').length};},answer);assert.deepEqual(count,{tables:0,tools:0,pre:1});
    });
    await check('No uncaught browser errors',async()=>assert.deepEqual(errors,[]));
  }catch(error){results.push({name:'setup',passed:false,error:error.stack});console.error(error);}
  finally{
    await context?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
    assert.ok(path.resolve(scratch).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(scratch).startsWith('qudadflow-table-export-'));fs.rmSync(scratch,{recursive:true,force:true,maxRetries:5,retryDelay:200});
    const report={version,scope:'Isolated Edge, local documents, synthetic credentials and mock vision; no real model accuracy claim.',passed:results.filter(item=>item.passed).length,failed:results.filter(item=>!item.passed).length,results};fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,failed:report.failed}));if(report.failed)process.exitCode=1;
  }
})();
