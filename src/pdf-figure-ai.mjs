import {pdfCaption,rectOverlap,rectUnion} from './pdf-figure-plan.mjs';
import {pdfRegionMatch} from './pdf-region-match.mjs';

export function pdfDetectionPages(value,current,count){
  if(!String(value).trim())return [current];
  const pages=new Set();
  for(const part of String(value).split(/[,，]/)){
    const match=part.trim().match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/);if(!match)throw new Error('页码格式：13-18 或 13,15,17；留空只识别当前页。');
    const from=Number(match[1]),to=Number(match[2]||from);if(from<1||to>count||from>to)throw new Error(`页码应在 1–${count} 之间，范围按从小到大填写。`);
    for(let page=from;page<=to;page++)pages.add(page);
  }
  return [...pages].sort((a,b)=>a-b);
}
function detectionError(message){const error=new Error(message);error.code='PDF_DETECTION_FORMAT';return error;}

// Normalize declared units before checking geometry. A bad candidate must not
// discard other valid figures on the page; every accepted crop still has a preview.
export function inspectPdfFigureDetections(response,{width,height,imageWidth=width,imageHeight=height}){
  if(![width,height,imageWidth,imageHeight].every(n=>Number.isFinite(n)&&n>0))throw detectionError('页面尺寸无效。');
  if(typeof response!=='string'||response.length>64000)throw detectionError('AI 定位结果无效或过大，请换用支持图片和 JSON 输出的模型。');
  const fenced=response.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let payload;try{payload=JSON.parse((fenced?.[1]||response).trim());}catch{throw detectionError('AI 未返回有效的图表定位 JSON。');}
  if(!payload||!Array.isArray(payload.figures)||payload.figures.length>40)throw detectionError('AI 图表定位格式不正确。');
  const regions=[],issues=[];
  for(const [i,f]of payload.figures.entries()){
    try{
      if(!f||!['figure','table'].includes(f.kind))throw new Error('图表类型无效');
      const label=f.label??'',caption=f.caption??'';
      if(typeof label!=='string'||label.length>150||typeof caption!=='string'||caption.length>4000)throw new Error('图表命名或图注格式无效');
      const named=pdfCaption(label.trim());if(label.trim()&&(!named||named.kind!==f.kind))throw new Error('图表编号与类型不一致');
      let box=f.box??f.bbox,format=f.box_format??payload.box_format??'xywh';const coordinateNotes=[];
      if(box&&typeof box==='object'&&!Array.isArray(box)){
        if(['x','y','width','height'].every(k=>Object.hasOwn(box,k))){box=[box.x,box.y,box.width,box.height];format='xywh';}
        else if(['x1','y1','x2','y2'].every(k=>Object.hasOwn(box,k))){box=[box.x1,box.y1,box.x2,box.y2];format='xyxy';}
      }
      if(!Array.isArray(box)||box.length!==4||box.some(n=>typeof n!=='number'||!Number.isFinite(n)))throw new Error('坐标必须是四个有限数字');
      if(!['xywh','xyxy'].includes(format))throw new Error('坐标格式应为 xywh 或 xyxy');
      let unit=f.coordinate_system??payload.coordinate_system;
      if(!unit&&box.every(n=>n>=0&&n<=1)&&box.some(n=>n>0)){unit='normalized_1';coordinateNotes.push('已将 0–1 比例坐标换算为页面范围');}
      unit??='normalized_1000';
      const scale=unit==='normalized_1000'?[1,1]:unit==='normalized_1'?[1000,1000]:unit==='percent'?[10,10]:unit==='pixels'?[1000/imageWidth,1000/imageHeight]:null;
      if(!scale)throw new Error('坐标单位不明确，请返回 normalized_1000、normalized_1、percent 或 pixels');
      let [x,y,a,b]=box.map((n,j)=>n*scale[j%2]);
      let w=format==='xyxy'?a-x:a,h=format==='xyxy'?b-y:b,needsReview=false;
      // Some models omit the xyxy declaration. Only recover it when xywh is
      // impossible and both opposite corners are valid; require manual selection.
      if(format==='xywh'&&!f.box_format&&!payload.box_format&&(x+w>1004||y+h>1004)&&a>x&&b>y&&a<=1000&&b<=1000){w=a-x;h=b-y;needsReview=true;coordinateNotes.push('疑似返回了右下角坐标，已换算；请核对范围后手动勾选');}
      if(x< -4||y< -4||w<=0||h<=0||x+w>1004||y+h>1004)throw new Error('裁剪范围超出原页，已跳过此项');
      const right=Math.min(1000,x+w),bottom=Math.min(1000,y+h),left=Math.max(0,x),top=Math.max(0,y);
      if(left!==x||top!==y||right!==x+w||bottom!==y+h)coordinateNotes.push('已修正不超过页面 0.4% 的边缘舍入误差');
      x=left;y=top;w=right-left;h=bottom-top;
      if(w<12||h<12||w*h>970000)throw new Error('裁剪范围过小或几乎覆盖整页，无法可靠定位');
      if(w*h>850000){needsReview=true;coordinateNotes.push('候选接近整页，请核对是否包含无关正文后手动勾选');}
      if(unit==='pixels'||f.box_format==='xyxy'||payload.box_format==='xyxy')coordinateNotes.push('已按声明的坐标单位和格式换算');
      const region={x:x/1000*width,y:y/1000*height,width:w/1000*width,height:h/1000*height,kind:f.kind,label:named?.label||(f.kind==='table'?'未编号表格':'未编号图表'),identity:named?.identity||`ai:${f.kind}:${i}`,caption,ai:true,coordinateNotes,needsReview};
      const spatialDuplicate=regions.find(r=>pdfRegionMatch(r,region)?.spatial&&r.identity!==region.identity);
      if(spatialDuplicate){
        const relation=pdfRegionMatch(spatialDuplicate,region),notes=[...spatialDuplicate.coordinateNotes,...coordinateNotes,'已合并同页重复定位的区域'];
        if(relation.conflict)notes.push('重叠候选编号不一致，请对照原页核对后手动勾选');
        const keepName=!spatialDuplicate.identity.startsWith('ai:'),identity=keepName?spatialDuplicate.identity:region.identity,label=keepName?spatialDuplicate.label:region.label;
        const keep=region.width*region.height>spatialDuplicate.width*spatialDuplicate.height?region:spatialDuplicate;
        const merged={...keep,identity,label,kind:keepName?spatialDuplicate.kind:region.kind,coordinateNotes:[...new Set(notes)],needsReview:spatialDuplicate.needsReview||region.needsReview||relation.conflict};
        Object.assign(spatialDuplicate,merged);continue;
      }
      const existing=named&&regions.find(r=>r.identity===region.identity);
      if(existing){
        const union=rectUnion([existing,region]);
        if(union.width*union.height>width*height*.97)throw new Error('同编号合并范围几乎覆盖整页，保留此前有效候选');
        const large=union.width*union.height>width*height*.85;
        Object.assign(existing,union,{needsReview:existing.needsReview||needsReview||large,coordinateNotes:[...new Set([...existing.coordinateNotes,...coordinateNotes,...(large?['同编号合并范围接近整页，请核对后手动勾选']:[])])]});continue;
      }
      if(regions.some(r=>rectOverlap(r,region)>.94*Math.max(r.width*r.height,region.width*region.height)))continue;
      regions.push(region);
    }catch(error){issues.push({index:i+1,label:typeof f?.label==='string'?f.label.slice(0,150):'',reason:error.message});}
  }
  return {regions,issues,total:payload.figures.length};
}
export function parsePdfFigureDetections(response,geometry){
  const result=inspectPdfFigureDetections(response,geometry);
  if(!result.regions.length&&result.issues.length)throw detectionError('AI 返回的裁剪范围或命名不可靠：'+result.issues[0].reason+'。');
  return result.regions;
}

