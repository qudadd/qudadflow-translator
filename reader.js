import {MAX_FILE_BYTES, MAX_TEXT_CHARS, MAX_PAGES, textPages, decodeText, parseDocxXml, pdfBlocks, translationBatches, markedTranslations} from './src/document-format.mjs';

const $ = id => document.getElementById(id);
let documentState, pdfLibrary, loadingTask, downloadController, renderTask, textLayer;
let loadGeneration = 0, renderGeneration = 0, jobGeneration = 0, jobRunning = false, port, sequence = 0;
let currentPage = 1, views = new Map(), syncing = false, resizeTimer, alignmentFrame;
const pending = new Map();
const status = (text, error = false) => { $('status').textContent = text; $('status').classList.toggle('error', error); };
function controls() {
  const ready = Boolean(documentState);
  for (const id of ['translatePage', 'translateAll']) $(id).disabled = !ready || jobRunning;
  $('stop').hidden = !jobRunning;
  $('previous').disabled = !ready || currentPage <= 1;
  $('next').disabled = !ready || currentPage >= documentState.pageCount;
  $('pageNumber').disabled = !ready;
  $('export').disabled = !ready || !Array.from(documentState.cache.values()).some(page => page.blocks?.some(block => block.translation));
}
function connect() {
  if (port) return port;
  const connection = chrome.runtime.connect({name:'qudadflow-document'}); port = connection;
  connection.onMessage.addListener(message => {
    const request = pending.get(message.requestId);
    if (!request) return;
    if (message.type === 'PROGRESS') request.onProgress?.(message.translation);
    if (message.type === 'RESULT') { pending.delete(message.requestId); request.resolve(message); }
  });
  connection.onDisconnect.addListener(() => {
    void chrome.runtime.lastError;
    if (port === connection) port = undefined;
    for (const [id, request] of pending) if (request.connection === connection) {
      pending.delete(id);request.resolve({ok:false,error:'扩展连接已断开，请重新点击翻译。'});
    }
  });
  return connection;
}
function request(text, context, onProgress) {
  const requestId = `doc-${++sequence}`;
  const connection = connect(); let resolve;
  const promise = new Promise(done => {resolve = done;});
  pending.set(requestId, {resolve, promise, onProgress, connection});
  try {connection.postMessage({type:'TRANSLATE', requestId, text, context, targetLanguage:$('targetLanguage').value});}
  catch {pending.delete(requestId); resolve({ok:false,error:'扩展已重新加载，请刷新阅读器。'});}
  return promise.then(result => {if (!result.ok) throw new Error(result.error || '翻译失败。');return result.translation;});
}
const heartbeat = setInterval(() => {if (pending.size) try {port?.postMessage({type:'PING'});} catch {}}, 20000);
function cancelRequests() {
  for (const [requestId, request] of pending) {
    try {request.connection.postMessage({type:'CANCEL', requestId});} catch {}
    request.resolve({ok:false,error:'翻译已取消。'});
  }
  pending.clear();const oldPort=port;port=undefined;oldPort?.disconnect();
}
function stopTranslation(showNotice = false) {
  jobGeneration += 1; cancelRequests();
  jobRunning = false;
  for (const page of documentState?.cache.values() || []) for (const block of page.blocks || []) delete block.partial;
  updateTranslations(); controls();
  if (showNotice) status('已停止。已完成的译文保留，再次翻译会继续处理未完成段落。');
}
function updateTranslations() {
  for (const [block, node] of views) {
    node.textContent = block.translation || block.partial || '等待翻译';
    node.className = block.translation ? 'translated' : block.partial ? 'pending' : 'placeholder';
  }
  controls();
  scheduleAlignment();
}
function scheduleAlignment() {
  cancelAnimationFrame(alignmentFrame);
  alignmentFrame=requestAnimationFrame(()=>{
    if(!documentState || documentState.kind==='PDF')return;
    const source=$('sourceContent').querySelectorAll('.document-block'), translated=$('translationContent').querySelectorAll('.document-block');
    for(const node of [...source,...translated])node.style.minHeight='';
    source.forEach((node,index)=>{if(translated[index]){const height=Math.max(node.offsetHeight,translated[index].offsetHeight);node.style.minHeight=translated[index].style.minHeight=`${height}px`;}});
  });
}
function blockView(block, index, translated = false) {
  const element = document.createElement('div');element.className = `document-block ${block.kind || ''}`;
  const number = document.createElement('span');number.className = 'block-number';number.textContent = String(index + 1).padStart(2,'0');
  const text = document.createElement('div');text.textContent = translated ? block.translation || block.partial || '等待翻译' : block.text;
  element.append(number,text); if (translated) views.set(block,text);
  return element;
}
async function pageData(number, state = documentState) {
  if (state.cache.has(number)) return state.cache.get(number);
  if (state.inflight.has(number)) return state.inflight.get(number);
  const promise = (async () => {
    const pdfPage = await state.pdf.getPage(number);
    const content = await pdfPage.getTextContent();
    if (content.items.length > 30000) throw new Error(`第 ${number} 页内容过于复杂，请拆分文档后重试。`);
    const library = await pdfLibrary;
    // Use logical page coordinates for reading order even when the displayed page is rotated.
    const blocks = pdfBlocks(content, pdfPage.getViewport({scale:1,rotation:0}), library.Util.transform);
    const chars = blocks.reduce((sum, block) => sum + block.text.length, 0);
    if (state.totalChars + chars > MAX_TEXT_CHARS) throw new Error('提取的文字超过 100 万字符，请拆分文档后翻译。');
    state.totalChars += chars;
    const page = {blocks};state.cache.set(number,page);
    return page;
  })();
  state.inflight.set(number,promise);
  try {return await promise;} finally {state.inflight.delete(number);}
}
async function showPage(number, preserveScroll = false) {
  const state = documentState;if (!state) return;
  number = Math.max(1,Math.min(state.pageCount,Math.trunc(Number(number)||1)));currentPage = number;
  const generation = ++renderGeneration;
  renderTask?.cancel();textLayer?.cancel();
  const scroll = ['sourcePane','translationPane'].map(id => $(id).scrollTop / Math.max(1,$(id).scrollHeight - $(id).clientHeight));
  $('pageNumber').value = number;$('pageCount').textContent = state.pageCount;controls();
  try {
    const page = await pageData(number,state);
    if (generation !== renderGeneration || state !== documentState) return false;
    if(!jobRunning)status(`第 ${number}/${state.pageCount} 页 · ${page.blocks.filter(block=>block.translation).length}/${page.blocks.length} 段已翻译${page.blocks.length?'':'；此页无可提取文字'}。`);
    views = new Map();$('sourceContent').replaceChildren();$('translationContent').replaceChildren();
    const translations = document.createElement('div');translations.className = 'translated-text';
    if (!page.blocks.length) {translations.className='empty-page';translations.textContent='此页没有可提取的文字，可能是扫描图片或空白页。扫描 PDF 请先 OCR，再打开识别后的 PDF。';}
    page.blocks.forEach((block,index) => translations.append(blockView(block,index,true)));
    $('translationContent').append(translations);updateTranslations();
    if (state.kind === 'PDF') {
      const library = await pdfLibrary, pdfPage = await state.pdf.getPage(number);
      if (generation !== renderGeneration) return false;
      const width = Math.max(160,$('sourcePane').clientWidth - 28);
      const base = pdfPage.getViewport({scale:1}), scale = width / base.width;
      const viewport = pdfPage.getViewport({scale});
      const ratio = Math.min(devicePixelRatio || 1,2,Math.sqrt(12000000/(viewport.width*viewport.height)));
      if (viewport.height > 30000 || !Number.isFinite(viewport.height)) throw new Error('此 PDF 页尺寸异常，无法显示。');
      const sheet = document.createElement('div');sheet.className='pdf-sheet';sheet.style.width=`${viewport.width}px`;sheet.style.height=`${viewport.height}px`;sheet.style.setProperty('--scale-factor',scale);
      const canvas = document.createElement('canvas');canvas.width=Math.ceil(viewport.width*ratio);canvas.height=Math.ceil(viewport.height*ratio);canvas.style.width=`${viewport.width}px`;canvas.style.height=`${viewport.height}px`;canvas.setAttribute('aria-label',`PDF 原文第 ${number} 页`);
      const layer = document.createElement('div');layer.className='textLayer';sheet.append(canvas,layer);$('sourceContent').append(sheet);
      renderTask = pdfPage.render({canvasContext:canvas.getContext('2d'),viewport,transform:ratio===1?null:[ratio,0,0,ratio,0,0]});
      await renderTask.promise;
      if (generation !== renderGeneration) return false;
      const content=await pdfPage.getTextContent();
      if (generation !== renderGeneration) return false;
      textLayer = new library.TextLayer({textContentSource:content,container:layer,viewport});await textLayer.render();
    } else {
      const source = document.createElement('div');source.className='source-text';page.blocks.forEach((block,index)=>source.append(blockView(block,index)));$('sourceContent').append(source);
    }
    if (generation !== renderGeneration) return false;
    ['sourcePane','translationPane'].forEach((id,index)=>{$(id).scrollTop=preserveScroll?scroll[index]*Math.max(0,$(id).scrollHeight-$(id).clientHeight):0;});
    scheduleAlignment();return true;
  } catch (error) {if (generation === renderGeneration && error.name !== 'RenderingCancelledException') status(error.message,true);return false;}
}
async function translateBatch(batch, job) {
  const marked = batch.length > 1;
  const context = marked ? 'document translation; preserve every __QF_DOC_N__ marker exactly; return only the marked translations' : 'document translation; return only the translation';
  const input = marked ? batch.map(item=>`${item.marker}\n${item.block.text}`).join('\n\n') : batch[0].block.text;
  const partial = value => {
    if (job.id !== jobGeneration) return;
    const values = marked ? markedTranslations(value,batch,true) : [value];
    values.forEach((text,index)=>{batch[index].block.partial=text;});updateTranslations();
  };
  const output = await request(input,context,partial);
  if (job.id !== jobGeneration) return;
  const values = marked ? markedTranslations(output,batch) : [output];
  if (!values) {
    batch.forEach(item=>delete item.block.partial);updateTranslations();job.fallback += batch.length;
    if (job.fallback > 8) throw new Error('模型多次未保留段落标记，已停止额外重试。请更换模型后再翻译。');
    for (const item of batch) {if(job.id!==jobGeneration)return;await translateBatch([item],job);}
    return;
  }
  values.forEach((text,index)=>{batch[index].block.translation=text;delete batch[index].block.partial;});updateTranslations();
}
async function translate(all = false) {
  if (!documentState || jobRunning) return;
  const state = documentState, job = {id:++jobGeneration,fallback:0};jobRunning=true;controls();
  const pages = all ? Array.from({length:state.pageCount},(_,i)=>i+1) : [currentPage];
  let completed=0, skipped=0, failure;
  try {
    for (const number of pages) {
      if (job.id !== jobGeneration) return;
      const page = await pageData(number,state);
      if (job.id !== jobGeneration || state !== documentState) return;
      if (!page.blocks.length) {skipped+=1;continue;}
      const batches = translationBatches(page.blocks);let next=0;
      status(`正在翻译第 ${number}/${state.pageCount} 页 · 已完成 ${completed} 页。可翻页阅读或随时停止。`);
      await Promise.all(Array.from({length:Math.min(2,batches.length)},async()=>{
        while (!failure && job.id === jobGeneration) {
          const batch=batches[next++];if(!batch)return;
          try {await translateBatch(batch,job);} catch(error){failure ||= error;cancelRequests();}
        }
      }));
      if(failure)throw failure;completed+=1;
    }
    if(job.id===jobGeneration)status(`翻译完成 · ${completed} 页${skipped?`；${skipped} 页无可提取文字，未翻译`:''}。`);
  } catch(error) {
    if(job.id===jobGeneration){for(const page of state.cache.values())for(const block of page.blocks)delete block.partial;updateTranslations();status(`翻译未完成：${error.message} 已完成的段落已保留。`,true);}
  } finally {if(job.id===jobGeneration){jobRunning=false;controls();}}
}
function unzipWord(bytes, signal) {
  return new Promise((resolve,reject)=>{
    const worker=new Worker(chrome.runtime.getURL('src/docx-worker.js'));
    let timer;
    const done=(error,value)=>{clearTimeout(timer);worker.terminate();signal.removeEventListener('abort',abort);error?reject(error):resolve(value);};
    const abort=()=>done(new Error('文档加载已取消。'));
    timer=setTimeout(()=>done(new Error('Word 解析超时，请检查或拆分文件。')),8000);
    worker.onmessage=({data})=>done(data.ok?null:new Error(data.error),data.xml);
    worker.onerror=()=>done(new Error('无法解析 Word 文件。'));
    signal.addEventListener('abort',abort,{once:true});if(signal.aborted)return abort();
    worker.postMessage(bytes.buffer,[bytes.buffer]);
  });
}
function startLoad() {
  const generation=++loadGeneration;downloadController?.abort();const controller=new AbortController();downloadController=controller;
  stopTranslation();renderGeneration+=1;renderTask?.cancel();textLayer?.cancel();clearTimeout(resizeTimer);
  const old=documentState, oldTask=loadingTask;documentState=undefined;loadingTask=undefined;views.clear();controls();$('cancelLoad').hidden=false;
  $('workspace').hidden=true;$('welcome').hidden=false;$('sourceContent').replaceChildren();$('translationContent').replaceChildren();
  $('fileName').textContent='正在打开文档…';$('fileDetail').textContent='PDF · Word DOCX · TXT · Markdown';$('pageCount').textContent='—';
  if(oldTask)oldTask.destroy().catch(()=>{});else old?.task?.destroy().catch(()=>{});
  return {generation,controller,signal:controller.signal};
}
async function openBytes(bytes,name,load) {
  if(load.generation!==loadGeneration||load.signal.aborted)return;
  if(bytes.byteLength>MAX_FILE_BYTES)throw new Error('文件超过 25 MB，请压缩或拆分后打开。');
  let state;
  const prefix=new TextDecoder('latin1').decode(bytes.subarray(0,1024));
  if(prefix.includes('%PDF-')) {
    status('正在本地解析 PDF…');
    pdfLibrary ||= import('./vendor/pdfjs/legacy/build/pdf.mjs');
    const library=await pdfLibrary;library.GlobalWorkerOptions.workerSrc=chrome.runtime.getURL('vendor/pdfjs/legacy/build/pdf.worker.mjs');
    if(load.generation!==loadGeneration)return;
    const task=library.getDocument({data:bytes,isEvalSupported:false,cMapUrl:chrome.runtime.getURL('vendor/pdfjs/cmaps/'),cMapPacked:true,standardFontDataUrl:chrome.runtime.getURL('vendor/pdfjs/standard_fonts/'),wasmUrl:chrome.runtime.getURL('vendor/pdfjs/wasm/'),enableXfa:false});loadingTask=task;
    task.onPassword=update=>{const password=prompt('此 PDF 需要密码。密码仅用于浏览器本地解密：');if(password===null)task.destroy();else update(password);};
    const timer=setTimeout(()=>{load.controller.abort();task.destroy().catch(()=>{});},20000);
    let pdf;
    try {pdf=await task.promise;} finally {clearTimeout(timer);}
    if(load.generation!==loadGeneration){await task.destroy();return;}
    if(pdf.numPages>MAX_PAGES){await task.destroy();if(loadingTask===task)loadingTask=undefined;throw new Error(`PDF 超过 ${MAX_PAGES} 页，请拆分后打开。`);}
    state={kind:'PDF',name,pdf,task,pageCount:pdf.numPages,cache:new Map(),inflight:new Map(),totalChars:0};
  } else {
    let pages,kind;
    if(bytes[0]===80&&bytes[1]===75) {kind='Word';pages=parseDocxXml(await unzipWord(bytes,load.signal));}
    else {
      if(!/\.(txt|md|markdown)$/i.test(name))throw new Error('此链接或文件不是 PDF、DOCX、TXT 或 Markdown。网页登录页不能作为文档打开，请下载文件后选择它。');
      kind=/\.(md|markdown)$/i.test(name)?'Markdown':'TXT';const text=decodeText(bytes);
      if(text.length>MAX_TEXT_CHARS)throw new Error('文本超过 100 万字符，请拆分文件。');
      pages=textPages(text.split(/\n\s*\n/));
    }
    state={kind,name,pageCount:pages.length,cache:new Map(pages.map((page,index)=>[index+1,page])),inflight:new Map()};
  }
  if(load.generation!==loadGeneration)return;
  documentState=state;currentPage=1;$('welcome').hidden=true;$('workspace').hidden=false;
  $('fileName').textContent=name;$('fileDetail').textContent=`${state.kind} · ${state.pageCount} ${state.kind==='PDF'?'页':'个阅读分段'} · 本地解析`;
  $('sourceLabel').textContent=state.kind==='PDF'?'PDF 原页 · 文字可选':'正文阅读排版 · 非原文件分页';
  $('translationLabel').textContent=state.kind==='PDF'?'按页对应 · 段落顺序':'逐段对应 · 流式显示';
  $('pageNumber').max=state.pageCount;const shown=await showPage(1);controls();
  if(shown&&load.generation===loadGeneration)status('文档已打开。点击“翻译当前页”或“翻译全文”开始左右对照。');
}
async function openFile(file) {
  if(!file)return;
  const load=startLoad();status('正在打开文档…');
  try {
    if(!/\.(pdf|docx|txt|md|markdown)$/i.test(file.name))throw new Error('支持 PDF、DOCX、TXT 和 Markdown；旧版 DOC 请另存为 DOCX。');
    if(file.size>MAX_FILE_BYTES)throw new Error('文件超过 25 MB，请压缩或拆分后打开。');
    await openBytes(new Uint8Array(await file.arrayBuffer()),file.name,load);
  } catch(error){if(load.generation===loadGeneration)status(load.signal.aborted?'文档解析已取消或超时。':error.message,true);}
  finally {if(load.generation===loadGeneration)$('cancelLoad').hidden=true;$('file').value='';}
}
async function openUrl(event) {
  event?.preventDefault();let url,permission;
  try {
    url=new URL($('documentUrl').value.trim());
    if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new Error('请输入 HTTP(S) 文档链接。本地文件、blob 链接或登录后下载的文档可用“打开文件”。');
    // Request permission directly in the submit gesture before any unrelated await.
    permission=chrome.permissions.request({origins:[`${url.protocol}//${url.hostname}/*`]});
  } catch(error){status(error.message,true);return;}
  try {if(!await permission){status('未获得文档站点权限。也可以下载文件后使用“打开文件”。',true);return;}}
  catch {status('无法授予文档站点权限，请下载文件后使用“打开文件”。',true);return;}
  const load=startLoad();status('正在下载文档到浏览器…');
  const timeout=setTimeout(()=>load.controller.abort(),30000);
  try {
    const response=await fetch(url.href,{signal:load.signal,credentials:'include',cache:'no-store'});
    if(!response.ok)throw new Error(`文档下载失败（HTTP ${response.status}），可先在浏览器下载，再打开本地文件。`);
    if(Number(response.headers.get('content-length'))>MAX_FILE_BYTES)throw new Error('文件超过 25 MB。');
    const reader=response.body.getReader(),chunks=[];let size=0;
    try {for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>MAX_FILE_BYTES)throw new Error('文件超过 25 MB。');chunks.push(value);}}
    finally {await reader.cancel().catch(()=>{});}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    let name=url.pathname.split('/').pop()||'Document';try{name=decodeURIComponent(name);}catch{}
    const disposition=response.headers.get('content-disposition')||'';
    const filename=disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]||disposition.match(/filename="([^"]+)"/i)?.[1];
    if(filename)try{name=decodeURIComponent(filename).split(/[\\/]/).pop();}catch{}
    clearTimeout(timeout);await openBytes(bytes,name,load);
  } catch(error){if(load.generation===loadGeneration)status(load.signal.aborted?'文档下载已取消或超时。':error.message==='Failed to fetch'?'无法下载该链接。它可能需要登录、禁止直接下载或发生网络错误；请下载后用“打开文件”。':error.message,true);}
  finally {clearTimeout(timeout);if(load.generation===loadGeneration)$('cancelLoad').hidden=true;}
}
function exportText() {
  if(!documentState)return;
  const pieces=[`QudadFlow Translator\n${documentState.name}\n目标语言：${$('targetLanguage').value}\n`];
  for(let number=1;number<=documentState.pageCount;number++) {
    const page=documentState.cache.get(number);pieces.push(`\n--- ${documentState.kind==='PDF'?'Page':'Section'} ${number} ---\n`);
    if(!page){pieces.push('此页尚未提取或翻译。');continue;}
    if(!page.blocks.length)pieces.push('此页无可提取的文字。');
    for(const block of page.blocks)pieces.push(`原文\n${block.text}\n\n译文\n${block.translation||'尚未翻译'}\n`);
  }
  const url=URL.createObjectURL(new Blob(['\uFEFF',pieces.join('\n')],{type:'text/plain;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=documentState.name.replace(/\.[^.]+$/,'')+'.bilingual.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
for(const id of ['openFile','chooseFile'])$(id).addEventListener('click',()=>$('file').click());
$('file').addEventListener('change',()=>openFile($('file').files[0]));
$('showLink').addEventListener('click',()=>{$('linkForm').hidden=!$('linkForm').hidden;if(!$('linkForm').hidden)$('documentUrl').focus();});
$('linkForm').addEventListener('submit',openUrl);
$('cancelLoad').addEventListener('click',()=>{startLoad();downloadController.abort();$('cancelLoad').hidden=true;$('fileName').textContent='你的文档，两种语言。';status('已取消文档加载。');});
$('settings').addEventListener('click',()=>chrome.runtime.openOptionsPage());
$('translatePage').addEventListener('click',()=>translate());$('translateAll').addEventListener('click',()=>translate(true));
$('stop').addEventListener('click',()=>stopTranslation(true));$('export').addEventListener('click',exportText);
$('previous').addEventListener('click',()=>showPage(currentPage-1));$('next').addEventListener('click',()=>showPage(currentPage+1));$('pageNumber').addEventListener('change',()=>showPage($('pageNumber').value));
for(const id of ['sourcePane','translationPane'])$(id).addEventListener('scroll',()=>{
  if(syncing||!$('syncScroll').checked)return;const source=$(id),target=$(id==='sourcePane'?'translationPane':'sourcePane');
  syncing=true;target.scrollTop=source.scrollTop/Math.max(1,source.scrollHeight-source.clientHeight)*Math.max(0,target.scrollHeight-target.clientHeight);requestAnimationFrame(()=>{syncing=false;});
});
let previousWidth=0;new ResizeObserver(()=>{const width=$('sourcePane').clientWidth;if(Math.abs(width-previousWidth)<1)return;const changed=previousWidth>0;previousWidth=width;clearTimeout(resizeTimer);if(documentState?.kind==='PDF'&&changed)resizeTimer=setTimeout(()=>showPage(currentPage,true),150);else scheduleAlignment();}).observe($('sourcePane'));
for(const type of ['dragenter','dragover'])document.addEventListener(type,event=>{if(event.dataTransfer?.types.includes('Files')){event.preventDefault();document.body.classList.add('dragging');}});
document.addEventListener('dragleave',event=>{if(!event.relatedTarget)document.body.classList.remove('dragging');});
document.addEventListener('drop',event=>{if(event.dataTransfer?.files.length){event.preventDefault();document.body.classList.remove('dragging');openFile(event.dataTransfer.files[0]);}});
chrome.storage.onChanged.addListener(async(_changes,area)=>{if(area!=='local')return;await stopTranslation();for(const page of documentState?.cache.values()||[])for(const block of page.blocks)delete block.translation;const settings=await chrome.storage.local.get({targetLanguage:'zh-CN'});$('targetLanguage').value=settings.targetLanguage;updateTranslations();if(documentState)status('翻译配置已更改。请重新翻译文档。');});
$('targetLanguage').addEventListener('change',()=>chrome.storage.local.set({targetLanguage:$('targetLanguage').value}));
window.addEventListener('pagehide',()=>{clearInterval(heartbeat);cancelRequests();port?.disconnect();downloadController?.abort();loadingTask?.destroy();});
const settings=await chrome.storage.local.get({targetLanguage:'zh-CN'});$('targetLanguage').value=settings.targetLanguage;
function readDocumentLink() {
  const params=new URLSearchParams(location.hash.slice(1));
  if(params.get('url')){try{const url=new URL(params.get('url'));if(['https:','http:'].includes(url.protocol)){$('documentUrl').value=url.href;$('linkForm').hidden=false;status('当前文档链接已填入，点击“打开文档”继续。');}}catch{}}
  if(params.has('local'))status('本地文件或浏览器临时链接，请点击“打开文件”选择下载后的文档。');
  history.replaceState(null,'',location.pathname);
}
readDocumentLink();window.addEventListener('hashchange',readDocumentLink);
