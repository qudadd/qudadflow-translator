import {MAX_FILE_BYTES, MAX_PAGES, textPages, decodeText, parseDocxXml, pdfBlocks, translationBatches, markedTranslations} from './src/document-format.mjs';
import {PdfLayoutView,fitText,blockDetail} from './src/layout-view.mjs';
import {renderWord,WordLayoutView} from './src/word-layout.mjs';
import {FigureWorkflow,imageData} from './src/figure-workflow.mjs';
import {markdownTables} from './src/table-export.mjs';
import {extractPdfFigures,pdfCropRect} from './src/pdf-figures.mjs';
import {ReaderPageStack} from './src/reader-pages.mjs';
import {ModelPicker} from './src/model-picker.mjs';
import {buildPdfFigurePlan} from './src/pdf-figure-plan.mjs';
import {pdfRegionMatch} from './src/pdf-region-match.mjs';
import {pdfDetectionPages,inspectPdfFigureDetections,previewPdfDetections} from './src/pdf-figure-ai.mjs';

const $ = id => document.getElementById(id);
let documentState, pdfLibrary, loadingTask, downloadController, renderTask, textLayer;
let loadGeneration = 0, renderGeneration = 0, jobGeneration = 0, jobRunning = false, port, sequence = 0;
let currentPage = 1, views = new Map(), syncing = false, resizeTimer, alignmentFrame;
let layoutView,backgroundTask,figures;
let pageStack,readingModeRevision=0,extractionJob,translationModels;
const pdfViews=new Map(),renderTasks=new Set();
const layoutMode=()=>$('layoutMode').value;
const continuous=()=>documentState?.kind==='PDF'&&$('pageMode').value==='continuous';
let immersiveColorRevision = 0;
function setImmersiveColor(value) {
  const color = typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : '';
  document.documentElement.toggleAttribute('data-qf-immersive-color', Boolean(color));
  if (color) document.documentElement.style.setProperty('--qf-immersive-color', color);
  else document.documentElement.style.removeProperty('--qf-immersive-color');
}
const pending = new Map();
const status = (text, error = false) => { $('status').textContent = text; $('status').classList.toggle('error', error); };
function taskControls(figureLocked=Boolean(figures?.busy||figures?.importing||figures?.externalBusy)) {
  figureLocked=figureLocked||Boolean(translationModels?.pending)||Boolean(figures?.modelPicker?.pending);
  const ready=Boolean(documentState),pdf=ready&&documentState.kind==='PDF';
  translationModels?.setLocked(jobRunning||figureLocked);
  for(const id of ['translatePage','translateAll'])$(id).disabled=!ready||jobRunning||figureLocked;
  // Local extraction uses no API slots and can run while body translation is pending.
  $('extractDocumentFigures').hidden=!pdf;
  $('extractDocumentFigures').disabled=!pdf||Boolean(extractionJob)||figureLocked;
  $('stopExtraction').hidden=!extractionJob;
  $('aiFigureControls').hidden=!pdf;
  $('enhancePdfFigures').disabled=!pdf||figureLocked||jobRunning||!figures?.hasAI;
  $('aiFigurePages').disabled=Boolean(extractionJob);
  $('aiFigureCurrent').disabled=Boolean(extractionJob);
  $('aiFigureRetry').disabled=Boolean(extractionJob)||jobRunning||Boolean(figures?.busy);
  if(pdf)updateAiFigureScope();
}
function controls() {
  const ready = Boolean(documentState);
  taskControls();
  $('stop').hidden = !jobRunning;
  $('previous').disabled = !ready || currentPage <= 1;
  $('next').disabled = !ready || currentPage >= documentState.pageCount;
  $('pageNumber').disabled = !ready;
  $('pageMode').disabled=!ready||documentState.kind!=='PDF';
  $('export').disabled = !ready || !Array.from(documentState.cache.values()).some(page => page.blocks?.some(block => block.translation));
  if(figures){figures.textBusy=jobRunning||Boolean(translationModels?.pending);figures.controls();}
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
function request(text, context, onProgress,extra={}) {
  const {signal,...payload}=extra;
  if(signal?.aborted)return Promise.reject(new Error('图表识别已停止。'));
  const requestId = `doc-${++sequence}`;
  const connection = connect(); let resolve;
  const promise = new Promise(done => {resolve = done;});
  pending.set(requestId, {resolve, promise, onProgress, connection});
  const abort=()=>{if(!pending.has(requestId))return;pending.delete(requestId);try{connection.postMessage({type:'CANCEL',requestId});}catch{}resolve({ok:false,error:'图表识别已停止。'});};
  signal?.addEventListener('abort',abort,{once:true});
  try {connection.postMessage({type:'TRANSLATE', requestId, text, context, targetLanguage:$('targetLanguage').value,...payload});}
  catch {pending.delete(requestId); resolve({ok:false,error:'扩展已重新加载，请刷新阅读器。'});}
  return promise.then(result => {if (!result.ok) throw new Error(result.error || '翻译失败。');return payload.type&&payload.type!=='TRANSLATE'?result:result.translation;}).finally(()=>signal?.removeEventListener('abort',abort));
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
  figures?.invalidate();
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
  layoutView?.update();
  for(const [number,view]of pdfViews)view.layout?.update({notice:number===currentPage});
  controls();
  scheduleAlignment();
}
function scheduleAlignment() {
  cancelAnimationFrame(alignmentFrame);
  alignmentFrame=requestAnimationFrame(()=>{
    if(!documentState || documentState.kind==='PDF'||layoutView)return;
    const source=$('sourceContent').querySelectorAll('.document-block'), translated=$('translationContent').querySelectorAll('.document-block');
    if(layoutMode()!=='paragraph'){
      let overflow=0;
      source.forEach((node,index)=>{
        const target=translated[index];if(!target)return;target.style.height=`${node.offsetHeight}px`;
        const text=target.lastElementChild,block=documentState.cache.get(currentPage)?.blocks[index];
        const box={width:node.lastElementChild.clientWidth,height:node.lastElementChild.offsetHeight},fontSize=parseFloat(getComputedStyle(node.lastElementChild).fontSize);
        text.textContent=block.translation||block.partial||block.text;text.style.height=`${box.height}px`;
        const fits=fitText(text,box,fontSize);text.classList.toggle('layout-fallback',!fits);
        if(!fits){overflow++;text.textContent=block.text;text.style.fontSize=`${fontSize}px`;}
        text.title=fits?'点击查看原文和完整译文':'本段译文超出原区域，保留原文；点击查看完整译文';
        text.onclick=()=>blockDetail(block);text.tabIndex=0;text.setAttribute('role','button');
        text.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();blockDetail(block);}};
      });
      $('layoutNotice').textContent=overflow?`${overflow} 段译文超出原区域，保留原文；点击段落查看完整译文。`:'文本按阅读段落显示，原位模式固定每段位置；点击段落可查看原文和完整译文。';
      return;
    }
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
    // Resolve the embedded font names before grouping paragraphs by weight/style.
    await pdfPage.getOperatorList();
    for(const [name,style]of Object.entries(content.styles||{}))if(pdfPage.commonObjs.has(name))style.name=pdfPage.commonObjs.get(name)?.name||style.fontFamily;
    // Use logical page coordinates for reading order even when the displayed page is rotated.
    const blocks = pdfBlocks(content, pdfPage.getViewport({scale:1,rotation:0}), library.Util.transform);
    const chars = blocks.reduce((sum, block) => sum + block.text.length, 0);
    state.totalChars += chars;
    const page = {blocks,content};state.cache.set(number,page);
    return page;
  })();
  state.inflight.set(number,promise);
  try {return await promise;} finally {state.inflight.delete(number);}
}
function disposePdfView(number){
  const view=pdfViews.get(number);if(!view)return;
  view.cancelled=true;for(const task of view.tasks)task.cancel();
  for(const block of view.page?.blocks||[])views.delete(block);
  pdfViews.delete(number);
  for(const canvas of view.canvases||[]){canvas.width=0;canvas.height=0;}
}
function clearPageViews(){
  pageStack?.close();pageStack=undefined;
  for(const task of renderTasks)task.cancel();renderTasks.clear();
  for(const number of [...pdfViews.keys()])disposePdfView(number);
  renderTask?.cancel();backgroundTask?.cancel();textLayer?.cancel();layoutView=undefined;
}
function activatePdfPage(number){
  currentPage=number;$('pageNumber').value=number;controls();
  const view=pdfViews.get(number);figures?.setContext(view?.context||null);
  if(view){view.layout?.update({notice:true});if(!jobRunning)status(`第 ${number}/${documentState.pageCount} 页 · ${view.page.blocks.filter(b=>b.translation).length}/${view.page.blocks.length} 段已翻译。`);}
}
async function renderPdfPage(number,state,generation,sourceContainer,translationContainer){
  const page=await pageData(number,state),pdfPage=await state.pdf.getPage(number),library=await pdfLibrary;
  if(generation!==renderGeneration||state!==documentState)return false;
  disposePdfView(number);
  const view={page,tasks:new Set(),canvases:[],cancelled:false};pdfViews.set(number,view);
  const valid=()=>!view.cancelled&&generation===renderGeneration&&state===documentState;
  const run=async task=>{view.tasks.add(task);renderTasks.add(task);try{await task.promise;}finally{view.tasks.delete(task);renderTasks.delete(task);}};
  try{
    const positioned=layoutMode()!=='paragraph',width=Math.min(1100,Math.max(160,($('sourcePane').clientWidth||$('translationPane').clientWidth)-28));
    const base=pdfPage.getViewport({scale:1}),viewport=pdfPage.getViewport({scale:width/base.width});
    const ratio=Math.min(devicePixelRatio||1,2,Math.sqrt(8000000/(viewport.width*viewport.height)));
    if(viewport.height>30000||!Number.isFinite(viewport.height))throw new Error('此 PDF 页尺寸异常，无法显示。');
    const originalBase=pdfPage.getViewport({scale:1,rotation:0});
    sourceContainer.replaceChildren();translationContainer.replaceChildren();
    const sheet=document.createElement('div');sheet.className='pdf-sheet';sheet.style.width=`${viewport.width}px`;sheet.style.height=`${viewport.height}px`;sheet.style.setProperty('--scale-factor',viewport.scale);
    const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width*ratio);canvas.height=Math.ceil(viewport.height*ratio);canvas.style.width=`${viewport.width}px`;canvas.style.height=`${viewport.height}px`;canvas.setAttribute('aria-label',`PDF 原文第 ${number} 页`);view.canvases.push(canvas);
    const layer=document.createElement('div');layer.className='textLayer';sheet.append(canvas,layer);sourceContainer.append(sheet);
    const task=pdfPage.render({canvas,viewport,transform:ratio===1?null:[ratio,0,0,ratio,0,0],recordImages:true,recordOperations:true});
    await run(task);if(!valid())return false;
    const text=new library.TextLayer({textContentSource:page.content,container:layer,viewport});view.tasks.add(text);renderTasks.add(text);
    try{await text.render();}finally{view.tasks.delete(text);renderTasks.delete(text);}if(!valid())return false;
    const operators=await pdfPage.getOperatorList();if(!valid())return false;
    const detected=state.figurePlan?.[number-1]||extractPdfFigures({page:pdfPage,content:page.content,operators,viewport,base:originalBase,library});page.tables=detected.tables;
    if(positioned){
      const background=document.createElement('canvas');background.width=canvas.width;background.height=canvas.height;view.canvases.push(background);
      if(operators.fnArray.length>150000)throw new Error('PDF 绘图指令过多，请使用段落对照模式。');
      const textOps=new Set(['showText','showSpacedText','nextLineShowText','nextLineSetSpacingShowText'].map(n=>library.OPS[n]).filter(Number.isFinite));
      const disabled=operators.fnArray.some((op,i)=>op===library.OPS.setTextRenderingMode&&operators.argsArray[i][0]>=4||op===library.OPS.setFont&&pdfPage.commonObjs.has(operators.argsArray[i][0])&&pdfPage.commonObjs.get(operators.argsArray[i][0])?.isType3Font);
      await run(pdfPage.render({canvas:background,viewport,transform:ratio===1?null:[ratio,0,0,ratio,0,0],operationsFilter:(index,list)=>!textOps.has(list.fnArray[index])}));if(!valid())return false;
      const translatedSheet=sheet.cloneNode(false),replacement=document.createElement('div');replacement.className='replacement-layer';translatedSheet.append(replacement);translationContainer.append(translatedSheet);
      view.layout=new PdfLayoutView({page,source:canvas,background,sheet:translatedSheet,layer:replacement,viewport,base:originalBase,library,ratio,disabled,notice:number===currentPage});view.canvases.push(view.layout.canvas);
      if(!page.blocks.length){const empty=document.createElement('div');empty.className='empty-page';empty.textContent='此页无可提取文字。扫描正文需先 OCR；底部可以提取图表或整页。';translatedSheet.append(empty);}
    }else{
      const translations=document.createElement('div');translations.className='translated-text';page.blocks.forEach((block,index)=>translations.append(blockView(block,index,true)));translationContainer.append(translations);
      if(!page.blocks.length){translations.className='empty-page';translations.textContent='此页没有可提取文字；扫描正文需先 OCR，底部可提取图表或整页。';}
    }
    view.figureGeometry={viewport,base:originalBase};
    view.context={canvas,images:pdfPage.imageCoordinates,page:number,regions:detected.regions.map(region=>({...region,rect:pdfCropRect(region,viewport,originalBase,library,canvas)})),tables:detected.tables,
      source:{title:state.name,url:state.sourceUrl,page:String(number)},text:page.blocks.map(b=>b.text).join('\n\n')};
    if(valid()&&number===currentPage){figures.setContext(view.context);if(!positioned)$('layoutNotice').textContent='段落对照会重新排版文字；沉浸原位和原版对照保留页面比例。';}
    updateTranslations();return valid();
  }catch(error){if(valid()&&error.name!=='RenderingCancelledException')status(error.message,true);return false;}
}
async function showPage(number, preserveScroll = false, rebuild = false) {
  const state = documentState;if (!state) return;
  number = Math.max(1,Math.min(state.pageCount,Math.trunc(Number(number)||1)));currentPage = number;
  if(continuous()&&pageStack&&!rebuild){await pageStack.navigate(number);return true;}
  const anchor=preserveScroll&&pageStack?pageStack.anchor($('translationPane')):null;
  const generation = ++renderGeneration;
  clearPageViews();figures?.setContext(null);
  const mode=layoutMode();$('workspace').classList.toggle('immersive',mode==='immersive');$('workspace').classList.toggle('text-immersive',mode!=='paragraph'&&state.kind!=='PDF'&&!state.wordLayout);$('showOriginal').hidden=mode!=='immersive';
  const scroll = ['sourcePane','translationPane'].map(id => $(id).scrollTop / Math.max(1,$(id).scrollHeight - $(id).clientHeight));
  $('pageNumber').value = number;$('pageCount').textContent = state.pageCount;controls();
  try {
    const page = await pageData(number,state);
    if (generation !== renderGeneration || state !== documentState) return false;
    if(!jobRunning)status(`第 ${number}/${state.pageCount} 页 · ${page.blocks.filter(block=>block.translation).length}/${page.blocks.length} 段已翻译${page.blocks.length?'':'；此页无可提取文字'}。`);
    views = new Map();$('sourceContent').replaceChildren();$('translationContent').replaceChildren();
    $('sourceContent').classList.toggle('reader-page-stack',continuous());$('translationContent').classList.toggle('reader-page-stack',continuous());
    if(state.kind==='PDF'){
      if(continuous()){
        const pdfPage=await state.pdf.getPage(number);if(generation!==renderGeneration)return false;
        const base=pdfPage.getViewport({scale:1}),width=Math.min(1100,Math.max(160,($('sourcePane').clientWidth||$('translationPane').clientWidth)-28));
        pageStack=new ReaderPageStack({source:$('sourceContent'),translation:$('translationContent'),render:(n,a,b)=>renderPdfPage(n,state,generation,a,b),dispose:disposePdfView,onActive:activatePdfPage,onError:error=>status(error.message,true)});
        // Restore before rendering so a slow page cannot overwrite a later user scroll.
        const stack=pageStack;await stack.mount(state.pageCount,number,width,width/base.width*base.height+56,anchor);
        if(generation!==renderGeneration)return false;
      }else await renderPdfPage(number,state,generation,$('sourceContent'),$('translationContent'));
    }else{
    const positioned=mode!=='paragraph'&&state.wordLayout;
    if(!positioned){
      const translations=document.createElement('div');translations.className='translated-text';
      if(!page.blocks.length){translations.className='empty-page';translations.textContent='此页没有可提取文字；扫描 PDF 请先 OCR。也可以在底部提取图表后分析。';}
      page.blocks.forEach((block,index)=>translations.append(blockView(block,index,true)));$('translationContent').append(translations);
    }
    updateTranslations();
    if(state.wordLayout&&positioned){
      const width=Math.min(1100,Math.max(160,($('sourcePane').clientWidth||$('translationPane').clientWidth)-28));
      layoutView=new WordLayoutView({page,sourceContainer:$('sourceContent'),translationContainer:$('translationContent'),width});figures.setContext({element:layoutView.source,page:number,source:{title:state.name,url:state.sourceUrl,page:String(number)},text:page.blocks.map(b=>b.text).join('\n\n')});
    } else {
      const source = document.createElement('div');source.className='source-text';page.blocks.forEach((block,index)=>source.append(blockView(block,index)));$('sourceContent').append(source);
      figures.setContext({element:page.template||source,tables:state.tables,page:number,source:{title:state.name,url:state.sourceUrl,page:String(number)},text:page.blocks.map(b=>b.text).join('\n\n')});$('layoutNotice').textContent=state.kind==='Word'?'Word 正文阅读模式；切换沉浸原位可保留表格、图片和页边距。':'文本按阅读段落显示；原位模式固定每段位置，长译文可点击展开。';
    }
    }
    if (generation !== renderGeneration) return false;
    if(!continuous())['sourcePane','translationPane'].forEach((id,index)=>{$(id).scrollTop=preserveScroll?scroll[index]*Math.max(0,$(id).scrollHeight-$(id).clientHeight):0;});
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
  if (!documentState || jobRunning || translationModels?.pending || figures?.modelPicker?.pending) return;
  const state = documentState, job = {id:++jobGeneration,fallback:0};jobRunning=true;controls();
  const pages = all ? Array.from({length:state.pageCount},(_,i)=>i+1) : [currentPage];
  let completed=0, skipped=0, failure;
  try {
    while(pages.length) {
      // Reprioritize at every page boundary when the reader moves elsewhere.
      const index=pages.indexOf(currentPage),number=pages.splice(index<0?0:index,1)[0];
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
    worker.onmessage=({data})=>done(data.ok?null:new Error(data.error),data);
    worker.onerror=()=>done(new Error('无法解析 Word 文件。'));
    signal.addEventListener('abort',abort,{once:true});if(signal.aborted)return abort();
    worker.postMessage(bytes.buffer,[bytes.buffer]);
  });
}
function startLoad() {
  const generation=++loadGeneration;downloadController?.abort();const controller=new AbortController();downloadController=controller;
  stopTranslation();stopFigureExtraction();renderGeneration+=1;clearPageViews();figures?.reset();document.getElementById('wordStyles')?.remove();clearTimeout(resizeTimer);
  const old=documentState, oldTask=loadingTask;documentState=undefined;loadingTask=undefined;views.clear();controls();$('cancelLoad').hidden=false;
  $('aiFigureReport').hidden=true;$('aiFigureReport').open=false;$('aiFigureIssues').replaceChildren();$('aiFigureRetry').hidden=true;$('aiFigurePages').value='';
  $('workspace').hidden=true;$('welcome').hidden=false;$('layoutBar').hidden=true;$('sourceContent').replaceChildren();$('translationContent').replaceChildren();
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
    let pages,kind,wordLayout,tables;
    if(bytes[0]===80&&bytes[1]===75) {kind='Word';const decoded=await unzipWord(bytes,load.signal);parseDocxXml(decoded.xml);wordLayout=await renderWord(decoded.files,load.signal);pages=wordLayout.pages;}
    else {
      if(!/\.(txt|md|markdown)$/i.test(name))throw new Error('此链接或文件不是 PDF、DOCX、TXT 或 Markdown。网页登录页不能作为文档打开，请下载文件后选择它。');
      kind=/\.(md|markdown)$/i.test(name)?'Markdown':'TXT';const text=decodeText(bytes);
      pages=textPages(text.split(/\n\s*\n/));tables=markdownTables(text);
    }
    state={kind,name,pageCount:pages.length,cache:new Map(pages.map((page,index)=>[index+1,page])),inflight:new Map(),tables,wordLayout:Boolean(wordLayout)};
    if(wordLayout&&load.generation===loadGeneration){wordLayout.styles.id='wordStyles';document.body.append(wordLayout.styles);}
  }
  if(load.generation!==loadGeneration)return;
  state.sourceUrl=load.sourceUrl||'';documentState=state;currentPage=1;$('welcome').hidden=true;$('workspace').hidden=false;$('layoutBar').hidden=false;
  $('fileName').textContent=name;$('fileDetail').textContent=`${state.kind} · ${state.pageCount} ${state.kind==='PDF'||state.wordLayout?'页':'个阅读分段'} · 本地解析`;
  $('sourceLabel').textContent=state.kind==='PDF'?'PDF 原页 · 文字可选':state.kind==='Word'?'Word 浏览器排版':'正文阅读排版 · 非原文件分页';
  $('translationLabel').textContent='原位替换 · 支持传统 / AI 翻译';
  $('pageNumber').max=state.pageCount;const shown=await showPage(1);controls();
  if(shown&&load.generation===loadGeneration)status('文档已打开。点击“翻译当前页”或“翻译全文”开始，传统与 AI 接口均可翻译正文。');
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
  const load=startLoad();load.sourceUrl=url.origin+url.pathname;status('正在下载文档到浏览器…');
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
async function researchSource(all=false){
  const state=documentState;if(!state)throw new Error('请先打开文档。');
  const first=all?1:currentPage,last=all?state.pageCount:currentPage;let text='',end=first;
  for(let number=first;number<=last;number++){
    const page=await pageData(number,state);if(state!==documentState)throw new Error('文档已替换，请重新分析。');
    const value=(text?'\n\n':'')+'[Page '+number+']\n'+page.blocks.map(block=>block.text).join('\n\n')+(page.tables?.length?'\n\n[Local coordinate tables; verify against original]\n'+page.tables.map(t=>t.caption+'\n'+t.markdown).join('\n\n'):'');
    text+=value;end=number;
  }
  return {title:state.name,url:state.sourceUrl,page:first===end?String(first):first+'–'+end,text,truncated:false};
}
function stopFigureExtraction(){if(extractionJob){extractionJob.cancelled=true;extractionJob.task?.cancel();extractionJob.controller?.abort();}}
async function extractDocumentFigures(){
  if(documentState?.kind!=='PDF'||extractionJob||figures.busy||figures.importing||figures.externalBusy)return;
  const state=documentState,job={cancelled:false};extractionJob=job;figures.externalBusy=true;figures.controls();controls();$('figureWorkflow').open=true;
  let count=0,scanned=0,canvas;
  try{
    const library=await pdfLibrary;
    const metadata=[];
    for(let number=1;number<=state.pageCount;number++){
      if(job.cancelled||state!==documentState)break;
      figures.notice(`正在本地识别第 ${number}/${state.pageCount} 页的图注与表格，关联跨页图表。不调用 API，可停止。`);
      const data=await pageData(number,state),page=await state.pdf.getPage(number);
      if(job.cancelled||state!==documentState)break;
      const base=page.getViewport({scale:1,rotation:0}),normal=page.getViewport({scale:1}),viewport=page.getViewport({scale:Math.min(2,1600/Math.max(normal.width,normal.height))});
      canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
      job.task=page.render({canvas,viewport,recordImages:true,recordOperations:true});await job.task.promise;job.task=null;
      if(job.cancelled||state!==documentState)break;
      const operators=await page.getOperatorList();if(job.cancelled||state!==documentState)break;
      const detected=extractPdfFigures({page,content:data.content,operators,viewport,base,library});metadata.push({...detected.metadata,page:number});scanned++;
      canvas.width=canvas.height=0;canvas=null;
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    if(!job.cancelled&&state===documentState){
      const plan=buildPdfFigurePlan(metadata);state.figurePlan=plan;
      // Apply only after the complete scan, so interrupted scans cannot mislabel a continuation.
      for(const detected of plan){
        if(job.cancelled||state!==documentState)break;
        const number=detected.page,data=await pageData(number,state);data.tables=detected.tables;
        figures.collectTables(detected.tables,{page:String(number)});
        if(!detected.regions.length)continue;
        figures.notice(`正在载入第 ${number} 页正式图表 · 已新增 ${count} 项；跨页图表按页标记。`);
        const page=await state.pdf.getPage(number),base=page.getViewport({scale:1,rotation:0}),normal=page.getViewport({scale:1}),viewport=page.getViewport({scale:Math.min(2,1600/Math.max(normal.width,normal.height))});
        if(job.cancelled||state!==documentState)break;
        canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
        job.task=page.render({canvas,viewport});await job.task.promise;job.task=null;if(job.cancelled||state!==documentState)break;
        count+=figures.extract({canvas,page:number,regions:detected.regions.map(r=>({...r,rect:pdfCropRect(r,viewport,base,library,canvas)})),tables:detected.tables,source:{title:state.name,url:state.sourceUrl,page:String(number)},text:data.blocks.map(b=>b.text).join('\n\n')},{silent:true});
        canvas.width=canvas.height=0;canvas=null;await new Promise(resolve=>setTimeout(resolve,0));
      }
    }
    if(state===documentState){
      const names=new Set(state.figurePlan?.flatMap(p=>p.regions.map(r=>r.identity))||[]);
      figures.notice(`${job.cancelled?'已停止':'提取完成'} · 已检查 ${scanned}/${state.pageCount} 页，新增 ${count} 项，识别 ${names.size} 个图表编号（跨页分段展示）。已过滤页眉、页脚及无可靠图注的图片；漏识别可用 AI 补充识别或框选。`);
      if(!job.cancelled)figures.workbench.show('gallery',{open:false});
      for(const [number,view]of pdfViews){const detected=state.figurePlan?.[number-1];if(detected&&view.context){const {viewport,base}=view.figureGeometry;view.context.regions=detected.regions.map(r=>({...r,rect:pdfCropRect(r,viewport,base,library,view.context.canvas)}));view.context.tables=detected.tables;}}
    }
  }catch(error){if(state===documentState)figures.notice(job.cancelled?'已停止提取，已载入的图表保留。':`提取在第 ${scanned+1} 页停止：${error.message} 已载入的图表保留。`,!job.cancelled);}
  finally{if(canvas)canvas.width=canvas.height=0;if(extractionJob===job){extractionJob=undefined;figures.externalBusy=null;figures.controls();controls();}}
}
async function enhancePdfFigures(){
  if(documentState?.kind!=='PDF'||extractionJob||jobRunning||figures.busy||figures.importing||figures.externalBusy||!figures.hasAI)return;
  let pages;try{pages=pdfDetectionPages($('aiFigurePages').value,currentPage,documentState.pageCount);}catch(error){figures.notice(error.message,true);return;}
  const state=documentState,job={cancelled:false,controller:new AbortController()},candidates=[];extractionJob=job;figures.externalBusy=true;figures.controls();controls();$('figureWorkflow').open=true;
  let canvas,scanned=0,duplicates=0,added=0,recovered=0,apiFailure;const records=[];
  const valid=()=>!job.cancelled&&state===documentState;
  try{
    const library=await pdfLibrary;
    for(const number of pages){
      if(!valid())break;figures.notice(`AI 正在识别第 ${number} 页（${scanned+1}/${pages.length}）· 发送该页图片与文字；可停止，完成后预览核对。`);
      const data=await pageData(number,state),page=await state.pdf.getPage(number);if(!valid())break;
      const base=page.getViewport({scale:1}),viewport=page.getViewport({scale:Math.min(2,1599/Math.max(base.width,base.height))});
      canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
      job.task=page.render({canvas,viewport});await job.task.promise;job.task=null;if(!valid())break;
      const logical=page.getViewport({scale:1,rotation:0}),existing=figures.items.filter(item=>Number(item.source?.page)===number&&item.pdfRegion).map(item=>{
        const rect=pdfCropRect(item.pdfRegion,viewport,logical,library,canvas);
        return {item,area:{kind:item.pdfRegion.kind,identity:item.pdfRegion.identity,x:rect.x/canvas.width,y:rect.y/canvas.height,width:rect.width/canvas.width,height:rect.height/canvas.height}};
      });
      const knownRegions=existing.map(({item,area})=>({kind:area.kind,label:item.pdfRegion.label,box:[area.x,area.y,area.width,area.height].map(n=>Math.round(n*1000))}));
      const pageImage=imageData(canvas),geometry={width:canvas.width,height:canvas.height};let detection;
      for(let attempt=0;attempt<2;attempt++){
        if(attempt)figures.notice(`第 ${number} 页定位格式异常，正在纠正一次；不重复已有效的页面，可随时停止。`);
        let response;
        try{response=await request(data.blocks.map(b=>b.text).join('\n\n'),'PDF figure localisation',undefined,{type:'PDF_FIGURE_DETECT',imageData:pageImage,imageWidth:canvas.width,imageHeight:canvas.height,repairAttempt:attempt>0,knownRegions,signal:job.controller.signal});}
        catch(error){apiFailure=error;break;}
        if(!valid())break;
        try{detection=inspectPdfFigureDetections(response.translation,geometry);}
        catch(error){detection={regions:[],issues:[{reason:error.message}]};}
        if(detection.regions.length||!detection.issues.length){if(attempt){recovered++;records.push({page:number,reason:'已纠正定位格式，候选待核对',retry:false});}break;}
      }
      if(!valid())break;scanned++;
      if(apiFailure){records.push({page:number,reason:`接口报错，已停止后续页面：${apiFailure.message}`,retry:true});break;}
      const {regions,issues}=detection;
      for(const issue of issues)records.push({page:number,reason:`${issue.label||'候选 '+(issue.index||'')}：${issue.reason}`,retry:true});
      for(const region of regions)for(const reason of region.coordinateNotes)records.push({page:number,reason:`${region.label}：${reason}`,retry:false});
      for(const region of regions){
        // AI boxes use the displayed orientation, so comparisons use normalized display boxes.
        const normalized={kind:region.kind,identity:region.identity,x:region.x/canvas.width,y:region.y/canvas.height,width:region.width/canvas.width,height:region.height/canvas.height};
        const match=existing.find(({area})=>pdfRegionMatch(area,normalized)?.same)||existing.find(({area})=>pdfRegionMatch(area,normalized)?.spatial);
        const local=match?.item,relation=match&&pdfRegionMatch(match.area,normalized);
        if(relation){
          const contained=relation.overlap>=.94*relation.areaB;
          if(relation.larger>.88||contained||region.kind==='table'&&relation.spatial&&relation.areaB<=relation.areaA*1.12){duplicates++;continue;}
          // A larger crop replaces the existing item only after explicit review.
          if(relation.conflict){region.coordinateNotes.push('与已有区域重叠但编号不同；保留已有编号，请核对后确认替换');region.needsReview=true;}
          if(!local.pdfRegion.identity.startsWith('ai:')){region.identity=local.pdfRegion.identity;region.label=local.pdfRegion.label;}
        }
        const key=local?.key||(region.identity.startsWith('ai:')?`pdf-${number}-ai-${[normalized.x,normalized.y,normalized.width,normalized.height].map(n=>Math.round(n*1000)).join('-')}`:`pdf-${number}-${region.identity}`);
        if(figures.items.some(item=>item.key===key)&&!local){duplicates++;continue;}
        if(candidates.length>=40||candidates.reduce((sum,c)=>sum+c.data.length,0)>28*1024*1024)throw new Error('本次候选图表较多，请缩小识别页码范围后分批处理。');
        // Store logical coordinates, including rotation, for stable comparison on later runs.
        const unrotated=page.getViewport({scale:1,rotation:0}),matrix=library.Util.transform(unrotated.transform,library.Util.inverseTransform(viewport.transform)),bounds=[Infinity,Infinity,-Infinity,-Infinity];
        library.Util.axialAlignedBoundingBox([region.x/canvas.width*viewport.width,region.y/canvas.height*viewport.height,(region.x+region.width)/canvas.width*viewport.width,(region.y+region.height)/canvas.height*viewport.height],matrix,bounds);
        const logicalRegion={...region,x:bounds[0],y:bounds[1],width:bounds[2]-bounds[0],height:bounds[3]-bounds[1]};
        candidates.push({page:number,region:logicalRegion,data:imageData(canvas,region),key,replaces:local,source:{title:state.name,url:state.sourceUrl,page:String(number)},text:data.blocks.map(b=>b.text).join('\n\n')});
      }
      canvas.width=canvas.height=0;canvas=null;
    }
    if(!valid())return;
    const failedPages=[...new Set(records.filter(r=>r.retry).map(r=>r.page))];state.aiFigureRetryPages=failedPages;
    $('aiFigureIssues').replaceChildren();for(const record of records.slice(0,100)){const li=document.createElement('li');li.textContent=`第 ${record.page} 页 · ${record.reason}`;$('aiFigureIssues').append(li);}
    $('aiFigureReport').hidden=false;$('aiFigureRetry').hidden=!failedPages.length;$('aiFigureReportTitle').textContent=`上次识别 · ${scanned}/${pages.length} 页 · ${candidates.length} 个候选${failedPages.length?` · ${failedPages.length} 页需重试`:''}${recovered?` · ${recovered} 页格式已纠正`:''}`;
    const summary=(failedPages.length?` ${failedPages.length} 页存在未可靠定位的项目，可在总览重试问题页。`:'')+(apiFailure?` 接口报错已停止：${apiFailure.message}。此前成功页仍可核对。`:'');
    if(!candidates.length){figures.notice((apiFailure?'AI 图表识别未完成：'+apiFailure.message+'。':'AI 识别完成 · ')+`检查 ${scanned} 页，未发现新的可加入图表${duplicates?`，跳过 ${duplicates} 个已有裁剪`:''}。`+summary+' 可换页、换模型或框选。',Boolean(apiFailure||failedPages.length));return;}
    figures.notice(`AI 找到 ${candidates.length} 个候选；请在预览中核对后加入。`+summary,Boolean(apiFailure));
    const selected=await previewPdfDetections(candidates,{signal:job.controller.signal,workbench:figures.workbench,onSource:page=>showPage(page),summary});if(!valid()||!selected)return;
    if(!selected.length){figures.notice('已取消加入，原有图表保留。'+summary,Boolean(apiFailure));return;}
    if(selected.some(c=>c.data.length>4*1024*1024))throw new Error('候选图片超过 4 MB，请缩小页码范围或手动框选。');
    const replacements=new Set(selected.map(c=>c.replaces).filter(Boolean)),bytes=figures.items.filter(i=>!replacements.has(i)).reduce((sum,i)=>sum+i.data.length,0)+selected.reduce((sum,c)=>sum+c.data.length,0);
    if(figures.items.length-replacements.size+selected.length>40||bytes>32*1024*1024)throw new Error('加入后超过 40 张或 32 MB，请移除部分图表，再缩小页码范围识别。');
    for(const c of selected){if(c.replaces)figures.removeItem(c.replaces);added+=Number(figures.add(c.data,`第 ${c.page} 页 · ${c.region.label}`,c.key,c.region.caption,c.source,{paperText:c.text,pdfRegion:c.region,verification:'AI 定位 · 待核对：请检查裁剪完整性和图表编号。图片表格可点击“提取可复制表格”。'+(c.region.coordinateNotes||[]).join('；')}));}
    figures.notice(`AI 补充完成 · 已加入 ${added} 项${duplicates?`，跳过 ${duplicates} 个重复裁剪`:''}。AI 定位和后续表格转写均需对照原页核查。`+summary,Boolean(apiFailure));
  }catch(error){if(state===documentState)figures.notice(job.cancelled?'已停止 AI 图表识别；尚未确认的候选未加入。':`AI 图表识别未完成：${error.message}`,!job.cancelled);}
  finally{if(canvas)canvas.width=canvas.height=0;if(extractionJob===job){extractionJob=undefined;figures.externalBusy=null;figures.controls();controls();if(job.cancelled&&state===documentState)figures.notice('已停止 AI 图表识别；尚未确认的候选未加入。');}}
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
$('layoutMode').addEventListener('change',()=>{$('workspace').classList.remove('show-original');$('showOriginal').setAttribute('aria-pressed','false');$('showOriginal').textContent='查看原文';showPage(currentPage,true,true);});
$('pageMode').addEventListener('change',()=>{readingModeRevision++;chrome.storage.local.set({readerPageMode:$('pageMode').value});void showPage(currentPage,false,true);});
$('showOriginal').addEventListener('click',()=>{const original=$('workspace').classList.toggle('show-original');$('showOriginal').setAttribute('aria-pressed',String(original));$('showOriginal').textContent=original?'返回译文':'查看原文';});
translationModels=new ModelPicker($('translationModel'),{onNotice:status,onPending:()=>controls()});
figures=new FigureWorkflow({getSource:researchSource,request:(imageData,profileId,onProgress,extra={})=>request('', 'figure',onProgress,{type:'FIGURE_ANALYZE',imageData,profileId,...extra}),cancel:cancelRequests,onBusy:locked=>taskControls(locked)});
$('extractDocumentFigures').addEventListener('click',extractDocumentFigures);$('stopExtraction').addEventListener('click',stopFigureExtraction);
$('aiFigureCurrent').addEventListener('click',()=>{$('aiFigurePages').value='';updateAiFigureScope();});
$('aiFigurePages').addEventListener('input',updateAiFigureScope);
$('aiFigureRetry').addEventListener('click',()=>{if(!documentState?.aiFigureRetryPages?.length)return;$('aiFigurePages').value=documentState.aiFigureRetryPages.join(',');updateAiFigureScope();void enhancePdfFigures();});
function updateAiFigureScope(){
  try{const pages=pdfDetectionPages($('aiFigurePages').value,currentPage,documentState?.pageCount||1);$('aiFigureScopeHint').textContent=`将发送 ${pages.length} 页的图片与文字${!$('aiFigurePages').value.trim()?`（当前第 ${currentPage} 页）`:''}。格式异常时每页最多纠正一次；接口报错即停止，核对后才加入总览。`;}
  catch(error){$('aiFigureScopeHint').textContent=error.message;}
}
$('enhancePdfFigures').addEventListener('click',enhancePdfFigures);
$('cropFigure').addEventListener('click',()=>{if(layoutMode()==='immersive'){$('workspace').classList.add('show-original');$('showOriginal').setAttribute('aria-pressed','true');$('showOriginal').textContent='返回译文';}});
for(const id of ['sourcePane','translationPane'])$(id).addEventListener('scroll',()=>{
  if(syncing)return;const source=$(id),target=$(id==='sourcePane'?'translationPane':'sourcePane');
  pageStack?.scroll(source);if(!$('syncScroll').checked)return;
  syncing=true;if(pageStack)pageStack.restore(target,pageStack.anchor(source));else target.scrollTop=source.scrollTop/Math.max(1,source.scrollHeight-source.clientHeight)*Math.max(0,target.scrollHeight-target.clientHeight);requestAnimationFrame(()=>{syncing=false;});
});
let previousWidth=0;new ResizeObserver(()=>{const width=$('sourcePane').clientWidth;if(Math.abs(width-previousWidth)<1)return;const changed=previousWidth>0;previousWidth=width;clearTimeout(resizeTimer);if((documentState?.kind==='PDF'||documentState?.wordLayout)&&changed)resizeTimer=setTimeout(()=>showPage(currentPage,true,true),150);else scheduleAlignment();}).observe($('sourcePane'));
for(const type of ['dragenter','dragover'])document.addEventListener(type,event=>{if(event.dataTransfer?.types.includes('Files')){event.preventDefault();document.body.classList.add('dragging');}});
document.addEventListener('dragleave',event=>{if(!event.relatedTarget)document.body.classList.remove('dragging');});
document.addEventListener('drop',event=>{if(event.dataTransfer?.files.length){event.preventDefault();document.body.classList.remove('dragging');openFile(event.dataTransfer.files[0]);}});
chrome.storage.onChanged.addListener(async(changes,area)=>{if(area!=='local')return;if('immersiveTranslationColor' in changes){immersiveColorRevision+=1;setImmersiveColor(changes.immersiveTranslationColor.newValue);}if(!Object.keys(changes).some(key=>['apiStyle','endpoint','apiKey','model','providerRegion','sourceLanguage','targetLanguage','temperature','streamOpenAi','customHeaders','requestTemplate','responsePath','activeProfileId'].includes(key)))return;stopFigureExtraction();await stopTranslation();figures.clearResults();for(const page of documentState?.cache.values()||[])for(const block of page.blocks)delete block.translation;const settings=await chrome.storage.local.get({targetLanguage:'zh-CN'});$('targetLanguage').value=settings.targetLanguage;updateTranslations();if(documentState)status('翻译配置已更改。请重新翻译文档。');});
$('targetLanguage').addEventListener('change',()=>chrome.storage.local.set({targetLanguage:$('targetLanguage').value}));
window.addEventListener('pagehide',()=>{clearInterval(heartbeat);cancelRequests();stopFigureExtraction();clearPageViews();port?.disconnect();downloadController?.abort();loadingTask?.destroy();});
const initialColorRevision=immersiveColorRevision,initialReadingRevision=readingModeRevision;
const settings=await chrome.storage.local.get({targetLanguage:'zh-CN',immersiveTranslationColor:'',readerPageMode:'paged'});$('targetLanguage').value=settings.targetLanguage;
if(initialReadingRevision===readingModeRevision)$('pageMode').value=settings.readerPageMode==='continuous'?'continuous':'paged';
if(initialColorRevision===immersiveColorRevision)setImmersiveColor(settings.immersiveTranslationColor);
function readDocumentLink() {
  const params=new URLSearchParams(location.hash.slice(1));
  if(params.get('url')){try{const url=new URL(params.get('url'));if(['https:','http:'].includes(url.protocol)){$('documentUrl').value=url.href;$('linkForm').hidden=false;status('当前文档链接已填入，点击“打开文档”继续。');}}catch{}}
  if(params.has('local'))status('本地文件或浏览器临时链接，请点击“打开文件”选择下载后的文档。');
  history.replaceState(null,'',location.pathname);
}
readDocumentLink();window.addEventListener('hashchange',readDocumentLink);
