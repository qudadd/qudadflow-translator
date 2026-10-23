// One compact workspace; acquisition, selection and answers share a single footprint.
export class FigureWorkbench {
  constructor({root,picker,tables,research,cards,importButton,imageFile,pasteHint}) {
    this.root=root;this.body=root.querySelector('.figure-body');this.active='acquire';
    this.bar=document.createElement('div');this.bar.className='workbench-bar';
    this.tabs=document.createElement('div');this.tabs.className='workbench-tabs';this.tabs.setAttribute('role','tablist');this.tabs.setAttribute('aria-label','图表工作台');
    this.panels=new Map();this.buttons=new Map();
    for(const [key,label] of [['acquire','提取图表'],['gallery','图表总览'],['analysis','解读与问答'],['review','核对候选']]){
      const button=document.createElement('button');button.type='button';button.id=`figure-tab-${key}`;button.textContent=label;button.setAttribute('role','tab');button.setAttribute('aria-controls',`figure-panel-${key}`);button.hidden=key==='review';
      const panel=document.createElement('section');panel.className='workbench-panel';panel.id=`figure-panel-${key}`;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);panel.tabIndex=0;panel.hidden=true;
      button.onclick=()=>this.show(key);button.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const visible=[...this.buttons.entries()].filter(([,b])=>!b.hidden),at=visible.findIndex(([k])=>k===key),index=event.key==='Home'?0:event.key==='End'?visible.length-1:(at+(event.key==='ArrowRight'?1:-1)+visible.length)%visible.length;this.show(visible[index][0]);visible[index][1].focus();};
      this.tabs.append(button);this.buttons.set(key,button);this.panels.set(key,panel);this.body.append(panel);
    }
    const profile=document.getElementById('figureModel').closest('label');profile.classList.add('workbench-profile');this.bar.append(this.tabs,profile);
    const tools=this.body.querySelector('.figure-tools'),manual=document.createElement('details');manual.className='workbench-manual';
    const summary=document.createElement('summary');summary.textContent='手动补图';
    const manualTools=document.createElement('div');manualTools.className='figure-tools';manualTools.append(document.getElementById('cropFigure'),importButton,imageFile,document.getElementById('capturePage'));manual.append(summary,manualTools,pasteHint);
    const hint=document.createElement('p');hint.className='workbench-hint';hint.textContent=document.body.classList.contains('document-reader')?'先本地提取；有遗漏时再用 AI 定位，核对后解读。':'提取结果可在总览一键选择；漏图可回原文补入。';
    this.panels.get('acquire').append(hint,tools);
    this.panels.get('acquire').append(manual);
    for(const node of [this.body.querySelector('.remote-actions'),this.body.querySelector('.remote-details')])if(node)this.panels.get('acquire').append(node);
    this.panels.get('gallery').append(picker,tables);picker.open=true;
    const supplements=document.createElement('div');supplements.className='workbench-supplements';
    for(const id of ['aiFigureControls','captureReview']){const node=document.getElementById(id);if(node)supplements.append(node);}
    this.panels.get('gallery').prepend(supplements);
    this.panels.get('analysis').append(research,cards);research.open=true;
    const stops=document.createElement('div');stops.className='workbench-stops';for(const id of ['stopExtraction','stopFigures']){const node=document.getElementById(id);if(node)stops.append(node);}
    const state=document.createElement('div');state.className='workbench-state';state.append(document.getElementById('figureStatus'),stops);
    this.body.replaceChildren(this.bar,state,...this.panels.values());root.classList.add('figure-workbench');
    this.show(document.body.classList.contains('research-page')?'analysis':'acquire',{open:false});
  }
  show(key,{open=true}={}){
    if(!this.panels.has(key)||this.buttons.get(key).hidden)return;
    this.active=key;if(open)this.root.open=true;
    for(const [name,panel]of this.panels){panel.hidden=name!==key;const button=this.buttons.get(name);button.setAttribute('aria-selected',String(name===key));button.tabIndex=name===key?0:-1;}
    this.body.scrollTop=0;
  }
  reset(){this.buttons.get('review').hidden=true;this.panels.get('review').replaceChildren();this.show(document.body.classList.contains('research-page')?'analysis':'acquire',{open:false});}
  review(element){this.panels.get('review').append(element);this.buttons.get('review').hidden=false;this.show('review');}
  finishReview(){this.panels.get('review').replaceChildren();this.buttons.get('review').hidden=true;this.show('gallery',{open:false});}
}
