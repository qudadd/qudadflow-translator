// Lightweight page placeholders keep scroll positions stable; only nearby pages keep canvases.
export class ReaderPageStack {
  constructor({source,translation,render,dispose,onActive,onError}){
    Object.assign(this,{source,translation,render,dispose,onActive,onError});this.slots=new Map();this.queue=[];this.restoredPositions=new WeakMap();
  }
  placeholder(slot){
    for(const node of [slot.source,slot.translation]){
      node.replaceChildren();delete node.dataset.ready;
      const hint=document.createElement('div');hint.className='page-loading';hint.textContent=`第 ${slot.number} 页 · 滚动到此处加载`;
      if(slot.state==='error'){hint.textContent=`第 ${slot.number} 页未能载入。`;const retry=document.createElement('button');retry.textContent='重试';retry.onclick=()=>{slot.state='idle';void this.navigate(slot.number);};hint.append(retry);}
      node.append(hint);
    }
  }
  mount(count,current,width,height,anchor){
    for(let number=1;number<=count;number++){
      const slot={number,state:'idle'};
      for(const [side,container]of [['source',this.source],['translation',this.translation]]){
        const node=document.createElement('section');node.className='reader-page-slot';node.dataset.page=number;node.setAttribute('aria-label',`第 ${number} 页`);
        node.style.minHeight=`${height}px`;node.style.setProperty('--page-width',`${width}px`);container.append(node);slot[side]=node;
      }
      this.slots.set(number,slot);this.placeholder(slot);
    }
    return this.navigate(current,anchor?.number===current?anchor.fraction:0);
  }
  async ensure(number){
    const slot=this.slots.get(number);if(!slot||this.closed||slot.state==='ready')return;
    slot.state='loading';
    try{
      const result=await this.render(number,slot.source,slot.translation);
      if(this.closed){this.dispose?.(number);return;}
      slot.state=result?'ready':'error';
      if(result){
        const panes=[this.source.parentElement,this.translation.parentElement],anchors=panes.map(pane=>this.anchor(pane));
        for(const node of [slot.source,slot.translation])node.style.minHeight='0px';
        const height=Math.max(slot.source.scrollHeight,slot.translation.scrollHeight);
        for(const node of [slot.source,slot.translation]){node.style.minHeight=`${height}px`;node.dataset.ready='true';}
        panes.forEach((pane,index)=>this.restore(pane,anchors[index]));
        if(number===this.active)this.onActive(number);
      }else this.placeholder(slot);
    }catch(error){slot.state='error';if(!this.closed){this.placeholder(slot);this.onError?.(error);}}
    finally{slot.resolve?.();slot.resolve=null;if(!this.closed)this.evict();}
  }
  navigate(number,fraction=0){
    if(this.closed)return;const slot=this.slots.get(number);if(!slot)return;
    this.active=number;
    for(const pane of [this.source.parentElement,this.translation.parentElement])this.restore(pane,{number,fraction});
    this.onActive(number);
    const done=slot.state==='ready'?Promise.resolve():new Promise(resolve=>{const previous=slot.resolve;slot.resolve=()=>{previous?.();resolve();};});
    this.nearby(number);return done;
  }
  nearby(number){
    const next=[number,number+1,number-1].filter(n=>this.slots.has(n));
    for(const n of this.queue)if(!next.includes(n)){this.slots.get(n)?.resolve?.();if(this.slots.has(n))this.slots.get(n).resolve=null;}
    this.queue=next;this.evict();void this.pump();
  }
  evict(){
    for(const [n,slot]of this.slots){
      if(Math.abs(n-this.active)<=2||!['ready','loading'].includes(slot.state))continue;
      this.dispose?.(n);if(slot.state==='loading')continue;
      slot.state='idle';this.placeholder(slot);
    }
  }
  async pump(){
    if(this.pumping||this.closed)return;this.pumping=true;
    try{while(this.queue.length&&!this.closed)await this.ensure(this.queue.shift());}
    finally{this.pumping=false;}
  }
  anchor(pane){
    const side=pane.firstElementChild===this.source?'source':'translation';let slot=this.slots.get(1);
    for(const candidate of this.slots.values()){if(candidate[side].offsetTop>pane.scrollTop+1)break;slot=candidate;}
    return {number:slot?.number||1,fraction:slot?Math.max(0,Math.min(1,(pane.scrollTop-slot[side].offsetTop)/Math.max(1,slot[side].offsetHeight))):0};
  }
  restore(pane,{number,fraction=0}){
    const slot=this.slots.get(number),node=slot?.[pane.firstElementChild===this.source?'source':'translation'];
    if(node){pane.scrollTop=node.offsetTop+fraction*node.offsetHeight;this.restoredPositions.set(pane,pane.scrollTop);}
  }
  consumeRestoredScroll(pane){
    const expected=this.restoredPositions.get(pane);this.restoredPositions.delete(pane);
    // A queued render/layout scroll must not overwrite a newer scroll in the other pane.
    return expected!==undefined&&Math.abs(pane.scrollTop-expected)<1;
  }
  scroll(pane){
    if(this.closed)return;const {number}=this.anchor(pane);
    if(number!==this.active){this.active=number;this.onActive(number);this.nearby(number);}
  }
  close(){this.closed=true;this.queue=[];for(const slot of this.slots.values()){slot.resolve?.();this.dispose?.(slot.number);}this.slots.clear();}
}
