// One selection shared by the overview, detail cards and paper questions.
// Pending previews use locally captured pixels only; rendering never fetches remote URLs.
export class FigurePicker {
  constructor(container,{onChange,onLoad,onAsk,onInspect,analyzeButton,stopButton}) {
    Object.assign(this,{onChange,onLoad,onAsk,onInspect});
    this.records=new Map();this.tiles=new Map();this.selected=new Set();this.groupOffset=0;
    this.container=document.createElement('details');this.container.className='figure-picker';this.container.open=true;
    this.container.innerHTML=`<summary><strong>图表总览</strong><span id="figurePickerCount"></span></summary>
      <p class="research-hint">一键全选图表，也可直接勾选缩略图，再批量载入和解读。已提取的文字表格全部随正文参与问答，无需勾选。</p>
      <label class="figure-search">查找图表<input id="figureSearch" type="search" placeholder="搜索图号、图注或页码" autocomplete="off"></label>
      <div class="figure-picker-tools"><button id="selectAllFigures" title="选中全部可用图表，包含搜索结果以外及原图待载入的项目">全选图表</button><button id="selectVisibleFigures" hidden>选中筛选结果</button><button id="selectUnfinishedFigures" title="替换当前选择，仅保留筛选结果中未分析的图片">仅选未分析</button><button id="clearFigureSelection">取消全选</button><button id="nextFigureGroup" title="替换当前选择，依次选择筛选结果中的已载入图片，每组最多 4 张">下一组（最多 4 张）</button></div>
      <p id="figureSelectionStatus" class="research-hint" role="status"></p><div class="figure-grid"></div>
      <p id="figurePickerEmpty" class="research-hint"></p><div class="figure-picker-actions"><button id="loadFilteredFigures">批量载入全部原图</button><button id="loadSelectedFigures">载入所选原图</button><button id="askSelectedFigures">结合所选提问</button></div>`;
    container.prepend(this.container);this.$=id=>this.container.querySelector('#'+id);this.grid=this.container.querySelector('.figure-grid');
    this.container.querySelector('.figure-picker-actions').append(analyzeButton,stopButton);
    this.$('figureSearch').oninput=()=>{this.groupOffset=0;this.render();};
    this.$('selectAllFigures').onclick=()=>{for(const r of this.records.values())if(this.selectable(r))this.selected.add(r.key);this.changed();};
    this.$('selectVisibleFigures').onclick=()=>{for(const r of this.visible())if(this.selectable(r))this.selected.add(r.key);this.changed();};
    this.$('selectUnfinishedFigures').onclick=()=>{this.selected=new Set(this.visible().filter(r=>this.selectable(r)&&!r.result).map(r=>r.key));this.changed();};
    this.$('clearFigureSelection').onclick=()=>{this.selected.clear();this.changed();};
    this.$('nextFigureGroup').onclick=()=>{
      const loaded=this.visible().filter(r=>r.data);if(!loaded.length)return;
      if(this.groupOffset>=loaded.length)this.groupOffset=0;
      this.selected=new Set(loaded.slice(this.groupOffset,this.groupOffset+4).map(r=>r.key));
      this.groupOffset+=4;this.onChange();
    };
    // Keep the permission request in this direct click chain (no preceding await).
    this.$('loadSelectedFigures').onclick=()=>this.onLoad([...this.selected]);
    this.$('loadFilteredFigures').onclick=()=>this.onLoad(this.visible().filter(r=>!r.data&&r.canLoad).map(r=>r.key));
    this.$('askSelectedFigures').onclick=()=>this.onAsk();
  }
  selectable(record){return Boolean(record.data||record.canLoad);}
  visible(){const query=this.$('figureSearch').value.trim().toLocaleLowerCase();return [...this.records.values()].filter(r=>!query||`${r.label} ${r.caption||''}`.toLocaleLowerCase().includes(query));}
  changed(){this.groupOffset=0;this.onChange();}
  select(key,checked){if(checked&&this.selectable(this.records.get(key)||{}))this.selected.add(key);else this.selected.delete(key);this.changed();}
  reset(){this.records.clear();this.selected.clear();this.tiles.clear();this.grid.replaceChildren();this.$('figureSearch').value='';this.groupOffset=0;}
  update(records,{locked=false,textBusy=false}={}){
    const incoming=new Map(records.map(r=>[r.key,r])),ordered=new Map();
    // Loading an original must not reorder its tile or lose its selection/focus.
    for(const key of this.records.keys())if(incoming.has(key))ordered.set(key,incoming.get(key));
    for(const [key,record] of incoming)if(!ordered.has(key))ordered.set(key,record);
    this.records=ordered;this.locked=locked;this.textBusy=textBusy;
    for(const key of this.selected)if(!incoming.has(key))this.selected.delete(key);
    for(const [key,tile] of this.tiles)if(!incoming.has(key)){tile.element.remove();this.tiles.delete(key);}
    for(const [key,record] of ordered){
      let tile=this.tiles.get(key);
      if(!tile){
        const element=document.createElement('article');element.className='figure-tile';element.dataset.key=key;
        const choice=document.createElement('label');choice.className='figure-tile-choice';
        const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.onchange=()=>this.select(key,checkbox.checked);
        const preview=document.createElement('span');preview.className='figure-tile-preview';
        const title=document.createElement('strong'),caption=document.createElement('span'),state=document.createElement('small');caption.className='figure-tile-caption';state.className='figure-tile-state';
        choice.append(checkbox,preview,title,caption,state);
        const inspect=document.createElement('button');inspect.textContent='查看详情 / 结果';inspect.onclick=()=>this.onInspect(key);
        element.append(choice,inspect);this.grid.append(element);tile={element,checkbox,preview,title,caption,state,inspect};this.tiles.set(key,tile);
      }
      const data=record.data||record.previewData||'';
      if(tile.data!==data){
        tile.data=data;tile.preview.replaceChildren();
        if(/^data:image\/(png|jpeg|webp);base64,/.test(data)){const image=document.createElement('img');image.src=data;image.alt='';image.loading='lazy';tile.preview.append(image);}
        else tile.preview.textContent=record.canLoad?'原图待载入':'需要补图';
      }
      tile.title.textContent=record.label;tile.caption.textContent=record.caption||'无图注';tile.caption.title=record.caption||'';
      tile.state.textContent=record.loading?'正在载入…':record.error||(!record.data?(record.canLoad?(record.previewData?'缩略预览 · 原图待载入':'尚未载入')+' · '+(record.hostname||'图片来源'):'在原文完整显示后补入截图'):record.result?'已分析':'已载入 · 未分析');
      tile.state.classList.toggle('error',Boolean(record.error));tile.inspect.hidden=!record.data;
    }
    this.render();
  }
  render(){
    const visible=this.visible(),visibleKeys=new Set(visible.map(r=>r.key)),selected=[...this.selected].map(key=>this.records.get(key)).filter(Boolean);
    for(const [key,tile] of this.tiles){const record=this.records.get(key);tile.element.hidden=!visibleKeys.has(key);tile.checkbox.checked=this.selected.has(key);tile.checkbox.disabled=this.locked||!this.selectable(record);tile.inspect.disabled=this.locked;tile.element.classList.toggle('selected',tile.checkbox.checked);}
    const pending=selected.filter(r=>!r.data).length,hidden=selected.filter(r=>!visibleKeys.has(r.key)).length;
    this.$('figurePickerCount').textContent=`${this.records.size} 项`;
    this.$('figureSelectionStatus').textContent=`已选 ${selected.length} 项${pending?` · ${pending} 项待载入`:''}${hidden?` · ${hidden} 项不在当前筛选中`:''}。可全选并提问；超过 4 张时先逐张读图，再综合回答。`;
    this.$('figurePickerEmpty').hidden=visible.length>0;
    this.$('figurePickerEmpty').textContent=this.records.size?'没有匹配的图表，请调整搜索。':'提取或导入图表后，即可在此批量选择。';
    this.$('figureSearch').disabled=this.locked;
    const selectable=[...this.records.values()].filter(r=>this.selectable(r));
    this.$('selectAllFigures').textContent=`全选图表（${selectable.length}）`;
    this.$('selectAllFigures').disabled=this.locked||!selectable.length||selectable.every(r=>this.selected.has(r.key));
    this.$('selectVisibleFigures').hidden=!this.$('figureSearch').value.trim();
    this.$('selectVisibleFigures').disabled=this.$('selectUnfinishedFigures').disabled=this.locked||!visible.some(r=>this.selectable(r));
    this.$('clearFigureSelection').disabled=this.locked||!selected.length;
    this.$('nextFigureGroup').disabled=this.locked||!visible.some(r=>r.data);
    this.$('loadSelectedFigures').disabled=this.locked||this.textBusy||!selected.some(r=>!r.data&&r.canLoad);
    const loadable=visible.filter(r=>!r.data&&r.canLoad).length;
    this.$('loadFilteredFigures').textContent=(this.$('figureSearch').value.trim()?'载入筛选结果原图':'批量载入全部原图')+(loadable?`（${loadable}）`:'');
    this.$('loadFilteredFigures').hidden=![...this.records.values()].some(r=>r.canLoad&&!r.data);
    this.$('loadFilteredFigures').disabled=this.locked||this.textBusy||!loadable;
    this.$('askSelectedFigures').disabled=this.locked||this.textBusy||!selected.length;
  }
}
