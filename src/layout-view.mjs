// All coordinates stay in the original unrotated page space; only the outer sheet scales.
export function fitText(node, box, fontSize) {
  // Measure the real text box, never the smaller fallback-link styling from a previous update.
  node.classList.remove('layout-fallback');
  node.style.fontSize=`${fontSize}px`;
  if(!node.textContent)return true;
  const fits=()=>node.scrollHeight<=box.height+1 && node.scrollWidth<=box.width+1;
  if(fits())return true;
  let low=Math.min(fontSize,7),high=fontSize;
  node.style.fontSize=`${low}px`;
  if(!fits())return false;
  for(let i=0;i<7;i++){const mid=(low+high)/2;node.style.fontSize=`${mid}px`;if(fits())low=mid;else high=mid;}
  node.style.fontSize=`${low}px`;return true;
}
export function blockDetail(block) {
  const dialog=document.getElementById('blockDetail');
  document.getElementById('detailOriginal').textContent=block.text;
  document.getElementById('detailTranslation').textContent=block.translation||block.partial||'等待翻译';
  dialog.showModal();
}
function position(node,box) {
  Object.assign(node.style,{left:`${box.x}px`,top:`${box.y}px`,width:`${Math.max(1,box.width)}px`,height:`${Math.max(1,box.height)}px`});
}
export function replacementNode(block,box) {
  const node=document.createElement('div');node.className='inplace-text';node.dir='auto';position(node,box);
  node.tabIndex=0;node.setAttribute('role','button');node.setAttribute('aria-label','查看本段原文和完整译文');
  node.addEventListener('click',()=>blockDetail(block));
  node.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();blockDetail(block);}});
  return node;
}
export class PdfLayoutView {
  constructor({page,source,background,sheet,layer,viewport,base,library,ratio,disabled,notice=true}) {
    Object.assign(this,{page,source,background,sheet,layer,viewport,base,library,ratio,disabled});
    this.canvas=document.createElement('canvas');this.canvas.width=source.width;this.canvas.height=source.height;
    this.canvas.style.width=`${viewport.width}px`;this.canvas.style.height=`${viewport.height}px`;sheet.prepend(this.canvas);
    this.nodes=new Map();this.drawn=new Map();this.notice=notice;
    const matrix=library.Util.transform(viewport.transform,library.Util.inverseTransform(base.transform));
    layer.style.width=`${base.width}px`;layer.style.height=`${base.height}px`;layer.style.transform=`matrix(${matrix.join(',')})`;
    for(const block of page.blocks){const node=replacementNode(block,block.geometry);Object.assign(node.style,block.geometry.typography);layer.append(node);this.nodes.set(block,node);}
    this.update();
  }
  update({notice=this.notice}={}) {
    let changed=!this.painted||this.drawn.size!==this.nodes.size;
    for(const block of this.nodes.keys())if(this.drawn.get(block)!==(block.translation||block.partial||'')){changed=true;break;}
    if(!changed){if(notice)this.showNotice();return;}
    const ctx=this.canvas.getContext('2d');ctx.clearRect(0,0,this.canvas.width,this.canvas.height);ctx.drawImage(this.source,0,0);this.painted=true;
    const mapped=this.library.Util.transform(this.viewport.transform,this.library.Util.inverseTransform(this.base.transform));
    let overflow=0;
    for(const [block,node] of this.nodes) {
      const text=block.translation||block.partial;
      this.drawn.set(block,text||'');
      node.hidden=!text;node.textContent=text||'';node.classList.toggle('pending',!block.translation&&Boolean(block.partial));
      if(!text)continue;
      const box=block.geometry;
      const usable=!this.disabled&&box.supported&&fitText(node,box,box.fontSize);
      node.classList.toggle('layout-fallback',!usable);
      if(!usable){overflow++;node.textContent='↗';node.title='本段无法在原区域内完整显示；点击查看完整译文。原文保留。';continue;}
      node.title='点击查看原文和完整译文';
      for(const rect of box.rects){
        // PDF.js expands this accumulator; zero would incorrectly mask everything from the page origin.
        const bounds=[rect.x,rect.y,rect.x+rect.width,rect.y+rect.height],out=[Infinity,Infinity,-Infinity,-Infinity];
        this.library.Util.axialAlignedBoundingBox(bounds,mapped,out);
        const x=Math.max(0,Math.floor(out[0]*this.ratio)),y=Math.max(0,Math.floor(out[1]*this.ratio));
        const w=Math.min(this.canvas.width-x,Math.ceil(out[2]*this.ratio)-x),h=Math.min(this.canvas.height-y,Math.ceil(out[3]*this.ratio)-y);
        if(w>0&&h>0)ctx.drawImage(this.background,x,y,w,h,x,y,w,h);
      }
      // Choose a readable foreground against the retained original background.
      const point=[box.x,box.y];this.library.Util.applyTransform(point,mapped);
      const pixel=this.background.getContext('2d').getImageData(Math.max(0,Math.min(this.background.width-1,Math.round(point[0]*this.ratio))),Math.max(0,Math.min(this.background.height-1,Math.round(point[1]*this.ratio))),1,1).data;
      node.style.color=(pixel[0]*.299+pixel[1]*.587+pixel[2]*.114)<110?'#f8fafc':'#192333';
    }
    this.overflow=overflow;if(notice)this.showNotice();
  }
  showNotice(){document.getElementById('layoutNotice').textContent=this.overflow?`${this.overflow} 段超出原区域或具有特殊排版，保留原文；点击 ↗ 查看完整译文。`:'译文在原位置显示，页面、图片与图表保持原比例。点击任一译文可查看原文。';}
}
