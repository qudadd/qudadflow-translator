import {ResearchControls,downloadText,codeBlock} from './research-ui.mjs';
const $=id=>document.getElementById(id);
const MAX_FIGURES=20, MAX_BYTES=24*1024*1024;
function imageData(source,rect) {
  const width=rect?.width||source.naturalWidth||source.width,height=rect?.height||source.naturalHeight||source.height;
  const scale=Math.min(1,1600/Math.max(width,height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
  if(rect)ctx.drawImage(source,rect.x,rect.y,width,height,0,0,canvas.width,canvas.height);else ctx.drawImage(source,0,0,canvas.width,canvas.height);
  return canvas.toDataURL('image/jpeg',.92);
}
export class FigureWorkflow {
  constructor({request,cancel,onBusy,getSource}) {
    Object.assign(this,{request,cancel,onBusy,getSource});this.items=[];this.generation=0;this.busy=false;
    $('extractFigures').onclick=()=>this.extract();$('cropFigure').onclick=()=>this.crop();
    $('capturePage').onclick=()=>this.capturePage();$('analyzeFigures').onclick=()=>this.analyzeAll();
    $('stopFigures').onclick=()=>{this.invalidate();this.cancel();this.notice('已停止图表分析，完成的结果保留。');};
    $('figureProfile').onchange=()=>{this.cancel();this.clearResults();};
    this.research=new ResearchControls($('figureWorkflow').querySelector('.figure-body'),{analyze:()=>this.analyzePaper(),stop:()=>{this.invalidate();this.cancel();this.research.notice('分析已停止。');}});
    this.refreshProfiles();
  }
  notice(text,error=false){$('figureStatus').textContent=text;$('figureStatus').classList.toggle('error',error);}
  async analyzeRequest(...args){const result=await this.request(...args);this.memoryWarning=result?.memoryWarning||'';return typeof result==='string'?result:result.translation;}
  async refreshProfiles(){
    try {
      const result=await chrome.runtime.sendMessage({type:'FIGURE_PROFILES'}),select=$('figureProfile'),previous=select.value;select.replaceChildren();
      if(result?.current?.apiStyle==='openai-compatible')select.add(new Option(`当前配置 · ${result.current.model||'未设置模型'}`,''));
      for(const profile of result?.profiles||[])select.add(new Option(`${profile.name} · ${profile.model||'未设置模型'}`,profile.id));
      if(Array.from(select.options).some(o=>o.value===previous))select.value=previous;
      this.hasAI=select.options.length>0;
      if(!this.hasAI)select.add(new Option('请在 API 设置保存支持图片的 AI 配置',''));
      this.controls();
    }catch{this.hasAI=false;this.controls();}
  }
  controls(){
    $('figureWorkflow').hidden=!this.context;
    $('extractFigures').disabled=!this.context||this.busy;
    $('cropFigure').disabled=!this.context?.canvas||this.busy;
    $('capturePage').disabled=!this.context?.canvas||this.busy;
    $('analyzeFigures').disabled=!this.items.length||!this.hasAI||this.busy||this.textBusy;
    $('stopFigures').hidden=!this.busy;$('figureProfile').disabled=this.busy;
    for(const item of this.items){item.button.disabled=!this.hasAI||this.busy||this.textBusy;for(const button of item.codeButtons||[])button.disabled=!item.result||!this.hasAI||this.busy||this.textBusy;}
    this.research?.controls(this.busy,this.hasAI,this.textBusy);
    $('figureCount').textContent=String(this.items.length);
    this.onBusy?.(this.busy);
  }
  invalidate(){this.generation++;this.busy=false;this.cropLayer?.remove();this.cropLayer=null;this.controls();}
  reset(){this.invalidate();this.research?.clear();this.items=[];this.context=null;$('figureCards').replaceChildren();this.controls();this.notice('本地提取不调用 API；分析时向所选 AI 发送图片、相关文字与来源；开启记忆时附加相关记录。');}
  setContext(context){this.cropLayer?.remove();this.cropLayer=null;this.context=context;this.controls();}
  clearResults(){this.invalidate();this.research?.clear();for(const item of this.items){item.result='';item.output.textContent='';item.codeResults={};item.codePanels?.clear();item.codeOutput?.replaceChildren();}this.refreshProfiles();}
  add(data,label,key,caption='',source=this.context?.source){
    if(this.items.some(item=>item.key===key))return false;
    if(this.items.length>=MAX_FIGURES||this.items.reduce((sum,i)=>sum+i.data.length,0)+data.length>MAX_BYTES)throw new Error('最多保留 20 张图或 24 MB 图片，请先移除部分图片。');
    if(data.length>4*1024*1024)throw new Error('图片过大，请缩小框选范围。');
    const item={data,label,key,caption,source,paperText:(this.context?.text||'').slice(0,8000),result:'',codeResults:{},codePanels:new Map()};this.items.push(item);
    const card=document.createElement('article');card.className='figure-card';
    const img=document.createElement('img');img.src=data;img.alt=label;card.append(img);
    const body=document.createElement('div'),title=document.createElement('strong');title.textContent=label;body.append(title);if(caption){const note=document.createElement('p');note.className='figure-caption';note.textContent=caption;body.append(note);}
    const actions=document.createElement('div');actions.className='figure-actions';
    const analyze=document.createElement('button');analyze.textContent='翻译图文并解释';analyze.onclick=()=>this.analyzeAll([item]);item.button=analyze;
    const download=document.createElement('a');download.textContent='下载图片';download.href=data;download.download=`QudadFlow-figure-${this.items.length}.jpg`;
    const remove=document.createElement('button');remove.textContent='移除';remove.onclick=()=>{if(this.busy)return;this.items=this.items.filter(i=>i!==item);card.remove();this.controls();};
    actions.append(analyze,download,remove);body.append(actions);
    const codeActions=document.createElement('div');codeActions.className='figure-actions';item.codeButtons=[];
    for(const [language,label] of [['python','生成 Python'],['r','生成 R']]){const button=document.createElement('button');button.textContent=label;button.disabled=true;button.onclick=()=>this.reproduce(item,language);item.codeButtons.push(button);codeActions.append(button);}
    const hint=document.createElement('small');hint.className='research-hint';hint.textContent='先识别图表，再生成复现草稿；需核对数据。';body.append(codeActions,hint);
    item.codeOutput=document.createElement('div');item.codeOutput.className='code-output';body.append(item.codeOutput);item.output=document.createElement('pre');item.output.className='figure-output';item.output.setAttribute('aria-live','polite');body.append(item.output);card.append(body);$('figureCards').append(card);this.controls();return true;
  }
  extract(){
    try{
      const context=this.context;if(!context)return;let count=0;
      if(context.canvas){
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
      $('figureWorkflow').open=true;this.notice(count?`已提取 ${count} 张图片。请核对图片，再点击“翻译图文并解释”。`:'此页没有新的可提取位图。PDF 的矢量图表可使用“框选图表”或“提取整页”。');
    }catch(error){this.notice(error.message,true);}
  }
  capturePage(){try{if(this.context?.canvas)this.add(imageData(this.context.canvas),`第 ${this.context.page} 页 · 整页`,`page-${this.context.page}`);$('figureWorkflow').open=true;this.notice('整页已加入。AI 仅在点击分析后运行；小文字建议框选后分析。');}catch(error){this.notice(error.message,true);}}
  crop(){
    const context=this.context;if(!context?.canvas)return;
    if(this.cropLayer){this.cropLayer.remove();this.cropLayer=null;this.notice('已取消框选。');return;}
    const layer=document.createElement('div');layer.className='figure-crop-layer';layer.tabIndex=0;layer.setAttribute('aria-label','在原页拖动框选图表，Escape 取消');context.canvas.parentElement.append(layer);this.cropLayer=layer;
    const selection=document.createElement('div');selection.className='figure-crop-selection';layer.append(selection);let start;
    const point=e=>{const box=layer.getBoundingClientRect();return {x:Math.max(0,Math.min(box.width,e.clientX-box.left)),y:Math.max(0,Math.min(box.height,e.clientY-box.top))};};
    layer.onpointerdown=e=>{if(e.button!==0)return;start=point(e);layer.setPointerCapture(e.pointerId);e.preventDefault();};
    layer.onpointermove=e=>{if(!start)return;const end=point(e);Object.assign(selection.style,{display:'block',left:`${Math.min(start.x,end.x)}px`,top:`${Math.min(start.y,end.y)}px`,width:`${Math.abs(start.x-end.x)}px`,height:`${Math.abs(start.y-end.y)}px`});};
    layer.onpointerup=e=>{
      if(!start)return;const end=point(e),box=layer.getBoundingClientRect(),width=Math.abs(end.x-start.x),height=Math.abs(end.y-start.y);
      try{if(width<12||height<12)throw new Error('框选区域过小，请重新框选。');const rect={x:Math.min(start.x,end.x)/box.width*context.canvas.width,y:Math.min(start.y,end.y)/box.height*context.canvas.height,width:width/box.width*context.canvas.width,height:height/box.height*context.canvas.height};this.add(imageData(context.canvas,rect),`第 ${context.page} 页 · 框选图表`,`crop-${context.page}-${Object.values(rect).map(Math.round).join('-')}`);$('figureWorkflow').open=true;this.notice('图表已加入，包含框选区域内的文字和矢量内容。');}catch(error){this.notice(error.message,true);}finally{layer.remove();this.cropLayer=null;}
    };
    layer.onpointercancel=()=>{layer.remove();this.cropLayer=null;};layer.onkeydown=e=>{if(e.key==='Escape'){layer.remove();this.cropLayer=null;}};layer.focus();this.notice('在左侧原页拖动框选图片或图表；再次点击框选或按 Escape 取消。');
  }
  async analyzePaper(){
    if(this.busy||this.textBusy||!this.hasAI)return;
    const generation=++this.generation;this.busy=true;this.controls();this.research.clear();
    try{
      const options=await this.research.options(),source=await this.getSource?.(this.research.$('researchScope').value==='all');
      if(generation!==this.generation)return;
      if(!source?.text?.trim())throw new Error('当前材料没有可提取文字。扫描页可提取图片后分析。');
      this.research.notice('正在分析 '+source.text.length+' 字'+(source.truncated?'（已达到范围上限，非完整论文）':'')+'…');
      const result=await this.analyzeRequest(undefined,$('figureProfile').value,text=>{if(generation===this.generation)this.research.output(text);},{...options,type:'RESEARCH_ANALYZE',text:source.text,source});
      if(generation!==this.generation)return;this.research.output(result,true);this.research.notice(this.memoryWarning||'分析完成。结论请对照原文；可导出 Markdown。',Boolean(this.memoryWarning));
    }catch(error){if(generation===this.generation)this.research.notice(error.message,true);}
    finally{if(generation===this.generation){this.busy=false;this.controls();}}
  }
  async reproduce(item,language){
    if(this.busy||this.textBusy||!item.result)return;
    const generation=++this.generation;this.busy=true;this.controls();
    item.codePanels.get(language)?.remove();const panel=document.createElement('section'),title=document.createElement('strong'),output=document.createElement('pre');title.textContent=language==='r'?'R 复现草稿':'Python 复现草稿';output.className='figure-output';panel.append(title,output);item.codeOutput.append(panel);item.codePanels.set(language,panel);
    try{
      const options=await this.research.options(),source=item.source||await this.getSource?.(false);if(generation!==this.generation)return;
      this.notice('正在生成 '+(language==='r'?'R':'Python')+' 复现草稿…');
      const result=await this.analyzeRequest(item.data,$('figureProfile').value,text=>{if(generation===this.generation)output.textContent=text;},{...options,type:'FIGURE_CODE',language,figureAnalysis:item.result,caption:item.caption,text:item.paperText,source});
      if(generation!==this.generation)return;output.textContent=result;
      const code=codeBlock(result,language);if(!code)throw new Error('AI 未返回指定语言的代码块，请重试；现有结果保留。');
      item.codeResults[language]={code,result};
      const download=document.createElement('button');download.textContent='下载 '+(language==='r'?'.R':'.py');download.onclick=()=>downloadText('QudadFlow-figure.'+(language==='r'?'R':'py'),code);panel.append(download);
      const notes=document.createElement('button');notes.textContent='下载代码与说明';notes.onclick=()=>downloadText('QudadFlow-reproduction-'+language+'.md',result,'text/markdown;charset=utf-8');panel.append(notes);
      this.notice('复现草稿已生成，尚未执行。请核对原始数据、估读值、依赖与输出路径。'+this.memoryWarning,Boolean(this.memoryWarning));
    }catch(error){if(generation===this.generation)this.notice(error.message,true);}
    finally{if(generation===this.generation){this.busy=false;this.controls();}}
  }
  async analyzeAll(items=this.items.filter(item=>!item.result)){
    if(this.busy||this.textBusy||!this.hasAI||!items.length)return;
    const generation=++this.generation;this.busy=true;this.controls();let memoryWarning='';
    try{
      for(const item of items){
        this.notice(`正在分析：${item.label}。图片将发送到所选 AI API。`);item.output.textContent='正在识别图中文字…';item.result='';item.codeResults={};item.codePanels.clear();item.codeOutput.replaceChildren();
        const options=await this.research.options(),source=item.source||await this.getSource?.(false);
        if(generation!==this.generation)return;
        const result=await this.analyzeRequest(item.data,$('figureProfile').value,text=>{if(generation===this.generation)item.output.textContent=text;},{...options,source,text:item.paperText,caption:item.caption});
        memoryWarning=this.memoryWarning||memoryWarning;
        if(generation!==this.generation)return;item.result=result;item.output.textContent=result;
      }
      this.notice('图文翻译与图表解释已完成。AI 可能误读文字和数值，请与原图核对。'+memoryWarning,Boolean(memoryWarning));
    }catch(error){if(generation===this.generation){for(const item of items)if(!item.result)item.output.textContent='未完成分析，可重试。';this.notice(error.message,true);}}
    finally{if(generation===this.generation){this.busy=false;this.controls();}}
  }
}
