import {renderResearch,createResearchRenderer} from './research-render.mjs';
export async function researchMessage(message) {
  const result=await chrome.runtime.sendMessage(message);if(!result?.ok)throw new Error(result?.error||'研究操作失败。');return result;
}
export function downloadText(name,text,type='text/plain;charset=utf-8') {
  const url=URL.createObjectURL(new Blob([text],{type})),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function codeBlock(result,language) {
  const blocks=Array.from(String(result).matchAll(/```([^\n]*)\n([\s\S]*?)```/g));
  return blocks.find(match=>language==='r'?/^r\s*$/i.test(match[1].trim()):/^(python|py)\s*$/i.test(match[1].trim()))?.[2]?.trim()||'';
}
export class ResearchControls {
  constructor(container,{analyze,stop}) {
    this.container=document.createElement('details');this.container.className='research-controls';this.container.open=document.body.classList.contains('research-page');
    this.container.innerHTML=`<summary class="research-heading"><strong>论文问答</strong><a href="options.html#researchSettings" target="_blank">Skill 与记忆 ↗</a></summary><details class="research-options" id="researchOptions"><summary>分析设置 <span>Skill · 范围 · 可选记忆</span></summary><div class="research-selects"><label>分析 Skill<select id="researchSkill"></select></label><label>材料范围<select id="researchScope"><option value="page">当前页 / 网页材料</option><option value="all">文档全文（不截断正文）</option></select></label><label>研究笔记本<select id="researchNotebook"></select></label></div><label class="memory-choice"><input type="checkbox" id="researchMemory"> 使用跨页面记忆并保存分析结果</label><p class="research-hint" id="memoryHint">默认关闭；开启后仅使用所选笔记本的相关记录，不影响基础翻译。</p></details><div id="paperConversation" class="paper-conversation"></div><p id="currentQuestion" class="current-question" hidden></p><div id="paperOutput" class="paper-output" hidden></div><label class="question-label" for="researchQuestion">向论文提问 · Ctrl + Enter 发送</label><textarea id="researchQuestion" maxlength="2000" rows="3" placeholder="例如：结合图 2 与表 3，作者的结论有哪些证据和局限？留空可生成论文概览。"></textarea><div id="questionPresets" class="question-presets"></div><p id="selectedFiguresHint" class="research-hint">在图表总览中批量选择，即可结合原图分析。</p><div class="research-actions"><button id="analyzePaper" class="primary">分析 / 发送问题</button><button id="stopPaper" hidden>停止分析</button><button id="newConversation">新对话</button><button id="downloadPaper" disabled>导出对话 Markdown</button></div><p id="paperStatus" role="status" class="research-hint">本窗口保留追问上下文，最近 6 轮最多 2.4 万字；跨页面记忆需单独开启。</p><p id="paperElapsed" class="research-hint" hidden></p>`;
    container.prepend(this.container);this.$=id=>this.container.querySelector('#'+id);this.result='';this.turns=[];this.renderer=createResearchRenderer(this.$('paperOutput'));
    this.$('analyzePaper').onclick=analyze;this.$('stopPaper').onclick=stop;
    this.$('downloadPaper').onclick=()=>downloadText('QudadFlow-paper-conversation.md',this.transcript(),'text/markdown;charset=utf-8');
    this.$('newConversation').onclick=()=>{this.clear();this.notice('已开始新对话。所选图表保留；不会删除跨页面记忆。');};
    this.$('researchQuestion').onkeydown=event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'&&!this.$('analyzePaper').disabled){event.preventDefault();analyze();}};
    for(const [label,question] of [['核心结论','这篇论文的核心问题、研究设计、主要证据和局限是什么？请按原文章节标明出处。'],['结合图表','结合所选图表与正文，逐图说明其证据、统计量、与作者结论的关系及不确定性。'],['质疑证据','哪些结论证据不足？请结合方法、样本、偏倚和所选图表提出可验证的问题。']]){const button=document.createElement('button');button.textContent=label;button.onclick=()=>{this.$('researchQuestion').value=question;this.$('researchQuestion').focus();};this.$('questionPresets').append(button);}
    this.$('researchMemory').onchange=()=>this.savePreference({enabled:this.$('researchMemory').checked});
    this.$('researchNotebook').onchange=()=>this.savePreference({notebookId:this.$('researchNotebook').value});
    this.ready=this.refresh();
    window.addEventListener('focus',()=>{if(!this.busy)this.ready=this.refresh();});
  }
  async refresh() {
    try{
      const state=await researchMessage({type:'RESEARCH_STATE'}),skill=this.$('researchSkill'),previous=skill.value;
      skill.replaceChildren(...state.skills.map(s=>new Option(s.name,s.id)));if(state.skills.some(s=>s.id===previous))skill.value=previous;
      this.$('researchNotebook').replaceChildren(...state.notebooks.map(n=>new Option(n.name,n.id)));this.$('researchNotebook').value=state.preferences.notebookId;
      this.$('researchMemory').checked=state.preferences.enabled;
      this.$('memoryHint').textContent=`可选跨页面记忆 · 共 ${state.count} 条 · 每次最多带入 ${state.preferences.contextChars} 字。开启后向所选 AI 发送相关记录，并保存本次分析；图片与密钥不进入记忆。`;
      this.error='';
    }catch(error){this.error=error.message;this.notice(error.message,true);}
  }
  savePreference(values) {
    this.ready=(this.ready||Promise.resolve()).then(()=>researchMessage({type:'RESEARCH_PREFS',values})).then(()=>this.refresh()).catch(error=>{this.error=error.message;this.notice(error.message,true);});return this.ready;
  }
  async options(){await this.ready;if(this.error)throw new Error(this.error);return {skillId:this.$('researchSkill').value,useMemory:this.$('researchMemory').checked,notebookId:this.$('researchNotebook').value,question:this.$('researchQuestion').value};}
  notice(text,error=false){this.$('paperStatus').textContent=text;this.$('paperStatus').classList.toggle('error',error);}
  history(){let chars=0;const history=[];for(const turn of this.turns.filter(t=>t.complete).slice(-6).reverse()){const question=turn.question.slice(0,2000),room=24000-chars-question.length;if(room<=0)break;const answer=turn.answer.slice(0,Math.min(12000,room));history.unshift({question,answer});chars+=question.length+answer.length;}return history;}
  begin(question,figures=[]){
    this.finish();if(this.active){const details=document.createElement('details'),summary=document.createElement('summary'),answer=document.createElement('div');details.className='research-turn';summary.textContent=this.active.question+(this.active.complete?'':' · 未完成');renderResearch(answer,this.active.answer);details.append(summary,answer);this.$('paperConversation').append(details);}
    this.active={question:question.trim()||'概览论文的主要问题、证据与局限',answer:'',complete:false,figures};this.turns.push(this.active);
    if(this.turns.length>20){this.turns.shift();this.$('paperConversation').firstElementChild?.remove();}
    this.result='';this.renderer.cancel();this.$('paperOutput').replaceChildren();this.$('paperOutput').hidden=true;
    this.$('currentQuestion').textContent=this.active.question+(figures.length?' · 结合 '+figures.join('、'):'');this.$('currentQuestion').hidden=false;
    this.started=Date.now();this.$('paperElapsed').hidden=false;const tick=()=>{this.$('paperElapsed').textContent=`已等待 ${Math.floor((Date.now()-this.started)/1000)} 秒 · ${this.result?'正在接收回答':'等待模型返回'} · 不设分析倒计时，可随时停止`;};tick();this.timer=setInterval(tick,1000);
  }
  output(text,complete=false){
    this.result=text;if(this.active){this.active.answer=text;this.active.complete=complete;}
    this.$('paperOutput').hidden=!text;this.$('downloadPaper').disabled=!this.turns.some(t=>t.answer)&&!text;
    this.renderer.update(text,complete);
    if(complete){this.finish();this.$('researchQuestion').value='';}
  }
  finish(){clearInterval(this.timer);this.timer=null;this.renderer.flush();if(this.started){this.$('paperElapsed').textContent=`本次用时 ${Math.floor((Date.now()-this.started)/1000)} 秒 · 当前窗口最多保留 20 轮，可随时导出`;this.started=0;}}
  transcript(){return '# QudadFlow Translator · Paper conversation\n\n'+this.turns.map(t=>'## '+t.question+(t.complete?'':'（未完成）')+'\n\n'+(t.figures.length?'Figures: '+t.figures.join(', ')+'\n\n':'')+t.answer).join('\n\n---\n\n');}
  clear(){this.finish();this.renderer.cancel();this.turns=[];this.active=null;this.result='';this.$('paperConversation').replaceChildren();this.$('paperOutput').replaceChildren();this.$('paperOutput').hidden=true;this.$('currentQuestion').hidden=true;this.$('paperElapsed').hidden=true;this.$('downloadPaper').disabled=true;}
  controls(busy,hasAI,textBusy){this.busy=busy;this.$('analyzePaper').disabled=busy||!hasAI||textBusy;this.$('stopPaper').hidden=!busy;for(const id of ['researchSkill','researchNotebook','researchMemory','researchQuestion','researchScope','newConversation'])this.$(id).disabled=busy;for(const button of this.$('questionPresets').children)button.disabled=busy;}
}
