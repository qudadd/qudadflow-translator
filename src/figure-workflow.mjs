import {ResearchControls,downloadText,codeBlock} from './research-ui.mjs';
import {createResearchRenderer,renderResearch} from './research-render.mjs';
import {FigurePicker} from './figure-picker.mjs';
import {markdownTables,elementTable} from './table-export.mjs';
import {FigureWorkbench} from './figure-workbench.mjs';
import {FigureInspector} from './figure-inspector.mjs';
import {ModelPicker} from './model-picker.mjs';
import {pdfRegionMatch} from './pdf-region-match.mjs';
import {figureCode,figureNotes} from './figure-code.mjs';
import {figureCodeView} from './figure-code-view.mjs';
const figureSpec=globalThis.QFFigureSpec;
const $=id=>document.getElementById(id);
const MAX_FIGURES=40, MAX_BYTES=32*1024*1024;
const SUPPLEMENT_NOTICE='本地截图 · 尚未识别。AI 补读会发送这张图片与相关材料，结果需核对。';
export function imageData(source,rect) {
  const width=rect?.width||source.naturalWidth||source.width,height=rect?.height||source.naturalHeight||source.height;
  const scale=Math.min(1,1600/Math.max(width,height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
  if(rect)ctx.drawImage(source,rect.x,rect.y,width,height,0,0,canvas.width,canvas.height);else ctx.drawImage(source,0,0,canvas.width,canvas.height);
  return canvas.toDataURL('image/jpeg',.92);
}
export class FigureWorkflow {
  constructor({request,cancel,onBusy,getSource}) {
    Object.assign(this,{request,cancel,onBusy,getSource});this.items=[];this.candidates=new Map();this.extractedTables=new Map();this.generation=0;this.busy=false;
    $('extractFigures').onclick=()=>this.extract();$('cropFigure').onclick=()=>this.crop();
    $('capturePage').onclick=()=>this.capturePage();$('analyzeFigures').onclick=()=>this.analyzeSelected();$('analyzeFigures').textContent='批量解读所选';
    $('stopFigures').onclick=()=>{this.invalidate();this.cancel();this.notice('已停止图表分析，完成的结果保留。');};
    const body=$('figureWorkflow').querySelector('.figure-body'),tools=body.querySelector('.figure-tools');
    this.documentTables=document.createElement('details');this.documentTables.className='document-tables';this.documentTables.hidden=true;tools.after(this.documentTables);
    this.importButton=document.createElement('button');this.importButton.id='importFigure';this.importButton.textContent='导入图表截图';
    this.imageFile=document.createElement('input');this.imageFile.id='figureImageFile';this.imageFile.type='file';this.imageFile.accept='image/png,image/jpeg,image/webp';this.imageFile.multiple=true;this.imageFile.hidden=true;
    this.importButton.onclick=()=>this.imageFile.click();this.imageFile.onchange=()=>{const files=Array.from(this.imageFile.files);this.imageFile.value='';void this.importImages(files);};
    tools.prepend(this.importButton,this.imageFile);
    const pasteHint=document.createElement('div');pasteHint.className='figure-paste-hint';pasteHint.tabIndex=0;pasteHint.setAttribute('aria-label','粘贴图表截图');pasteHint.textContent='图表漏提取？点击这里后按 Ctrl+V 粘贴截图，或导入 PNG / JPEG / WebP。仅本地载入，核对后再点击分析。';tools.after(pasteHint);
    body.addEventListener('paste',event=>{const files=Array.from(event.clipboardData?.items||[]).filter(item=>item.kind==='file'&&item.type.startsWith('image/')).map(item=>item.getAsFile()).filter(Boolean);if(!files.length)return;event.preventDefault();void this.importImages(files);});
    this.research=new ResearchControls($('figureWorkflow').querySelector('.figure-body'),{analyze:()=>this.analyzePaper(),stop:()=>{this.invalidate();this.cancel();this.research.notice('分析已停止，已收到的回答保留并可导出；未完成回答不加入追问上下文。');}});
    this.picker=new FigurePicker(body,{onChange:()=>this.controls(),onLoad:keys=>this.loadCandidates?.(keys),onAsk:()=>this.askSelected(),onInspect:key=>this.inspector.open(this.items.find(i=>i.key===key)),analyzeButton:$('analyzeFigures'),stopButton:$('stopFigures')});
    this.transcribeSelected=document.createElement('button');this.transcribeSelected.id='transcribeSelectedTables';this.transcribeSelected.textContent='转写所选表格';this.transcribeSelected.title='向所选 AI 发送已选图片，提取可复制的表格；请核对原图';this.transcribeSelected.onclick=()=>{const error=this.selectionError();if(error){this.notice(error,true);return;}void this.analyzeAll(this.selectedItems(),{tablesOnly:true});};$('analyzeFigures').after(this.transcribeSelected);
    this.picker.container.append($('figureStatus'));
    // Keep local extraction ahead of an empty gallery and the optional paper analysis.
    body.prepend(tools);
    this.workbench=new FigureWorkbench({root:$('figureWorkflow'),picker:this.picker.container,tables:this.documentTables,research:this.research.container,cards:$('figureCards'),importButton:this.importButton,imageFile:this.imageFile,pasteHint});
    this.inspector=new FigureInspector({workbench:this.workbench,getItems:()=>this.items});this.workbench.inspector=this.inspector;
    const questionTools=document.createElement('div');questionTools.className='figure-question-tools';
    this.selectAllForQuestion=document.createElement('button');this.selectAllForQuestion.id='selectAllQuestionFigures';this.selectAllForQuestion.textContent='全选图表并提问';this.selectAllForQuestion.title='选中所有可用图表，必要时载入原图；填写问题后点击发送才调用 AI';
    this.selectAllForQuestion.onclick=()=>this.prepareAllFigures();
    this.overviewAskAll=document.createElement('button');this.overviewAskAll.id='askAllFigures';this.overviewAskAll.textContent='全选并提问';this.overviewAskAll.onclick=()=>this.prepareAllFigures();this.picker.container.querySelector('.figure-picker-actions').prepend(this.overviewAskAll);
    this.questionSelection=document.createElement('p');this.questionSelection.className='research-hint';this.questionSelection.setAttribute('role','status');
    const choose=document.createElement('button');choose.id='chooseQuestionFigures';choose.textContent='选择 / 调整';choose.onclick=()=>this.workbench.show('gallery');
    const textOnly=document.createElement('button');textOnly.id='askPaperTextOnly';textOnly.textContent='仅用正文';textOnly.onclick=()=>{this.picker.selected.clear();this.controls();this.research.$('researchQuestion').focus();};
    questionTools.append(this.selectAllForQuestion,choose,textOnly,this.questionSelection);
    this.questionFigures=document.createElement('details');this.questionFigures.id='questionFigures';this.questionFigures.className='question-figures';const figureSummary=document.createElement('summary');figureSummary.textContent='参与问答的图表';this.questionFigures.append(figureSummary,questionTools);this.research.$('researchQuestion').before(this.questionFigures);
    this.research.$('selectedFiguresHint').hidden=true;
    const questionArea=document.createElement('div');questionArea.className='workbench-question';
    questionArea.append(this.research.container.querySelector('.question-label'),this.questionFigures,this.research.$('researchQuestion'),this.research.$('questionPresets'),this.research.container.querySelector('.research-actions'));
    this.research.$('researchOptions').before(questionArea);
    this.modelPicker=new ModelPicker($('figureModel'),{onState:state=>{this.hasAI=['openai-compatible','chatgpt-plan'].includes(state.apiStyle)&&Boolean(state.model);this.controls();},onNotice:(text,error)=>this.notice(text,error),onPending:()=>this.controls()});
  }
  notice(text,error=false){$('figureStatus').textContent=text;$('figureStatus').title=text;$('figureStatus').classList.toggle('error',error);}
  async analyzeRequest(...args){const result=await this.request(...args);this.memoryWarning=result?.memoryWarning||'';return typeof result==='string'?result:result.translation;}
  controls(){
    const locked=this.busy||Boolean(this.importing)||Boolean(this.externalBusy)||Boolean(this.modelPicker?.pending);
    $('figureWorkflow').hidden=!this.context;
    $('extractFigures').disabled=!this.context||locked;
    $('cropFigure').disabled=!this.context?.canvas||locked;
    $('capturePage').disabled=!this.context?.canvas||locked;
    this.picker?.update([...this.candidates.values(),...this.items],{locked,textBusy:this.textBusy});
    $('analyzeFigures').disabled=!this.picker?.selected.size||!this.hasAI||locked||this.textBusy;
    if(this.transcribeSelected)this.transcribeSelected.disabled=$('analyzeFigures').disabled;
    $('stopFigures').hidden=!this.busy;this.modelPicker?.setLocked(locked||this.textBusy);
    this.importButton.disabled=!this.context||locked;this.imageFile.disabled=this.importButton.disabled;
    for(const item of this.items){item.checkbox.checked=this.picker?.selected.has(item.key)||false;item.button.disabled=item.tableButton.disabled=!this.hasAI||locked||this.textBusy;item.checkbox.disabled=locked;item.ask.disabled=locked;item.remove.disabled=locked;for(const button of item.codeButtons||[])button.disabled=!item.result||(!this.hasAI&&!(item.reproductionSpec&&figureSpec.templateReady(item.reproductionSpec)))||locked||this.textBusy;}
    for(const item of this.items)if(item.analysisHint)item.analysisHint.hidden=Boolean(item.output.textContent);
    this.inspector?.sync();
    this.research?.controls(locked,this.hasAI,this.textBusy);
    const selected=this.selectedItems(),pending=(this.picker?.selected.size||0)-selected.length;
    if(this.selectAllForQuestion){this.overviewAskAll.disabled=this.selectAllForQuestion.disabled=locked||this.textBusy||![...this.picker.records.values()].some(r=>this.picker.selectable(r));this.questionSelection.textContent=pending?`已选 ${this.picker.selected.size} 项 · ${selected.length} 张原图可用，${pending} 项未载入或失败，将跳过；正文问答可继续。`:selected.length?`已纳入 ${selected.length} 张图表${this.needsFigureEvidence(selected)?` · 先逐张读取，再汇总回答（${selected.length+1} 次 AI 请求）`:' · 发送时结合原图'}。`:'尚未选图；正文和已提取的文字表格仍参与问答。';this.questionFigures.querySelector('summary').textContent=`参与问答的图表 · ${selected.length} 张可用${pending?` · ${pending} 项将跳过`:''}`;this.research.$('askPaperTextOnly')?.toggleAttribute('disabled',locked);}
    $('figureCount').textContent=String(this.items.length);
    this.onBusy?.(locked);
    this.onChange?.();
  }
  finishStream(){this.outputRenderer?.flush();this.outputRenderer=null;}
  invalidate(){this.generation++;this.finishStream();this.busy=false;this.importing=null;this.research?.finish();this.cropLayer?.remove();this.cropLayer=null;this.controls();}
  reset(){this.inspector?.close();this.invalidate();this.research?.clear();this.items=[];this.candidates.clear();this.extractedTables.clear();this.documentTables.replaceChildren();this.documentTables.hidden=true;this.picker?.reset();this.workbench?.reset();this.context=null;$('figureCards').replaceChildren();this.controls();this.notice('本地提取不调用 API；按需识别或分析才发送图片与相关文字。');}
  selectedItems(){const loaded=new Map(this.items.map(item=>[item.key,item]));return [...(this.picker?.records.keys()||[])].filter(key=>this.picker.selected.has(key)&&loaded.has(key)).map(key=>loaded.get(key));}
  snapshot(){return {items:this.items.map(i=>Object.fromEntries(['data','key','label','caption','source','supplement','paperText','result','partial','codeResults','reproductionSpec','reproductionEvidence','view'].map(k=>[k,i[k]??(['result','partial','reproductionEvidence'].includes(k)?'':undefined)]))),keys:[...this.picker.records.keys()],selected:[...this.picker.selected],errors:[...this.candidates.values()].filter(i=>i.error).map(i=>({key:i.key,error:i.error})),search:this.picker.$('figureSearch').value,groupOffset:this.picker.groupOffset,view:this.workbench.active,expanded:Boolean(this.workbench.expanded),inspector:this.inspector.item?.key,research:this.research.snapshot()};}
  async restore(state){
    if(!state||state.version!==1)return;
    for(const item of [...this.items])if(!state.keys.includes(item.key))this.removeItem(item);
    for(const [key,item]of this.candidates)if(!state.keys.includes(key)){item.card?.remove();this.candidates.delete(key);}
    for(const saved of state.items){
      let item=this.items.find(i=>i.key===saved.key);if(!item){this.add(saved.data,saved.label,saved.key,saved.caption,saved.source,{supplement:saved.supplement,paperText:saved.paperText});item=this.items.find(i=>i.key===saved.key);}
      if(!item)continue;
      Object.assign(item,{result:saved.result||'',partial:saved.partial||'',codeResults:saved.codeResults||{},reproductionSpec:saved.reproductionSpec,reproductionEvidence:saved.reproductionEvidence||''});
      renderResearch(item.output,item.result||item.partial);item.export.disabled=!item.result&&!item.partial;
      for(const [language,info]of Object.entries(item.codeResults))if(['python','r'].includes(language)){const panel=document.createElement('section');this.renderCode(item,language,panel,info);item.codeMounts.get(language).replaceChildren(panel);item.codePanels.set(language,panel);}
      item.setView(saved.view||'analysis');const candidate=this.candidates.get(item.key);if(candidate){candidate.loaded=true;candidate.card.remove();}
    }
    for(const saved of state.errors||[]){const candidate=this.candidates.get(saved.key);if(candidate&&!candidate.loaded){candidate.error=saved.error;candidate.message.textContent=candidate.caption+'\n'+saved.error;}}
    this.picker.selected=new Set(state.selected.filter(key=>state.keys.includes(key)));this.picker.$('figureSearch').value=state.search||'';this.picker.groupOffset=state.groupOffset||0;
    await this.research.ready;this.research.restore(state.research);this.controls();this.workbench.show(state.view||'analysis',{open:false});
    if(state.expanded)this.workbench.setExpanded(true);
    const inspector=this.items.find(i=>i.key===state.inspector);if(inspector)this.inspector.open(inspector,{view:inspector.view});
  }
  unavailableItems(){return [...(this.picker?.records.values()||[])].filter(item=>this.picker.selected.has(item.key)&&!this.items.some(loaded=>loaded.key===item.key)).map(item=>({label:item.label,caption:item.caption||'',reason:item.error?'原图载入失败':'原图尚未载入'}));}
  questionNotice(){const missing=this.unavailableItems();return missing.length?`本次跳过 ${missing.length} 项未载入或失败的图片（${missing.map(item=>item.label).join('、')}）；正文与 ${this.selectedItems().length} 张可用原图仍可问答。可在总览重试原图。`:'';}
  selectionError(){
    const selected=this.selectedItems(),pending=(this.picker?.selected.size||0)-selected.length;
    if(pending)return `所选图表中有 ${pending} 项尚未载入，请先点击“载入所选原图”或取消这些选择。`;
    return '';
  }
  askSelected(){
    const missing=this.questionNotice();if(missing)this.research.notice(missing);
    this.inspector.close();this.workbench.show('analysis');
    this.research.container.open=true;const question=this.research.$('researchQuestion');if(!question.value.trim())question.value='结合所选图表与正文，逐图解释证据、统计结果、与作者结论的关系及局限。';question.focus();question.scrollIntoView({behavior:'smooth',block:'center'});
  }
  prepareAllFigures(){
    if(this.busy||this.importing||this.externalBusy||this.textBusy)return;
    this.picker.selected=new Set([...this.picker.records.values()].filter(r=>this.picker.selectable(r)).map(r=>r.key));this.picker.changed();this.workbench.show('analysis');
    const context=this.context,generation=this.generation;
    const keys=[...this.picker.selected].filter(key=>!this.items.some(item=>item.key===key));
    // Keep original-image permission requests in the direct user-click call chain.
    const loading=keys.length?this.loadCandidates?.(keys):undefined;
    Promise.resolve(loading).then(()=>{if(context!==this.context||generation!==this.generation)return;this.controls();this.research.notice(this.questionNotice()||`已纳入 ${this.selectedItems().length} 张图表。填写问题后点击发送，才会调用 AI。`);}).catch(error=>{if(context===this.context&&generation===this.generation)this.research.notice(error.message,true);});
    this.research.$('researchQuestion').focus({preventScroll:true});
  }
  needsFigureEvidence(items){return items.length>4||items.reduce((sum,i)=>sum+i.data.length,0)>12*1024*1024;}
  analyzeSelected(){const error=this.selectionError();if(error){this.notice(error,true);return;}return this.analyzeAll(this.selectedItems());}
  setContext(context){
    this.cropLayer?.remove();this.cropLayer=null;if(this.context!==context)this.importing=null;this.context=context;
    this.renderTables();this.controls();
  }
  collectTables(tables,source){
    for(const [index,table]of (tables||[]).entries())this.extractedTables.set(`${source?.page}-${index}`,{...table,caption:`第 ${source?.page} 页 · ${table.caption||'表 '+(index+1)}`});
    this.renderTables();
  }
  renderTables(){
    const context=this.context;
    this.documentTables.replaceChildren();
    const tables=this.extractedTables.size?[...this.extractedTables.values()]:context?.tables?[...context.tables]:Array.from(context?.element?.querySelectorAll('table')||[]).filter(table=>!table.parentElement?.closest('table')).map(elementTable);
    if(!tables.length&&context?.page&&!context.canvas)tables.push(...markdownTables(context.text));
    this.documentTables.hidden=!tables.length;
    if(tables.length){const summary=document.createElement('summary');summary.textContent=`可复制文字表格 · ${tables.length} 张`;this.documentTables.append(summary);
      const hint=document.createElement('p');hint.className='research-hint';hint.textContent='本地提取，可复制为 Markdown 或 TSV。PDF 按文字坐标重建，数字、换行及合并单元格请对照原页核查；图片表格可用 AI 转写。';this.documentTables.append(hint);
      for(const [index,table]of tables.entries()){
        const card=document.createElement('details');card.className='paper-table-card';card.open=tables.length===1;
        const label=table.caption||`表 ${index+1}`,heading=document.createElement('summary');heading.textContent=label+(table.truncated?' · 已截断':'');
        const preview=document.createElement('div');preview.className='paper-table-preview';renderResearch(preview,table.markdown,{tableGrid:table.raw?table.grid:undefined,tableCaption:label,tableNotes:table.notes,truncated:table.truncated});card.append(heading,preview);this.documentTables.append(card);
      }
    }
  }
  clearCodePanels(item){item.codePanels.clear();for(const mount of item.codeMounts.values())mount.replaceChildren();}
  clearResults(){this.invalidate();this.research?.clear();for(const item of this.items){item.result='';item.partial='';item.output.textContent='';item.export.disabled=true;item.codeResults={};item.reproductionSpec=null;item.reproductionEvidence='';this.clearCodePanels(item);if(item.verification)item.verification.textContent=SUPPLEMENT_NOTICE;}this.controls();void this.modelPicker?.refresh();}
  async importImages(files){
    if(!files.length||!this.context)return;
    if(this.busy||this.importing||this.externalBusy){this.notice('请等待当前图表任务完成，或停止后再导入截图。',true);return;}
    if(files.length>MAX_FIGURES){this.notice('一次最多导入 40 张截图，请分批选择。',true);return;}
    const context=this.context,token={};this.importing=token;this.controls();let added=0,duplicates=0;const errors=[];
    try{
      for(const file of files){
        let bitmap;
        try{
          if(!/^image\/(png|jpeg|webp)$/.test(file.type))throw new Error('仅支持 PNG、JPEG、WebP 位图');
          if(file.size>10*1024*1024)throw new Error('文件超过 10 MB，请裁剪后重试');
          bitmap=await createImageBitmap(file);
          if(bitmap.width*bitmap.height>32000000)throw new Error('图片超过 3200 万像素，请裁剪后重试');
          const data=imageData(bitmap),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data))),n=>n.toString(16).padStart(2,'0')).join('');
          if(this.importing!==token||this.context!==context)return;
          const key='import-'+JSON.stringify(context.source||{})+'-'+hash;
          if(this.add(data,`导入截图 · ${file.name||'粘贴图片'}`,key,'用户补充的截图：请核对所属论文、页码及图表是否完整。',context.source))added++;else duplicates++;
        }catch(error){errors.push((file.name||'截图')+'：'+error.message);}finally{bitmap?.close();}
        if(this.importing!==token||this.context!==context)return;
      }
      this.workbench.show('gallery');this.notice(`已载入 ${added} 张截图${duplicates?`，跳过 ${duplicates} 张重复图片`:''}。可在图表总览中批量选择、解读或结合正文提问。`+(errors.length?' '+errors.slice(0,2).join('；')+(errors.length>2?`；另有 ${errors.length-2} 张未载入`:''):''),errors.length>0);
    }finally{if(this.importing===token){this.importing=null;this.controls();}}
  }
  add(data,label,key,caption='',source=this.context?.source,{supplement=false,paperText=this.context?.text||'',pdfRegion,verification}={}){
    if(pdfRegion&&this.items.some(item=>item.pdfRegion&&String(item.source?.page)===String(source?.page)&&pdfRegionMatch(item.pdfRegion,pdfRegion)))return false;
    if(this.items.some(item=>item.key===key))return false;
    if(this.items.length>=MAX_FIGURES||this.items.reduce((sum,i)=>sum+i.data.length,0)+data.length>MAX_BYTES)throw new Error('最多载入 40 张图或 32 MB 图片，请先移除部分图片；尚未载入的来源仍保留。');
    if(data.length>4*1024*1024)throw new Error('图片过大，请缩小框选范围。');
    const item={data,label,key,caption,source,supplement,pdfRegion,paperText:paperText.slice(0,8000),result:'',codeResults:{},codePanels:new Map()};this.items.push(item);
    const card=document.createElement('article');card.className='figure-card';card.dataset.key=key;card.tabIndex=-1;item.card=card;
    const img=document.createElement('img');img.src=data;img.alt=label;card.append(img);
    const body=document.createElement('div');item.detailBody=body;body.className='figure-detail-body';
    const toolbar=document.createElement('div');toolbar.className='figure-detail-toolbar';body.append(toolbar);
    if(caption){const metadata=document.createElement('details'),summary=document.createElement('summary'),note=document.createElement('p');metadata.className='figure-detail-caption';summary.textContent='查看图注';note.className='figure-caption';note.textContent=caption;metadata.append(summary,note);body.append(metadata);}
    if(supplement){item.verification=document.createElement('p');item.verification.className='figure-verification';item.verification.textContent=SUPPLEMENT_NOTICE;body.append(item.verification);}
    if(verification){const note=document.createElement('p');note.className='figure-verification';note.textContent=verification;body.append(note);}
    const choice=document.createElement('label');choice.className='figure-choice';item.checkbox=document.createElement('input');item.checkbox.type='checkbox';item.checkbox.onchange=()=>this.picker.select(key,item.checkbox.checked);choice.append(item.checkbox,document.createTextNode('选中此图'));toolbar.append(choice);
    const actions=document.createElement('div');actions.className='figure-actions';
    const analyze=document.createElement('button');analyze.textContent=supplement?'用 AI 补读图表':'翻译图文并解释';analyze.onclick=()=>this.analyzeAll([item]);item.button=analyze;
    item.tableButton=document.createElement('button');item.tableButton.textContent='提取可复制表格';item.tableButton.title='用 AI 将图片中的表格转写为可复制文本';item.tableButton.onclick=()=>this.analyzeAll([item],{tablesOnly:true});
    const download=document.createElement('a');download.textContent='下载图片';download.href=data;download.download=`QudadFlow-figure-${this.items.length}.jpg`;
    const remove=document.createElement('button');item.remove=remove;remove.textContent='移除';remove.onclick=()=>{if(this.busy||this.importing||this.externalBusy)return;this.removeItem(item);};
    item.ask=document.createElement('button');item.ask.textContent='结合此图提问';item.ask.onclick=()=>{this.picker.select(key,true);this.askSelected();};
    item.export=document.createElement('button');item.export.textContent='导出图表解读';item.export.disabled=true;item.export.onclick=()=>downloadText('QudadFlow-figure-analysis.md','# '+item.label+'\n\n'+item.caption+'\n\n'+(item.supplement?'AI 补读（待核对；仅含提供的截图）\n\n':'')+(item.result||'（未完成）\n\n'+item.partial),'text/markdown;charset=utf-8');
    actions.append(analyze,item.tableButton,item.ask);
    const more=document.createElement('details'),moreLabel=document.createElement('summary'),moreActions=document.createElement('div');more.className='figure-detail-more';moreLabel.textContent='更多操作';moreActions.append(download,item.export,remove);more.append(moreLabel,moreActions);toolbar.append(more);
    const tabs=document.createElement('div');tabs.className='figure-detail-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','解析与复刻代码');
    item.codeOutput=document.createElement('div');item.codeOutput.className='code-output';item.codeButtons=[];item.codeMounts=new Map();item.views=new Map();item.viewButtons=new Map();
    const uid='figure-detail-'+crypto.randomUUID();
    for(const [view,label] of [['analysis','图表解读'],['python','Python'],['r','R']]){
      const tab=document.createElement('button'),panel=document.createElement('div');tab.type='button';tab.id=uid+'-tab-'+view;tab.textContent=label;tab.setAttribute('role','tab');tab.setAttribute('aria-controls',uid+'-'+view);panel.id=uid+'-'+view;panel.className='figure-detail-view';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tab.id);panel.tabIndex=0;
      tab.onclick=()=>item.setView(view);tab.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const names=[...item.views.keys()],at=names.indexOf(view),next=event.key==='Home'?names[0]:event.key==='End'?names.at(-1):names[(at+(event.key==='ArrowRight'?1:-1)+names.length)%names.length];item.setView(next);item.viewButtons.get(next).focus();};
      tabs.append(tab);item.views.set(view,panel);item.viewButtons.set(view,tab);
      if(view==='analysis'){
        item.analysisHint=document.createElement('p');item.analysisHint.className='figure-detail-empty';item.analysisHint.textContent='点击“'+analyze.textContent+'”开始解读。解析、表格转写和代码都保存在这张图中。';
        item.output=document.createElement('div');item.output.className='figure-output';panel.append(actions,item.analysisHint,item.output);
      }else{
        const button=document.createElement('button'),hint=document.createElement('p'),mount=document.createElement('div');button.textContent=view==='r'?'生成 R':'生成 Python';button.disabled=true;button.onclick=()=>this.reproduce(item,view);item.codeButtons.push(button);hint.className='research-hint';hint.textContent='复刻形式、风格、图例与标注。通用图形可用演示数据直接试跑，再导入图片对照修订。';panel.append(button,hint,mount);item.codeMounts.set(view,mount);item.codeOutput.append(panel);
      }
    }
    item.setView=view=>{if(!item.views.has(view))return;item.view=view;for(const [key,panel]of item.views){panel.hidden=key!==view;const tab=item.viewButtons.get(key);tab.setAttribute('aria-selected',String(key===view));tab.tabIndex=key===view?0:-1;}item.codeOutput.hidden=view==='analysis';};
    item.setView('analysis');body.append(tabs,item.views.get('analysis'),item.codeOutput);card.append(body);$('figureCards').append(card);this.controls();return true;
  }
  removeItem(item){this.items=this.items.filter(i=>i!==item);this.candidates.delete(item.key);this.picker.selected.delete(item.key);item.card.remove();this.controls();}
  extract(context=this.context,{silent=false}={}){
    try{
      if(!context)return 0;let count=0;
      if(context.canvas&&context.regions){
        for(const region of context.regions){
          const key=region.identity?`pdf-${context.page}-${region.identity}`:`pdf-${context.page}-${region.label}-${[region.x,region.y,region.width,region.height].map(Math.round).join('-')}`;
          count+=Number(this.add(imageData(context.canvas,region.rect),`第 ${context.page} 页 · ${region.label}${region.continued?' · 续页':''}`,key,region.caption,context.source,{paperText:context.text,pdfRegion:region}));
        }
        this.collectTables(context.tables,context.source);
      }else if(context.canvas){
        const coords=context.images||[];
        for(let i=0;i<coords.length;i+=6){
          const [x1,y1,x2,y2,x3,y3]=Array.from(coords.slice(i,i+6)),x4=x2+x3-x1,y4=y2+y3-y1;
          const x=Math.max(0,Math.min(x1,x2,x3,x4)),y=Math.max(0,Math.min(y1,y2,y3,y4));
          const width=Math.min(1,Math.max(x1,x2,x3,x4))-x,height=Math.min(1,Math.max(y1,y2,y3,y4))-y;
          if(width*context.canvas.width<24||height*context.canvas.height<24)continue;
          count+=Number(this.add(imageData(context.canvas,{x:x*context.canvas.width,y:y*context.canvas.height,width:width*context.canvas.width,height:height*context.canvas.height}),`第 ${context.page} 页 · 图片 ${i/6+1}`,`pdf-${context.page}-${i}`));
        }
      }else{
        Array.from(context.element?.querySelectorAll('img')||[]).forEach((img,i)=>{if(img.naturalWidth<24||img.naturalHeight<24)return;count+=Number(this.add(imageData(img),`第 ${context.page} 页 · 图片 ${i+1}`,`word-${context.page}-${i}`));});
      }
      if(!silent){
        $('figureWorkflow').open=true;
        if(count)this.workbench.show('gallery');
        const message=count?`已提取 ${count} 张图表，包含按图注定位的矢量区域和表格。请核对范围后分析；文字表格可直接复制。`:
          context.canvas&&context.regions?.length===0?`第 ${context.page} 页未找到可提取图表；仅检查了本页。点击“提取全文图表”扫描其他页面，也可框选补充。`:
          context.canvas&&context.regions?.length?`第 ${context.page} 页的 ${context.regions.length} 项图表已在总览中，无新增重复项。可点击“提取全文图表”扫描其他页面。`:'本页没有新的图片，或已提取。可导入截图补充。';
        this.notice(message);
      }
      return count;
    }catch(error){if(silent)throw error;this.notice(error.message,true);return 0;}
  }
  capturePage(){try{if(this.context?.canvas)this.add(imageData(this.context.canvas),`第 ${this.context.page} 页 · 整页`,`page-${this.context.page}`);$('figureWorkflow').open=true;this.notice('整页已加入。AI 仅在点击分析后运行；小文字建议框选后分析。');}catch(error){this.notice(error.message,true);}}
  crop(){
    const context=this.context;if(!context?.canvas)return;
    if(this.cropLayer){this.cropLayer.remove();this.cropLayer=null;$('figureWorkflow').open=true;this.notice('已取消框选。');return;}
    // Give the document room while selecting; the analysis panel opens again
    // once the selection ends, so its height cannot obscure the target region.
    const restoreWorkbench=this.workbench.withSource();$('figureWorkflow').open=false;
    const layer=document.createElement('div');layer.className='figure-crop-layer';layer.tabIndex=0;layer.setAttribute('aria-label','在原页拖动框选图表，Escape 取消');context.canvas.parentElement.append(layer);this.cropLayer=layer;
    const finishCrop=(restore=true)=>{layer.remove();this.cropLayer=null;$('figureWorkflow').open=true;if(restore)restoreWorkbench();};
    const selection=document.createElement('div');selection.className='figure-crop-selection';layer.append(selection);let start;
    const point=e=>{const box=layer.getBoundingClientRect();return {x:Math.max(0,Math.min(box.width,e.clientX-box.left)),y:Math.max(0,Math.min(box.height,e.clientY-box.top))};};
    layer.onpointerdown=e=>{if(e.button!==0)return;start=point(e);layer.setPointerCapture(e.pointerId);e.preventDefault();};
    layer.onpointermove=e=>{if(!start)return;const end=point(e);Object.assign(selection.style,{display:'block',left:`${Math.min(start.x,end.x)}px`,top:`${Math.min(start.y,end.y)}px`,width:`${Math.abs(start.x-end.x)}px`,height:`${Math.abs(start.y-end.y)}px`});};
    layer.onpointerup=e=>{
      if(!start)return;const end=point(e),box=layer.getBoundingClientRect(),width=Math.abs(end.x-start.x),height=Math.abs(end.y-start.y);
      try{if(width<12||height<12)throw new Error('框选区域过小，请重新框选。');const rect={x:Math.min(start.x,end.x)/box.width*context.canvas.width,y:Math.min(start.y,end.y)/box.height*context.canvas.height,width:width/box.width*context.canvas.width,height:height/box.height*context.canvas.height};this.add(imageData(context.canvas,rect),`第 ${context.page} 页 · 框选图表`,`crop-${context.page}-${Object.values(rect).map(Math.round).join('-')}`);this.notice('图表已加入，包含框选区域内的文字和矢量内容。');}catch(error){this.notice(error.message,true);}finally{finishCrop();}
    };
    layer.onpointercancel=()=>finishCrop(false);layer.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();finishCrop(false);this.notice('已取消框选。');}};layer.focus({preventScroll:true});this.notice('在左侧原页拖动框选图片或图表；再次点击框选或按 Escape 取消。');
  }
  async analyzePaper(){
    if(this.busy||this.importing||this.externalBusy||this.textBusy||!this.hasAI)return;
    this.workbench.show('analysis');
    const generation=++this.generation;this.busy=true;this.controls();
    try{
      const options=await this.research.options(),source=await this.getSource?.(this.research.$('researchScope').value==='all');
      if(generation!==this.generation)return;
      const items=this.selectedItems(),unavailableFigures=this.unavailableItems(),skipped=this.questionNotice();let figures=items.map(i=>({data:i.data,label:i.label,caption:i.caption,analysis:i.result,source:i.source}));const figureNotes=[];
      if(!source?.text?.trim()&&!figures.length)throw new Error('当前材料没有可提取文字。扫描页可提取并勾选图片后提问。');
      const conversation=this.research.history();this.research.begin(options.question,figures.map(f=>f.label),unavailableFigures.map(f=>f.label));
      if(this.needsFigureEvidence(items)){
        for(const [index,item]of items.entries()){
          this.research.notice(`读取图表 ${index+1}/${items.length}：${item.label}。完成后结合全部图表笔记与正文回答；可随时停止。`);
          const result=await this.analyzeRequest(item.data,undefined,undefined,{...options,type:'FIGURE_ANALYZE',useMemory:false,question:options.question||'提取这张图表中可见的证据、数值及局限，供论文综合问答使用。',caption:item.caption,text:item.paperText,source:item.source||source});
          if(generation!==this.generation)return;
          item.result=result;item.partial='';item.export.disabled=false;item.codeResults={};item.reproductionSpec=null;item.reproductionEvidence='';this.clearCodePanels(item);renderResearch(item.output,result);figureNotes.push({label:item.label,caption:item.caption,source:item.source||source,analysis:result});this.controls();
        }
        figures=[];
      }
      this.research.notice('正在分析 '+(source?.text?.length||0)+' 字和 '+figures.length+' 张原图'+(source?.truncated?'（文字达到上限，非完整论文）':'')+'；接口报错会直接显示，可随时停止。');
      if(figureNotes.length)this.research.notice(`正在综合 ${figureNotes.length} 张图表的 AI 笔记与 ${source?.text?.length||0} 字正文；本次汇总不重发原图，笔记需对照原图核查。`);
      const result=await this.analyzeRequest(undefined,undefined,text=>{if(generation===this.generation)this.research.output(text);},{...options,type:'RESEARCH_ANALYZE',text:source?.text||'',source,figures,figureNotes,unavailableFigures,conversation});
      if(generation!==this.generation)return;this.research.output(result,true);this.research.notice('分析完成。'+(skipped?skipped+' ':'')+(this.memoryWarning||'结论请对照原文；可导出 Markdown。'),Boolean(this.memoryWarning));
    }catch(error){if(generation===this.generation)this.research.notice(error.message,true);}
    finally{if(generation===this.generation){this.research.finish();this.busy=false;this.controls();}}
  }
  async reproduce(item,language,{reviewImage}={}){
    if(this.busy||this.importing||this.externalBusy||this.textBusy||!item.result)return;
    this.inspector.open(item,{view:language});
    const generation=++this.generation;this.busy=true;this.controls();
    const previous=item.codePanels.get(language);if(previous)previous.hidden=true;let completed=false;
    const panel=document.createElement('section'),title=document.createElement('strong'),output=document.createElement('div');title.textContent=language==='r'?'R 复现草稿':'Python 复现草稿';output.className='figure-output';panel.append(title,output);item.codeMounts.get(language).append(panel);
    const renderer=createResearchRenderer(output);this.outputRenderer=renderer;
    try{
      const options=await this.research.options(),source=item.source||await this.getSource?.(false);if(generation!==this.generation)return;
      const cached=item.reproductionSpec&&figureSpec.templateReady(item.reproductionSpec)&&!reviewImage;
      this.notice(cached?'正在使用同一规格生成 '+(language==='r'?'R':'Python')+' 代码…':reviewImage?'正在对照原图与试运行图修订规格…':'正在生成 '+(language==='r'?'R':'Python')+' 复现草稿…');
      const result=cached?item.reproductionEvidence:await this.analyzeRequest(item.data,undefined,text=>{if(generation===this.generation)renderer.update(text);},{...options,type:'FIGURE_CODE',language,figureAnalysis:item.result,caption:item.caption,text:item.paperText,source,...(reviewImage?{renderedImage:reviewImage,reproductionSpec:item.reproductionSpec}:{})});
      if(generation!==this.generation)return;
      const spec=cached?item.reproductionSpec:figureSpec.parseResponse(result);
      if(reviewImage){if(!spec)throw new Error('修订结果缺少有效图形规格，原规格保留。');figureSpec.checkRevision(item.reproductionSpec,spec);}
      const compiled=spec&&figureSpec.templateReady(spec),code=compiled?figureCode(spec,language):codeBlock(result,language);
      if(!code)throw new Error('AI 未返回指定语言的代码块，请重试；现有结果保留。');
      if(spec&&!cached){
        item.reproductionSpec=spec;item.reproductionEvidence=result;item.codeResults={};
        for(const [other,old]of item.codePanels)if(other!==language){old.remove();item.codePanels.delete(other);}
      }
      const recognition=String(result).replace(/```(?:python|py|r)\s*\n[\s\S]*?```/gi,'');
      const instructions=compiled?figureNotes(spec,language)+'\n\n模型识别记录（待核对）：\n\n'+recognition:recognition;
      const explanation=instructions+'\n\n```'+language+'\n'+code+'\n```';
      renderer.flush();this.outputRenderer=null;output.remove();item.codeResults[language]={code,result:explanation,spec,compiled};
      this.renderCode(item,language,panel,item.codeResults[language]);
      previous?.remove();item.codePanels.set(language,panel);completed=true;
      this.notice('复现草稿已生成，尚未执行。'+(compiled?'Python/R 共用规格；可用 --style-demo 试跑，核对形式、风格、图例与标注。':spec?'特殊结构使用 AI 自定义代码，请核对依赖和视觉效果。':'模型未返回图形规格，已保留 AI 代码；尚未校验数据与样式。')+(cached?'':this.memoryWarning||''),!spec||Boolean(!cached&&this.memoryWarning));
    }catch(error){if(generation===this.generation)this.notice(error.message,true);}
    finally{if(!completed&&previous?.isConnected){panel.remove();previous.hidden=false;}if(generation===this.generation){this.finishStream();this.busy=false;this.controls();}}
  }
  renderCode(item,language,panel,{code,result:explanation,spec,compiled}){
    const instructions=explanation.replace(/```(?:python|py|r)\s*\n[\s\S]*?```/gi,'');
      if(compiled){const start=document.createElement('div'),label=document.createElement('p'),command=document.createElement('code');start.className='figure-code-start';label.textContent='下载后用演示数据试跑，先看布局、字体、配色与图例：';command.textContent=(language==='r'?'Rscript QudadFlow-figure.R':'python QudadFlow-figure.py')+' --style-demo';start.append(label,command);panel.append(start);}
      panel.append(figureCodeView({code,language,onDownload:()=>downloadText('QudadFlow-figure.'+(language==='r'?'R':'py'),code)}));
      const material=document.createElement('details'),materialTitle=document.createElement('summary'),materialBody=document.createElement('div');material.className='figure-code-material';materialTitle.textContent='运行说明、图形规格与数据模板';material.append(materialTitle,materialBody);
      const notes=document.createElement('button');notes.textContent='下载代码与说明';notes.onclick=()=>downloadText('QudadFlow-reproduction-'+language+'.md',explanation,'text/markdown;charset=utf-8');materialBody.append(notes);
      if(spec){
        const specification=document.createElement('button');specification.textContent='下载图形规格';specification.onclick=()=>downloadText('figure-spec.json',JSON.stringify(spec,null,2),'application/json;charset=utf-8');materialBody.append(specification);
        const data=document.createElement('button');data.textContent='下载空数据模板';data.onclick=()=>downloadText(spec.data.file,figureSpec.csvHeader(spec),'text/csv;charset=utf-8');materialBody.append(data);
        const hint=document.createElement('p');hint.className='research-hint';hint.textContent='两种语言共用图形规格。先核对形式、风格、图例和标注；需要时再填入自己的 CSV。'+(compiled?'':'此图含特殊结构，使用 AI 自定义代码；尚未进行模板数据校验。');materialBody.append(hint);
        const review=document.createElement('div'),reviewTitle=document.createElement('strong');review.className='figure-render-review';reviewTitle.textContent='原图对照 · 只修订视觉差异';review.append(reviewTitle);
        const file=document.createElement('input');file.type='file';file.accept='image/png,image/jpeg,image/webp';file.hidden=true;
        const upload=document.createElement('button');upload.textContent='导入试运行图';upload.onclick=()=>file.click();
        const compare=document.createElement('button');compare.textContent='对照原图修订';compare.disabled=true;
        const preview=document.createElement('img');preview.hidden=true;preview.alt='用户本地执行后导入的试运行图，尚未核对';preview.style.maxWidth='100%';
        let rendered;
        file.onchange=async()=>{const selected=file.files?.[0];file.value='';if(!selected)return;let bitmap;try{if(!/^image\/(png|jpeg|webp)$/.test(selected.type)||selected.size>10*1024*1024)throw new Error('请选择 10 MB 以内的 PNG / JPEG / WebP。');bitmap=await createImageBitmap(selected);if(bitmap.width*bitmap.height>32000000)throw new Error('试运行图片超过 3200 万像素，请缩小后重试。');rendered=imageData(bitmap);preview.src=rendered;preview.hidden=false;compare.disabled=!this.hasAI;this.notice('试运行图已在本地载入。点击“对照原图修订”才会向所选 AI 发送原图和试运行图。');}catch(error){this.notice(error.message,true);}finally{bitmap?.close();}};
        compare.onclick=()=>{if(rendered)void this.reproduce(item,language,{reviewImage:rendered});};review.append(upload,file,compare,preview);panel.append(review);
      }
      const details=document.createElement('div');details.className='figure-output';renderResearch(details,instructions);materialBody.append(details);panel.append(material);
  }
  async analyzeAll(items=this.items.filter(item=>!item.result),{tablesOnly=false}={}){
    if(this.busy||this.importing||this.externalBusy||this.textBusy||!this.hasAI||!items.length)return;
    if(items.length===1)this.inspector.open(items[0],{view:'analysis'});else this.workbench.show('gallery');
    const generation=++this.generation;this.busy=true;this.controls();let memoryWarning='';
    try{
      for(const [index,item] of items.entries()){
        this.notice(`正在${tablesOnly?'转写表格':'分析'} ${index+1}/${items.length}：${item.label}。可随时停止，已有结果保留。`);item.output.textContent=tablesOnly?'正在提取表格的行列与单元格…':'正在识别图中文字…';if(item.analysisHint)item.analysisHint.hidden=true;if(item.verification)item.verification.textContent='AI 补读 · 待核对。仅识别已提供的截图，不代表已扫描全文。';item.result='';item.partial='';item.export.disabled=true;item.codeResults={};item.reproductionSpec=null;item.reproductionEvidence='';this.clearCodePanels(item);
        const renderer=createResearchRenderer(item.output);this.outputRenderer=renderer;
        const options=await this.research.options(),source=item.source||await this.getSource?.(false);
        if(generation!==this.generation)return;
        const result=await this.analyzeRequest(item.data,undefined,text=>{if(generation===this.generation){item.partial=text;item.export.disabled=!text;renderer.update(text);}},{...options,extractTable:tablesOnly,source,text:item.paperText,caption:item.caption});
        memoryWarning=this.memoryWarning||memoryWarning;
        if(generation!==this.generation)return;item.result=result;item.export.disabled=false;renderer.update(result,true);this.outputRenderer=null;this.controls();
      }
      const tableCount=items.reduce((sum,item)=>sum+markdownTables(item.result).length,0);
      this.notice((tablesOnly?(tableCount?`已转写 ${tableCount} 张可复制表格。请使用结果下方的 Markdown / TSV 按钮；数字和单位需与原图核对。`:'本次结果未返回可复制表格。请查看识别说明，尝试更清晰的原图或重新框选。'):'图文翻译与图表解释已完成。表格结果可复制为 Markdown / TSV；AI 可能误读文字和数值，请与原图核对。')+memoryWarning,Boolean(memoryWarning)||tablesOnly&&!tableCount);
    }catch(error){if(generation===this.generation){for(const item of items)if(!item.result&&!item.partial)item.output.textContent='未完成分析，可重试。';this.notice(error.message+' 已收到的部分结果保留，可导出后重试。',true);}}
    finally{if(generation===this.generation){this.finishStream();this.busy=false;this.controls();}}
  }
}
