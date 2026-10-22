import {FigureWorkflow} from './src/figure-workflow.mjs';
import {researchMessage} from './src/research-ui.mjs';
import {renderResearch} from './src/research-render.mjs';
import {assessResearchCapture,researchIdentity} from './src/research-coverage.mjs';
const $=id=>document.getElementById(id),pending=new Map();let port,sequence=0,captureId='',canSupplement=false,source={title:'粘贴的论文材料',url:'',page:'web'};
function connect(){
  if(port)return port;const connection=chrome.runtime.connect({name:'qudadflow-document'});port=connection;
  connection.onMessage.addListener(message=>{const task=pending.get(message.requestId);if(!task)return;if(message.type==='PROGRESS')task.progress?.(message.translation);if(message.type==='RESULT'){pending.delete(message.requestId);message.ok?task.resolve(message):task.reject(new Error(message.error));}});
  connection.onDisconnect.addListener(()=>{void chrome.runtime.lastError;if(port===connection)port=null;for(const [id,task] of pending)if(task.connection===connection){pending.delete(id);task.reject(new Error('扩展连接断开，请重试。'));}});return connection;
}
function request(imageData,profileId,onProgress,extra={}) {
  return new Promise((resolve,reject)=>{const requestId='research-'+(++sequence),connection=connect();pending.set(requestId,{resolve,reject,progress:onProgress,connection});try{connection.postMessage({type:'FIGURE_ANALYZE',requestId,imageData,profileId,...extra});}catch{pending.delete(requestId);reject(new Error('扩展已重新加载，请刷新此页。'));}});
}
function cancel(){for(const [id,task] of pending){try{task.connection.postMessage({type:'CANCEL',requestId:id});}catch{}task.reject(new Error('分析已取消。'));}pending.clear();port?.disconnect();port=null;}
const workflow=new FigureWorkflow({request,cancel,getSource:async()=>({...source,text:$('paperMaterial').value}),onBusy:busy=>{$('paperMaterial').disabled=busy;$('editMaterial').disabled=busy;$('loadAllFigures').disabled=busy;$('focusResearchSource').disabled=$('supplementResearchView').disabled=busy||!canSupplement;for(const b of document.querySelectorAll('#remoteFigures button,#tablePanel button'))b.disabled=busy;}});
workflow.setContext({source,text:''});workflow.research.$('researchScope').parentElement.hidden=true;
function addSupplement(figure){return workflow.add(figure.data,'补图 · 当前视区','supplement-'+figure.key,figure.caption,source,{supplement:true});}
function showCoverage(capture){
  const {issues}=assessResearchCapture(capture);$('captureReview').hidden=false;$('coveragePanel').open=issues.length>0;
  $('coverageTitle').textContent=issues.length?`本地提取完成 · ${issues.length} 项待核对`:'本地提取完成 · 未发现明确的编号缺口';
  $('coverageIssues').replaceChildren();
  for(const text of issues.length?issues.map(issue=>issue.text):['仍可补充漏项；没有提取到表格，也可能是论文没有表格。']){const item=document.createElement('li');item.textContent=text;$('coverageIssues').append(item);}
  canSupplement=capture.canSupplement===true;
  if(!canSupplement)$('supplementStatus').textContent='这份材料未绑定原论文，可导入截图，或从原文重新打开论文窗口。';
  workflow.controls();
}
for(const [id,type]of [['focusResearchSource','RESEARCH_FOCUS_SOURCE'],['supplementResearchView','RESEARCH_SUPPLEMENT_VIEW']])$(id).onclick=async()=>{
  if(!canSupplement||workflow.busy||workflow.importing||workflow.externalBusy)return;
  const generation=workflow.generation,token={};workflow.externalBusy=token;workflow.controls();$('supplementStatus').classList.remove('error');
  $('supplementStatus').textContent=type==='RESEARCH_FOCUS_SOURCE'?'正在返回原论文…':'正在截取原论文当前视区，只在本地预览…';
  try{
    const result=await researchMessage({type,id:captureId});if(generation!==workflow.generation)return;
    if(type==='RESEARCH_FOCUS_SOURCE'){$('supplementStatus').textContent='在原文展开并完整显示图表，再回到此窗口点击“补入当前视区截图”。';return;}
    const added=addSupplement(result.figure);$('figureWorkflow').open=true;
    $('supplementStatus').textContent=added?'截图已加入本窗口。核对预览后，点击卡片“用 AI 补读图表”；已有问答与原始表格保留。':'相同截图已在本窗口，未重复添加。可滚动原文后补充其他图表。';
    const card=workflow.items.find(item=>item.key==='supplement-'+result.figure.key)?.card;if(card){card.scrollIntoView({behavior:'smooth',block:'center'});card.focus({preventScroll:true});}
  }catch(error){if(generation===workflow.generation){$('supplementStatus').textContent=error.message;$('supplementStatus').classList.add('error');}}
  finally{if(workflow.externalBusy===token){workflow.externalBusy=null;workflow.controls();}}
};
$('paperMaterial').addEventListener('input',()=>{workflow.context.text=$('paperMaterial').value;$('materialCount').textContent=$('paperMaterial').value.length+' 字';});
$('editMaterial').onclick=()=>{const read=!$('paperMaterial').hidden;$('paperMaterial').hidden=read;$('sourcePreview').hidden=!read;$('editMaterial').textContent=read?'编辑材料':'阅读材料';if(read)renderResearch($('sourcePreview'),$('paperMaterial').value);};
$('resizeResearch').onclick=async()=>{try{const current=await chrome.windows.getCurrent(),maximized=current.state!=='maximized';await chrome.windows.update(current.id,{state:maximized?'maximized':'normal'});$('resizeResearch').textContent=maximized?'还原窗口':'展开窗口';}catch(error){$('captureStatus').textContent='窗口调整失败：'+error.message;}};
const heartbeat=setInterval(()=>{if(pending.size)try{port?.postMessage({type:'PING'});}catch{}},20000);
window.addEventListener('pagehide',()=>{clearInterval(heartbeat);cancel();});
chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local'||!Object.keys(changes).some(k=>['apiStyle','endpoint','apiKey','model','sourceLanguage','targetLanguage','temperature','streamOpenAi','customHeaders','savedProfiles'].includes(k)))return;cancel();workflow.clearResults();workflow.research.notice('API 配置已改变，旧结果已清除，请重新分析。');});
async function load(){
  captureId=new URLSearchParams(location.hash.slice(1)).get('capture')||'';if(!captureId)return;
  const capture=await researchMessage({type:'RESEARCH_GET_CAPTURE',id:captureId});source={title:capture.title,url:capture.url,page:'web'};
  // Preserve capture indices for original-image fetches while hiding legacy
  // generic webpage/viewport images. Explicit user supplements stay separate.
  const paperFigure=figure=>figure.kind!=='viewport'&&(figure.paperFigure===true||!figure.captionInferred&&(researchIdentity(figure.caption)||figure.captionSource==='caption'||/^(?:chart|graph|scheme)\b/i.test(figure.caption||'')));
  const paperFigures=capture.figures.filter(paperFigure);
  const tables=Array.isArray(capture.tables)?capture.tables:[],imageTableKeys=capture.figures.flatMap((figure,index)=>!figure.captionInferred&&figure.kind!=='viewport'&&researchIdentity(figure.caption)?.kind==='table'?[`web-${index}`]:[]);
  showCoverage({...capture,figures:paperFigures});
  $('paperTitle').textContent=capture.title||'论文网页';$('paperMaterial').value=capture.text;
  if(capture.url){$('paperSource').href=capture.url;$('paperSource').hidden=false;}
  $('captureStatus').textContent=`已提取 ${capture.text.length.toLocaleString()} 字 · ${paperFigures.length} 幅图表候选${imageTableKeys.length?`（含 ${imageTableKeys.length} 张图片表格）`:''} · ${tables.length} 张文字表格。${capture.truncated?'部分网页结构未能展开，请核对材料完整性。':''}${capture.figuresTruncated?'图片候选超过 100 个，已截取前 100 个。':''}${capture.captureNotice||''} 默认只展示论文图表；可批量载入原图，勾选后参与问答。`;
  $('materialCount').textContent=capture.text.length+' 字';$('editMaterial').click();if(innerWidth<1150)$('sourcePanel').open=false;
  const tablePanel=$('tablePanel'),tableList=$('paperTables');tableList.replaceChildren();tablePanel.hidden=false;$('tableCount').textContent=`${tables.length} 张文字表格${imageTableKeys.length?` · ${imageTableKeys.length} 张图片表格`:''}`;
  $('tableHint').textContent=(tables.length?'这些文字表格已随正文参与论文问答，无需逐张打开或勾选。可展开全部核对内容。':'本地未提取到文字表格。')+(imageTableKeys.length?'已找到的图片表格保留了编号和图注，可一键选中并载入高清原图，再用 AI 转写和分析；数值需对照原图核验。':tables.length?'':'若原文确有表格，可在上方补图或导入局部截图，核对后用 AI 补读。');
  const tableTools=document.createElement('div');tableTools.className='figure-picker-tools';tableTools.hidden=!tables.length&&!imageTableKeys.length;
  if(tables.length)for(const [text,open]of [['展开全部表格',true],['收起全部表格',false]]){const button=document.createElement('button');button.textContent=text;button.onclick=()=>{for(const table of tableList.querySelectorAll('details'))table.open=open;};tableTools.append(button);}
  if(imageTableKeys.length){const button=document.createElement('button');button.id='selectImageTables';button.textContent='选中图片表格';button.title='替换当前选择，不会下载图片或调用 AI';button.onclick=()=>{workflow.picker.$('figureSearch').value='';workflow.picker.selected=new Set(imageTableKeys.filter(key=>workflow.picker.selectable(workflow.picker.records.get(key)||{})));workflow.picker.changed();$('figureWorkflow').open=true;workflow.picker.container.open=true;workflow.picker.$('loadSelectedFigures').scrollIntoView({behavior:'smooth',block:'center'});workflow.picker.$('loadSelectedFigures').focus({preventScroll:true});};tableTools.append(button);}
  tableList.before(tableTools);
  for(const [index,table] of tables.entries()){
    const card=document.createElement('details');card.className='paper-table-card';card.open=index===0;
    const label=table.caption||`表 ${index+1}`,summary=document.createElement('summary'),title=document.createElement('span'),meta=document.createElement('small');title.textContent=label;meta.textContent=`${table.rows||'?'} 行 · ${table.columns||'?'} 列${table.truncated?' · 已截断':''}`;summary.append(title,meta);
    const body=document.createElement('div');body.className='paper-table-preview research-markdown';
    if(table.markdown)renderResearch(body,table.markdown,{tableGrid:table.grid,tableCaption:label,tableNotes:table.notes,truncated:table.truncated});else body.textContent='旧版提取记录未保存表格预览，请返回论文网页重新提取。';
    if(table.notes){const notes=document.createElement('p');notes.className='table-notes';notes.textContent=table.notes;body.append(notes);}
    const ask=document.createElement('button');ask.className='ask-table';ask.textContent='结合此表提问';ask.onclick=()=>{workflow.research.$('researchQuestion').value=`结合${label}与正文，解释表中的分组、数值、统计结果及其局限。`;$('figureWorkflow').open=true;workflow.research.$('researchQuestion').focus();};
    card.append(summary,body,ask);tableList.append(card);
  }
  if(capture.attachments?.length){const note=document.createElement('p');note.textContent='外部附件（未读取内容，不计入本次分析）';$('paperAttachments').append(note);for(const attachment of capture.attachments){const link=document.createElement('a');link.href=attachment.url;link.textContent=attachment.label;link.target='_blank';link.rel='noopener noreferrer';$('paperAttachments').append(link);}}
  workflow.setContext({source,text:capture.text});
  const remote=[];
  async function loadRemote(keys){
    if(workflow.busy||workflow.importing||workflow.externalBusy||workflow.textBusy)return;
    const todo=remote.filter(item=>!item.loaded&&item.canLoad&&keys.includes(item.key));if(!todo.length)return;
    const generation=workflow.generation,context=workflow.context,token={};workflow.externalBusy=token;workflow.controls();
    const current=()=>generation===workflow.generation&&context===workflow.context&&workflow.externalBusy===token;
    let added=0,failed=0;
    try{
      // Requested before the first await so the user's click grants the origins.
      const permission=chrome.permissions.request({origins:[...new Set(todo.map(item=>item.origin))]});
      if(!await permission)throw new Error('未获得原图来源权限，可再次点击载入重试。');
      if(!current())return;
      for(const [position,item] of todo.entries()){
        item.loadToken=token;item.loading=true;item.error='';workflow.controls();$('imageLoadStatus').textContent=`正在载入 ${position+1}/${todo.length}，不调用 AI…`;workflow.notice($('imageLoadStatus').textContent);
        try{
          const result=await researchMessage({type:'RESEARCH_IMAGE_FETCH',captureId,index:item.index});if(!current())return;
          const accepted=workflow.add(result.data,item.label,item.key,item.caption,source);
          if(!accepted&&!workflow.items.some(loaded=>loaded.key===item.key))throw new Error('原图未加入，请重试。');
          item.loaded=true;item.card.remove();added++;
        }catch(error){if(!current())return;item.error=error.message;item.message.textContent=item.caption+'\n'+error.message;failed++;}
        finally{if(item.loadToken===token){item.loading=false;delete item.loadToken;workflow.controls();}}
        workflow.controls();
      }
      const message=`已载入 ${added} 张原图${failed?`，${failed} 张失败（选择已保留，可重试）`:''}。可在总览选择后批量解读或结合正文提问。`;
      $('imageLoadStatus').textContent=message;workflow.notice(message,failed>0);
    }catch(error){if(current()){$('imageLoadStatus').textContent=error.message;workflow.notice(error.message,true);}}
    finally{if(workflow.externalBusy===token){workflow.externalBusy=null;$('loadAllFigures').hidden=!remote.some(item=>!item.loaded&&item.canLoad);workflow.controls();}}
  }
  workflow.loadCandidates=keys=>loadRemote(keys);
  capture.figures.forEach((figure,index)=>{
    if(!paperFigure(figure))return;
    const figureLabel=researchIdentity(figure.caption)?.label||`论文图 ${index+1}`;
    if(figure.data&&!figure.previewOnly)try{workflow.add(figure.data,figureLabel,`web-${index}`,figure.caption,source);return;}catch{}
    const card=document.createElement('div');card.className='remote-figure';const label=document.createElement('p');label.textContent=figure.caption;card.append(label);
    const item={key:`web-${index}`,index,label:figureLabel,caption:figure.caption,previewData:figure.previewOnly?figure.data:'',loaded:false,loading:false,card,message:label,canLoad:Boolean(figure.src)};remote.push(item);workflow.candidates.set(item.key,item);
    if(figure.src){const url=new URL(figure.src),button=document.createElement('button');button.textContent='载入原图 · '+url.hostname;
      item.origin=`${url.protocol}//${url.hostname}/*`;item.hostname=url.hostname;
      button.onclick=()=>loadRemote([item.key]);card.append(button);
    }else{const note=document.createElement('small');note.textContent='请在原文完整显示此图表，再点击上方“补入当前视区截图”，或导入局部截图。';card.append(note);}
    $('remoteFigures').append(card);
  });
  for(const figure of capture.supplements||[])try{addSupplement(figure);}catch(error){$('supplementStatus').textContent=error.message;}
  $('loadAllFigures').hidden=!remote.some(item=>item.canLoad);
  $('loadAllFigures').onclick=()=>loadRemote(remote.map(item=>item.key));
  workflow.controls();
}
load().catch(error=>{$('captureStatus').textContent=error.message;});
