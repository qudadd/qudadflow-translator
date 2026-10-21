import {FigureWorkflow} from './src/figure-workflow.mjs';
import {researchMessage} from './src/research-ui.mjs';
const $=id=>document.getElementById(id),pending=new Map();let port,sequence=0,captureId='',source={title:'粘贴的论文材料',url:'',page:'web'};
function connect(){
  if(port)return port;const connection=chrome.runtime.connect({name:'qudadflow-document'});port=connection;
  connection.onMessage.addListener(message=>{const task=pending.get(message.requestId);if(!task)return;if(message.type==='PROGRESS')task.progress?.(message.translation);if(message.type==='RESULT'){pending.delete(message.requestId);message.ok?task.resolve(message):task.reject(new Error(message.error));}});
  connection.onDisconnect.addListener(()=>{void chrome.runtime.lastError;if(port===connection)port=null;for(const [id,task] of pending)if(task.connection===connection){pending.delete(id);task.reject(new Error('扩展连接断开，请重试。'));}});return connection;
}
function request(imageData,profileId,onProgress,extra={}) {
  return new Promise((resolve,reject)=>{const requestId='research-'+(++sequence),connection=connect();pending.set(requestId,{resolve,reject,progress:onProgress,connection});try{connection.postMessage({type:'FIGURE_ANALYZE',requestId,imageData,profileId,...extra});}catch{pending.delete(requestId);reject(new Error('扩展已重新加载，请刷新此页。'));}});
}
function cancel(){for(const [id,task] of pending){try{task.connection.postMessage({type:'CANCEL',requestId:id});}catch{}task.reject(new Error('分析已取消。'));}pending.clear();port?.disconnect();port=null;}
const workflow=new FigureWorkflow({request,cancel,getSource:async()=>({...source,text:$('paperMaterial').value}),onBusy:busy=>{$('paperMaterial').disabled=busy;for(const b of $('remoteFigures').querySelectorAll('button'))b.disabled=busy;}});
workflow.setContext({source,text:''});workflow.research.$('researchScope').parentElement.hidden=true;
$('paperMaterial').addEventListener('input',()=>{workflow.context.text=$('paperMaterial').value;});
const heartbeat=setInterval(()=>{if(pending.size)try{port?.postMessage({type:'PING'});}catch{}},20000);
window.addEventListener('pagehide',()=>{clearInterval(heartbeat);cancel();});
chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local'||!Object.keys(changes).some(k=>['apiStyle','endpoint','apiKey','model','sourceLanguage','targetLanguage','temperature','streamOpenAi','requestTimeoutSeconds','customHeaders','savedProfiles'].includes(k)))return;cancel();workflow.clearResults();workflow.research.notice('API 配置已改变，旧结果已清除，请重新分析。');});
async function load(){
  captureId=new URLSearchParams(location.hash.slice(1)).get('capture')||'';if(!captureId)return;
  const capture=await researchMessage({type:'RESEARCH_GET_CAPTURE',id:captureId});source={title:capture.title,url:capture.url,page:'web'};
  $('paperTitle').textContent=capture.title||'论文网页';$('paperMaterial').value=capture.text;
  if(capture.url){$('paperSource').href=capture.url;$('paperSource').hidden=false;}
  $('captureStatus').textContent=`已提取 ${capture.text.length} 字和 ${capture.figures.length} 个图表候选。${capture.truncated?'材料达到上限，未包含完整论文。':''}${capture.captureNotice||''} 打开与提取不调用 AI。`;
  workflow.setContext({source,text:capture.text});
  capture.figures.forEach((figure,index)=>{
    if(figure.data){workflow.add(figure.data,`网页图 ${index+1} · ${figure.kind}`,`web-${index}`,figure.caption,source);return;}
    const card=document.createElement('div');card.className='remote-figure';const label=document.createElement('p');label.textContent=figure.caption;card.append(label);
    if(figure.src){const url=new URL(figure.src),button=document.createElement('button');button.textContent='载入原图 · '+url.hostname;
      button.onclick=async()=>{const permission=chrome.permissions.request({origins:[`${url.protocol}//${url.hostname}/*`]});button.disabled=true;try{if(!await permission)throw new Error('未获得图片来源权限。可在原网页显示完整图表后重新提取。');const result=await researchMessage({type:'RESEARCH_IMAGE_FETCH',captureId,index});workflow.add(result.data,`网页图 ${index+1}`,`web-${index}`,figure.caption,source);card.remove();}catch(error){label.textContent=figure.caption+'\n'+error.message;button.disabled=false;}};card.append(button);
    }else{const note=document.createElement('small');note.textContent='请将该 SVG/Canvas 图表完整滚动到当前视区，再从扩展重新提取。';card.append(note);}
    $('remoteFigures').append(card);
  });
}
load().catch(error=>{$('captureStatus').textContent=error.message;});
