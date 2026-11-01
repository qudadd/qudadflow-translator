// A native top-layer dialog keeps one live card visible, including streaming output.
export class FigureInspector {
  constructor({workbench,getItems}){
    Object.assign(this,{workbench,getItems});this.cards=document.getElementById('figureCards');this.cards.hidden=true;
    this.shell=document.createElement('dialog');this.shell.id='figureInspector';this.shell.className='figure-inspector';this.shell.setAttribute('aria-labelledby','figureInspectorTitle');
    this.shell.innerHTML='<header class="figure-inspector-header"><div class="figure-inspector-heading"><small>图表解析</small><h2 id="figureInspectorTitle"></h2></div><nav aria-label="切换图表"><button type="button" id="previousFigure" aria-label="上一张图表">上一张</button><span id="figureInspectorPosition"></span><button type="button" id="nextFigure" aria-label="下一张图表">下一张</button></nav><button type="button" id="maximizeFigureInspector" aria-pressed="false">最大化</button><button type="button" id="closeFigureInspector" aria-label="关闭图表解析">关闭 <kbd>Esc</kbd></button></header><div class="figure-inspector-content"></div><footer class="figure-inspector-footer"></footer>';
    this.$=id=>this.shell.querySelector('#'+id);this.content=this.shell.querySelector('.figure-inspector-content');this.footer=this.shell.querySelector('footer');
    this.$('figureInspectorPosition').setAttribute('aria-live','polite');
    this.$('closeFigureInspector').onclick=()=>this.close();
    this.$('previousFigure').onclick=()=>this.step(-1);this.$('nextFigure').onclick=()=>this.step(1);
    this.$('maximizeFigureInspector').onclick=()=>{const on=this.shell.classList.toggle('is-maximized'),button=this.$('maximizeFigureInspector');button.textContent=on?'还原大小':'最大化';button.setAttribute('aria-pressed',String(on));};
    this.shell.addEventListener('cancel',event=>{event.preventDefault();this.close();});
    this.shell.addEventListener('close',()=>{if(this.item&&!this.shell.open)this.close();});
  }
  remember(){if(this.item?.detailBody){this.item.detailScroll=this.item.detailBody.scrollTop;this.item.inspectorScroll=this.content.scrollTop;}}
  open(item,{view}={}){
    if(!this.getItems().includes(item))return;
    this.remember();
    if(!this.item){
      this.returnFocus=document.activeElement;
      this.cardAnchor=document.createComment('figure-cards-position');this.cards.before(this.cardAnchor);
      // Reuse the existing status and stop controls; moving them never cancels a task.
      this.state=this.workbench.root.querySelector('.workbench-state');this.stateAnchor=document.createComment('figure-state-position');this.state.before(this.stateAnchor);
      document.body.append(this.shell);this.content.append(this.cards);this.footer.append(this.state);this.cards.hidden=false;
      document.body.classList.add('figure-inspector-open');
    }
    const changed=this.item!==item;this.item=item;
    if(view)item.setView(view);
    this.sync();
    if(!this.shell.open){this.shell.showModal();this.$('closeFigureInspector').focus({preventScroll:true});}
    if(changed){item.detailBody.scrollTop=item.detailScroll||0;this.content.scrollTop=item.inspectorScroll||0;}
  }
  sync(){
    if(!this.item)return;
    const items=this.getItems();
    if(!items.includes(this.item)){const next=items[Math.min(this.index||0,items.length-1)];if(next)this.open(next);else this.close();return;}
    this.index=items.indexOf(this.item);
    for(const item of items)item.card.hidden=item!==this.item;
    this.$('figureInspectorTitle').textContent=this.item.label;
    this.$('figureInspectorPosition').textContent=`${this.index+1} / ${items.length}`;
    this.$('previousFigure').disabled=this.index===0;this.$('nextFigure').disabled=this.index===items.length-1;
  }
  step(delta){const next=this.getItems()[this.index+delta];if(next)this.open(next);}
  close(){
    if(!this.item)return;
    this.remember();this.item=null;
    this.shell.close();this.cards.hidden=true;
    this.cardAnchor.replaceWith(this.cards);this.stateAnchor.replaceWith(this.state);this.cardAnchor=null;this.stateAnchor=null;
    for(const item of this.getItems())item.card.hidden=false;
    this.shell.remove();document.body.classList.remove('figure-inspector-open');
    if(this.returnFocus?.isConnected&&!this.returnFocus.closest('[hidden]'))this.returnFocus.focus({preventScroll:true});
    else this.workbench.buttons.get('gallery').focus({preventScroll:true});
  }
}