export function previewPdfDetections(candidates,{signal,workbench,onSource,summary=''}={}){
  if(signal?.aborted)return Promise.resolve(null);
  const dialog=document.createElement('section');dialog.className='pdf-detection-preview';dialog.setAttribute('aria-label','核对 AI 定位图表');dialog.tabIndex=-1;
  const title=document.createElement('h2');title.textContent='核对 AI 定位图表';
  const hint=document.createElement('p');hint.textContent='可继续滚动、翻阅原文。核对范围与编号后加入；替换已有裁剪或不确定的坐标需手动勾选。'+summary;
  const header=document.createElement('div');header.className='pdf-detection-header';
  const toolbar=document.createElement('div');toolbar.className='figure-actions';
  const select=document.createElement('button');select.textContent='全选 / 取消全选';
  const accept=document.createElement('button');accept.className='primary';const cancel=document.createElement('button');cancel.textContent='取消';toolbar.append(select,accept,cancel);
  const grid=document.createElement('div');grid.className='pdf-detection-grid';const choices=[];
  for(const candidate of candidates){
    const card=document.createElement('label');card.className='pdf-detection-card';const input=document.createElement('input');input.type='checkbox';input.checked=!candidate.replaces&&!candidate.region.needsReview;
    const heading=document.createElement('span');heading.textContent=`第 ${candidate.page} 页 · ${candidate.region.label}${candidate.replaces?' · 替换现有裁剪（会清除该项解读）':''}`;
    const img=document.createElement('img');img.src=candidate.data;img.alt=heading.textContent;
    const caption=document.createElement('small');caption.textContent=candidate.region.caption||'未识别图注，请对照原页核查。';card.append(input,heading,img,caption);
    if(candidate.region.coordinateNotes?.length){const warning=document.createElement('small');warning.className='pdf-detection-warning';warning.textContent=candidate.region.coordinateNotes.join('；');card.append(warning);}
    if(onSource){const source=document.createElement('button');source.type='button';source.className='pdf-detection-source';source.textContent='查看原页';source.onclick=event=>{event.preventDefault();workbench?.setExpanded(false);onSource(candidate.page);};card.append(source);}
    grid.append(card);choices.push({input,candidate});
  }
  const update=()=>{const n=choices.filter(c=>c.input.checked).length;accept.textContent=`加入所选（${n}）`;accept.disabled=!n;};for(const c of choices)c.input.onchange=update;
  select.onclick=()=>{const checked=!choices.every(c=>c.input.checked);for(const c of choices)c.input.checked=checked;update();};update();header.append(title,toolbar);dialog.append(header,hint,grid);
  if(workbench)workbench.review(dialog);else document.body.append(dialog);
  return new Promise(resolve=>{
    let settled=false;const finish=value=>{if(settled)return;settled=true;signal?.removeEventListener('abort',abort);dialog.remove();workbench?.finishReview(Boolean(value?.length));resolve(value);};
    const abort=()=>finish(null);signal?.addEventListener('abort',abort,{once:true});
    accept.onclick=()=>finish(choices.filter(c=>c.input.checked).map(c=>c.candidate));cancel.onclick=()=>finish([]);dialog.onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();finish([]);}};
    accept.focus({preventScroll:true});
  });
}
