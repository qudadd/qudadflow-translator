import {researchMessage} from './research-ui.mjs';
// One bounded local snapshot per exact paper URL. Never saves provider settings.
export async function resumeResearchSession({id,workflow,state}){
  const $=key=>document.getElementById(key),status=document.createElement('small');status.id='researchSaveStatus';status.setAttribute('role','status');
  status.title='仅保存在当前浏览器本地；保留 30 天，最多 20 篇，总量上限 256 MB。仅发送问题时才调用 AI。';
  document.querySelector('.window-actions').prepend(status);
  const forget=document.createElement('button');forget.id='forgetPaperSession';forget.textContent='清除本页记录并关闭';forget.title='删除这篇论文在当前浏览器保存的草稿、对话、图片和代码；不会清除跨页面笔记本。';document.querySelector('.paper-answer-tools').append(forget);
  let enabled=false,timer,dirty=0,saved=0,saving=false;
  const viewIds=['sourcePanel','tablePanel','researchOptions','coveragePanel','paperHistory','questionFigures','figureWorkflow'];
  const scrollNodes=()=>[$('figure-panel-analysis'),workflow.workbench.answers,$('sourcePreview'),document.scrollingElement,workflow.research.$('paperChatWindow')];
  const snapshot=()=>({version:1,material:$('paperMaterial').value,...workflow.snapshot(),panels:{...Object.fromEntries(viewIds.map(key=>[key,Boolean($(key)?.open)])),materialRead:$('paperMaterial').hidden},scroll:scrollNodes().map(node=>node?.scrollTop||0)});
  const reportError=error=>{status.textContent='保存失败 · 可导出对话';status.dataset.state='error';status.title=error.message+'；当前窗口内容保留。';};
  async function write(value,revision){
    try{await researchMessage({type:'RESEARCH_WORKSPACE_SAVE',id,state:value});saved=revision;if(saved===dirty){status.textContent='已保存到本地';status.dataset.state='saved';status.title='本页草稿、对话、图表和代码已保存。保留 30 天，最多 20 篇，总量上限 256 MB；不会自动发送给 AI。';}}
    catch(error){reportError(error);}
  }
  async function flush(){
    clearTimeout(timer);timer=null;if(!enabled||saving||dirty===saved)return;saving=true;
    const revision=dirty;try{await write(snapshot(),revision);}catch(error){reportError(error);}finally{saving=false;if(dirty>revision)timer=setTimeout(flush,400);}
  }
  const schedule=()=>{if(!enabled)return;dirty++;status.textContent='正在保存…';status.dataset.state='saving';if(!timer&&!saving)timer=setTimeout(flush,workflow.busy?1500:300);};
  forget.onclick=async()=>{enabled=false;clearTimeout(timer);forget.disabled=true;workflow.invalidate();workflow.cancel();try{await researchMessage({type:'RESEARCH_DROP_CAPTURE',id});window.close();}catch(error){enabled=true;forget.disabled=false;reportError(error);}};
  if(state){
    $('paperMaterial').value=state.material;workflow.context.text=state.material;$('materialCount').textContent=state.material.length+' 字';
    await workflow.restore(state);
    for(const key of viewIds)if($(key)&&typeof state.panels?.[key]==='boolean')$(key).open=state.panels[key];
    if(typeof state.panels?.materialRead==='boolean'){$('paperMaterial').hidden=state.panels.materialRead;$('sourcePreview').hidden=!state.panels.materialRead;$('editMaterial').textContent=state.panels.materialRead?'编辑材料':'阅读材料';}
    if(!$('sourcePreview').hidden){const {renderResearch}=await import('./research-render.mjs');renderResearch($('sourcePreview'),state.material);}
    requestAnimationFrame(()=>scrollNodes().forEach((node,index)=>{if(node)node.scrollTop=state.scroll?.[index]||0;}));
  }
  enabled=true;workflow.onChange=schedule;workflow.research.onChange=schedule;
  for(const event of ['input','change','click','toggle'])document.addEventListener(event,schedule,true);
  document.addEventListener('scroll',schedule,{capture:true,passive:true});
  window.addEventListener('pagehide',()=>{clearTimeout(timer);if(!enabled)return;enabled=false;const value=snapshot();void researchMessage({type:'RESEARCH_WORKSPACE_SAVE',id,state:value}).catch(()=>{});});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)void flush();});
  schedule();document.body.dataset.sessionReady='true';
  return {flush};
}
