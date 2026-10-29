// Every reading surface discovers and selects models on the saved active API.
export class ModelPicker {
  constructor(select,{onState=()=>{},onNotice=()=>{},onPending=()=>{}}={}) {
    this.select=select;this.onState=onState;this.onNotice=onNotice;this.onPending=onPending;
    this.revision=0;this.locked=false;this.pending=false;this.reading=false;this.closed=false;
    const field=document.createElement('span');field.className='qf-model-field';
    const row=document.createElement('span');row.className='qf-model-row';
    this.readButton=document.createElement('button');this.readButton.type='button';this.readButton.id=select.id+'Refresh';this.readButton.className='qf-model-refresh';this.readButton.textContent='读取';this.readButton.disabled=true;
    this.note=document.createElement('span');this.note.id=select.id+'Status';this.note.className='qf-model-note';this.note.setAttribute('role','status');this.note.hidden=true;
    select.before(field);row.append(select,this.readButton);field.append(row,this.note);this.field=field;
    select.setAttribute('aria-describedby',[select.getAttribute('aria-describedby'),this.note.id].filter(Boolean).join(' '));
    select.onchange=()=>this.change();
    this.readButton.onclick=()=>this.state?.discovering?this.cancel():this.discover(true);
    this.listener=(changes,area)=>{if(area==='local'&&['model','modelCatalogs','savedProfiles','activeProfileId','apiStyle','endpoint','apiKey','customHeaders','chatgptAccount'].some(k=>k in changes))void this.refresh();};
    this.messageListener=message=>{if(message?.type==='MODEL_CATALOG_STATUS')void this.refresh();};
    chrome.storage.onChanged.addListener(this.listener);chrome.runtime.onMessage.addListener(this.messageListener);
    window.addEventListener('pagehide',()=>{this.closed=true;chrome.storage.onChanged.removeListener(this.listener);chrome.runtime.onMessage.removeListener(this.messageListener);},{once:true});
    void this.refresh();
  }
  setLocked(locked){
    this.locked=Boolean(locked);
    this.select.disabled=this.locked||this.pending||!this.state||!['openai-compatible','chatgpt-plan'].includes(this.state.apiStyle)||!this.state.models.length;
    this.readButton.disabled=this.pending||!this.state?.canDiscover||this.reading&&!this.state.discovering;
  }
  async refresh(){
    const revision=++this.revision;
    try{
      const state=await chrome.runtime.sendMessage({type:'MODEL_STATE'});if(this.closed||revision!==this.revision)return;
      if(!state?.ok)throw new Error(state?.error||'模型列表读取失败');this.state=state;
      const ai=['openai-compatible','chatgpt-plan'].includes(state.apiStyle);
      const options=state.models.map(m=>new Option(state.apiStyle==='chatgpt-plan'?(m.name||m.id):m.id,m.id));
      if(ai&&state.model&&!options.some(o=>o.value===state.model))options.unshift(new Option(state.model,state.model));
      if(!options.length){const placeholder=new Option(ai?(state.discovering?'正在读取上游模型…':'尚无上游模型列表'):'当前为传统翻译 API','');placeholder.disabled=true;options.push(placeholder);}
      this.select.replaceChildren(...options);this.select.value=ai?state.model||'':'';
      if(ai&&!state.model&&state.models.length){const placeholder=new Option('请选择上游模型','');placeholder.disabled=true;this.select.prepend(placeholder);this.select.value='';}
      this.select.title=`${state.apiName} · API 仅在设置中新增或切换。${state.fetchedAt?`列表读取于 ${new Date(state.fetchedAt).toLocaleString()}。`:'首次自动读取，可点击读取重试。'}切换模型会停止当前任务。`;
      this.readButton.hidden=!ai;this.readButton.textContent=state.discovering?'取消':state.fetchedAt?'刷新':'读取';
      this.readButton.title=state.discovering?'取消当前 API 的模型列表读取':'从当前 API 重新读取上游模型';this.readButton.setAttribute('aria-label',this.readButton.title);
      this.field.setAttribute('aria-busy',String(state.discovering));
      this.note.classList.toggle('error',Boolean(state.discoveryError&&state.discoveryCode!=='CANCELLED'));
      this.note.textContent=!ai?'':state.discovering?'正在读取上游模型…可继续使用当前模型。':state.discoveryError?state.discoveryError+(state.models.length?' 已保留上次列表。':''):!state.canDiscover?'请在 API 设置中新增或完善连接。':state.fetchedAt&&!state.models.length?'上游返回空列表，可刷新或在设置中手填模型。':state.fetchedAt?`${state.models.length} 个上游模型${state.truncated?' · 部分列表':''}`:'';
      if(state.apiStyle==='chatgpt-plan')this.note.textContent='正在使用 ChatGPT 计划 · '+this.note.textContent;
      this.note.hidden=!this.note.textContent;this.note.title=this.note.textContent;
      this.onState(state);this.setLocked(this.locked);
      if(state.canDiscover&&!state.fetchedAt&&!state.discoveryAttempted&&!this.reading)void this.discover(false);
    }catch(error){if(!this.closed&&revision===this.revision){this.state=null;this.setLocked(this.locked);this.note.textContent=error.message;this.note.hidden=false;this.note.classList.add('error');}}
  }
  async discover(force){
    const state=this.state;if(!state?.canDiscover||this.reading||this.pending)return;
    this.reading=true;this.setLocked(this.locked);
    try{
      const result=await chrome.runtime.sendMessage({type:'MODEL_DISCOVER',connection:state.connection,force});
      if(!result?.ok)throw new Error(result?.error||'模型列表读取失败');
    }catch(error){if(force&&!this.closed)this.onNotice(error.message,true);}
    finally{this.reading=false;if(!this.closed)await this.refresh();}
  }
  async cancel(){
    if(!this.state?.discovering)return;
    try{await chrome.runtime.sendMessage({type:'MODEL_CANCEL',connection:this.state.connection});}
    catch(error){this.onNotice(error.message,true);}
    finally{if(!this.closed)await this.refresh();}
  }
  async change(){
    const state=this.state,model=this.select.value;if(!state||this.pending)return;
    this.pending=true;this.setLocked(this.locked);this.onPending(true);
    try{const result=await chrome.runtime.sendMessage({type:'MODEL_SELECT',model,connection:state.connection});if(!result?.ok)throw new Error(result?.error||'切换模型失败');this.onNotice(`已切换模型：${model}`);}
    catch(error){this.onNotice(error.message,true);}
    finally{this.pending=false;await this.refresh();this.onPending(false);}
  }
}
