// The same workspace can stay beside the document or expand without duplicating state.
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
    for(const id of ['aiFigureControls','captureReview']){const node=document.getElementById(id);if(!node)continue;if(id==='captureReview'){
      const drawer=document.createElement('details');drawer.className='workbench-web-supplement';const label=document.createElement('summary');label.textContent='核对漏项与补图';drawer.append(label,node);supplements.append(drawer);
    }else supplements.append(node);}
    this.panels.get('gallery').prepend(supplements);
    this.compose=document.createElement('div');this.compose.className='workbench-compose';
    this.compose.append(document.getElementById('researchOptions'),document.getElementById('paperStatus'),document.getElementById('paperElapsed'));
    this.answers=document.createElement('div');this.answers.className='workbench-answers';
    const empty=document.createElement('div');empty.className='workbench-answer-placeholder';
    const heading=document.createElement('h3');heading.textContent='结合图表，深入阅读';
    const message=document.createElement('p');message.textContent='在图表总览选择图片，填写问题后发送。论文回答与追问记录会显示在这里。';empty.append(heading,message);
    this.answers.append(empty,document.getElementById('paperConversation'),document.getElementById('currentQuestion'),document.getElementById('paperOutput'));
    const researchLayout=document.createElement('div');researchLayout.className='workbench-research-layout';researchLayout.append(this.compose,this.answers);research.append(researchLayout);
    this.panels.get('analysis').append(research,cards);research.open=true;
    const stops=document.createElement('div');stops.className='workbench-stops';for(const id of ['stopExtraction','stopFigures']){const node=document.getElementById(id);if(node)stops.append(node);}
    const state=document.createElement('div');state.className='workbench-state';state.append(document.getElementById('figureStatus'),stops);
    this.body.replaceChildren(this.bar,state,...this.panels.values());root.classList.add('figure-workbench');
    this.setupFocusView();
    this.show(document.body.classList.contains('research-page')?'analysis':'acquire',{open:false});
  }
  setupFocusView(){
    this.focusButton=document.createElement('button');this.focusButton.type='button';this.focusButton.id='expandFigureWorkbench';this.focusButton.className='workbench-expand';this.focusButton.textContent='展开工作台';this.focusButton.title='单独查看图表工作台，保留提取结果、选择和分析进度';this.focusButton.setAttribute('aria-haspopup','dialog');this.focusButton.setAttribute('aria-expanded','false');
    this.focusButton.onclick=event=>{event.preventDefault();event.stopPropagation();this.setExpanded(!this.expanded);};
    const summary=this.root.querySelector(':scope>summary');summary.append(this.focusButton);
    this.focusShell=document.createElement('dialog');this.focusShell.id='figureWorkbenchFocus';this.focusShell.className='workbench-focus-shell';this.focusShell.setAttribute('aria-label','图表工作台');this.focusButton.setAttribute('aria-controls',this.focusShell.id);
    this.focusShell.addEventListener('cancel',event=>{event.preventDefault();this.setExpanded(false);});
    this.focusShell.addEventListener('close',()=>{if(this.expanded&&!this.focusShell.open)this.setExpanded(false);});
    this.root.addEventListener('toggle',()=>{if(this.expanded&&!this.root.open){this.setExpanded(false);this.root.open=false;}});
  }
  setExpanded(expanded){
    if(Boolean(expanded)===Boolean(this.expanded))return;
    const scroll=[this.body,...this.root.querySelectorAll('.workbench-panel,.figure-grid,.paper-output,.workbench-compose,.workbench-answers')].map(node=>({node,top:node.scrollTop,left:node.scrollLeft}));
    if(expanded){
      this.returnFocus=document.activeElement;this.wasOpen=this.root.open;this.pageScroll={left:window.scrollX,top:window.scrollY};
      this.anchor=document.createComment('figure-workbench-position');this.root.before(this.anchor);
      document.body.append(this.focusShell);this.focusShell.append(this.root);this.root.open=true;
      this.expanded=true;document.body.classList.add('workbench-focus-open');
      this.focusButton.textContent='返回阅读';this.focusButton.title='返回原来的阅读布局（Esc），提取和分析继续保留';this.focusButton.setAttribute('aria-expanded','true');
      // Web captures keep their native text tables in the source column while reading.
      // Bring the same table nodes into the focused gallery, then restore their place.
      const tables=document.getElementById('tablePanel');
      if(tables&&!tables.closest('.figure-workbench')){this.tableAnchor=document.createComment('paper-tables-position');tables.before(this.tableAnchor);this.panels.get('gallery').append(tables);}
      this.versionFooter=document.querySelector('body>.product-version');
      if(this.versionFooter){this.versionAnchor=document.createComment('product-version-position');this.versionFooter.before(this.versionAnchor);this.focusShell.append(this.versionFooter);}
      this.focusShell.showModal();this.focusButton.focus({preventScroll:true});
    }else{
      this.expanded=false;this.focusShell.close();
      if(this.tableAnchor){this.tableAnchor.replaceWith(document.getElementById('tablePanel'));this.tableAnchor=null;}
      if(this.versionAnchor){this.versionAnchor.replaceWith(this.versionFooter);this.versionAnchor=null;this.versionFooter=null;}
      this.anchor.replaceWith(this.root);this.anchor=null;this.focusShell.remove();
      this.root.open=this.wasOpen;document.body.classList.remove('workbench-focus-open');
      this.focusButton.textContent='展开工作台';this.focusButton.title='单独查看图表工作台，保留提取结果、选择和分析进度';this.focusButton.setAttribute('aria-expanded','false');
      window.scrollTo({...this.pageScroll,behavior:'instant'});
      if(this.returnFocus?.isConnected)this.returnFocus.focus({preventScroll:true});
    }
    for(const {node,top,left}of scroll){node.scrollTop=top;node.scrollLeft=left;}
  }
  // Cropping and locating a PDF candidate need the original page to be visible.
  withSource(){
    const expanded=this.expanded;if(expanded)this.setExpanded(false);
    return ()=>{if(expanded&&this.root.isConnected&&!this.expanded)this.setExpanded(true);};
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
