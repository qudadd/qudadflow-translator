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
    this.container.innerHTML=`<summary class="research-heading"><strong>论文分析</strong><a href="options.html#researchSettings" target="_blank">管理 Skill 与记忆 ↗</a></summary><div class="research-selects"><label>分析 Skill<select id="researchSkill"></select></label><label>材料范围<select id="researchScope"><option value="page">当前页 / 网页材料</option><option value="all">文档全文（最多 6 万字）</option></select></label><label>研究笔记本<select id="researchNotebook"></select></label></div><label class="memory-choice"><input type="checkbox" id="researchMemory"> 使用跨页面记忆并保存分析结果</label><p class="research-hint" id="memoryHint">默认关闭；开启后仅使用所选笔记本的相关记录，不影响基础翻译。</p><label class="question-label">关注的问题（可选）<input id="researchQuestion" maxlength="2000" placeholder="例如：图 2 的证据是否支持作者的因果结论？"></label><div class="research-actions"><button id="analyzePaper" class="primary">分析论文文字</button><button id="stopPaper" hidden>停止分析</button><button id="downloadPaper" disabled>导出分析 Markdown</button></div><p id="paperStatus" role="status" class="research-hint">只分析你打开的材料；AI 配置沿用下方选择。</p><pre id="paperOutput" class="paper-output" hidden></pre>`;
    container.prepend(this.container);this.$=id=>this.container.querySelector('#'+id);this.result='';
    this.$('analyzePaper').onclick=analyze;this.$('stopPaper').onclick=stop;
    this.$('downloadPaper').onclick=()=>downloadText('QudadFlow-paper-analysis.md',this.result,'text/markdown;charset=utf-8');
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
  output(text,complete=false){this.$('paperOutput').hidden=!text;this.$('paperOutput').textContent=text;if(complete){this.result=text;this.$('downloadPaper').disabled=false;}}
  clear(){this.result='';this.output('');this.$('downloadPaper').disabled=true;}
  controls(busy,hasAI,textBusy){this.busy=busy;this.$('analyzePaper').disabled=busy||!hasAI||textBusy;this.$('stopPaper').hidden=!busy;for(const id of ['researchSkill','researchNotebook','researchMemory','researchQuestion','researchScope'])this.$(id).disabled=busy;}
}
