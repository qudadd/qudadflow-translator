/* Research text is separate from credentials. IndexedDB stores individual bounded records. */
globalThis.QFResearch = (() => {
  const BUILTINS = [
    {id:'paper',name:'论文精读 · 问题、方法与证据',instructions:'Identify the research question, contribution, study design, data, methods, main results, limitations and reproducibility gaps. Cite the supplied section/figure labels or brief quotes for claims. Separate author claims from your assessment. State which parts of the paper are missing.'},
    {id:'methods',name:'方法审查 · 统计与可复现性',instructions:'Audit design, controls, sample size, statistical methods, uncertainty, multiple testing, validation, confounders, data/code availability and reproducibility. Distinguish missing information from demonstrated flaws. Give a prioritized checklist tied to supplied evidence.'},
    {id:'figure',name:'图表解读 · 标签、数值与结论',instructions:'Identify visible figures and tables. Transcribe and translate visible labels, titles, legends, axis labels and units. For tables, output a Markdown table preserving rows, columns, multi-level headers, numeric values and footnotes. Mark unreadable cells; never invent missing values. Explain chart type, comparisons, trends, uncertainty and limitations. Distinguish observations from interpretation and causality. Mark unreadable labels and estimated numerical values.'}
  ];
  const DEFAULT = {enabled:false,notebookId:'default',retentionDays:90,contextChars:6000};
  let opened, queue = Promise.resolve();
  const queued = fn => {const result=queue.then(fn);queue=result.catch(()=>{});return result;};
  function db() {
    if(!opened) opened=new Promise((resolve,reject)=>{
      const request=indexedDB.open('qudadflow-research',1);
      request.onupgradeneeded=()=>{
        const database=request.result;
        for(const name of ['meta','notebooks','skills','captures'])database.createObjectStore(name,{keyPath:'id'});
        const entries=database.createObjectStore('entries',{keyPath:'id'});entries.createIndex('notebookId','notebookId');entries.createIndex('updatedAt','updatedAt');
      };
      request.onsuccess=()=>{request.result.onversionchange=()=>{request.result.close();opened=null;};resolve(request.result);};
      request.onerror=()=>{opened=null;reject(new Error('无法打开研究存储，请检查浏览器磁盘空间。'));};
    });
    return opened;
  }
  async function read(name,key) {const database=await db();return new Promise((resolve,reject)=>{const request=database.transaction(name).objectStore(name)[key===undefined?'getAll':'get'](key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
  async function write(changes) {
    const database=await db();
    return new Promise((resolve,reject)=>{
      const tx=database.transaction([...new Set(changes.map(c=>c.store))],'readwrite');
      for(const c of changes){const store=tx.objectStore(c.store);if(c.remove)store.delete(c.id);else store.put(c.value);}
      tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(new Error('研究存储写入失败，请导出或清理后重试。'));
    });
  }
  const text=(value,max)=>String(value??'').slice(0,max);
  function source(value={}) {let url='';try{const parsed=new URL(value.url);if(/^https?:$/.test(parsed.protocol)&&!parsed.username&&!parsed.password)url=parsed.origin+parsed.pathname;}catch{}return {title:text(value.title,300),url:text(url,1000),page:text(value.page,50)};}
  async function initialize() {
    if(!await read('notebooks','default'))await write([{store:'notebooks',value:{id:'default',name:'我的研究',createdAt:Date.now()}}]);
    const meta=await read('meta','preferences');return {id:'preferences',...DEFAULT,epoch:0,...meta};
  }
  async function cleanup(prefs) {
    const now=Date.now(),entries=await read('entries'),captures=await read('captures');
    const changes=entries.filter(e=>prefs.retentionDays&&now-e.updatedAt>prefs.retentionDays*86400000).map(e=>({store:'entries',id:e.id,remove:true}));
    changes.push(...captures.filter(c=>c.expiresAt<now).map(c=>({store:'captures',id:c.id,remove:true})));
    if(changes.length)await write(changes);
  }
  async function state() {
    const prefs=await initialize();await cleanup(prefs);
    const [notebooks,skills,entries]=await Promise.all([read('notebooks'),read('skills'),read('entries')]);
    return {preferences:prefs,notebooks,skills:[...BUILTINS.map(s=>({...s,builtin:true})),...skills],count:entries.length,chars:entries.reduce((n,e)=>n+e.content.length,0)};
  }
  async function action(message) {
    const prefs=await initialize();await cleanup(prefs);
    switch(message.type) {
      case 'RESEARCH_STATE': return state();
      case 'RESEARCH_PREFS': {
        const input=message.values||{},next={...prefs};
        if(typeof input.enabled==='boolean')next.enabled=input.enabled;
        if(input.notebookId!==undefined){if(!await read('notebooks',input.notebookId))throw new Error('研究笔记本不存在。');next.notebookId=input.notebookId;}
        if([0,7,30,90].includes(input.retentionDays))next.retentionDays=input.retentionDays;
        if([4000,6000,12000].includes(input.contextChars))next.contextChars=input.contextChars;
        if(prefs.enabled&&!next.enabled)next.epoch++;
        await write([{store:'meta',value:next}]);return state();
      }
      case 'RESEARCH_NOTEBOOK_SAVE': {
        const name=text(message.name,60).trim();if(!name)throw new Error('请填写笔记本名称。');
        const list=await read('notebooks');if(!message.id&&list.length>=20)throw new Error('最多 20 个笔记本。');
        if(message.id&&!list.some(n=>n.id===message.id))throw new Error('笔记本不存在。');
        await write([{store:'notebooks',value:{id:message.id||crypto.randomUUID(),name,createdAt:Date.now()}}]);return state();
      }
      case 'RESEARCH_NOTEBOOK_DELETE': {
        if(message.id==='default')throw new Error('默认笔记本可清空，不能删除。');
        const entries=await read('entries');await write([{store:'notebooks',id:message.id,remove:true},...entries.filter(e=>e.notebookId===message.id).map(e=>({store:'entries',id:e.id,remove:true})),{store:'meta',value:{...prefs,epoch:prefs.epoch+1,notebookId:prefs.notebookId===message.id?'default':prefs.notebookId}}]);return state();
      }
      case 'RESEARCH_SKILL_SAVE': {
        const name=text(message.name,80).trim(),instructions=text(message.instructions,4001).trim();
        if(!name||!instructions||instructions.length>4000)throw new Error('Skill 需要名称和 1–4000 字分析指令。');
        const list=await read('skills');if(message.id&&!list.some(s=>s.id===message.id))throw new Error('只能编辑已存在的自定义 Skill。');
        if(message.id&&message.updatedAt!==undefined&&list.find(s=>s.id===message.id).updatedAt!==message.updatedAt)throw new Error('Skill 已在其他窗口更改，请重新载入后编辑。');
        if(!message.id&&list.length>=20)throw new Error('最多 20 个自定义 Skill。');
        await write([{store:'skills',value:{id:message.id||crypto.randomUUID(),name,instructions,updatedAt:Date.now()}}]);return state();
      }
      case 'RESEARCH_SKILL_DELETE': await write([{store:'skills',id:message.id,remove:true}]);return state();
      case 'RESEARCH_SKILLS_IMPORT': {
        const list=await read('skills'),incoming=message.skills;
        if(!Array.isArray(incoming)||!incoming.length||incoming.length+list.length>20)throw new Error('导入后自定义 Skill 不能超过 20 个。');
        const values=incoming.map(s=>{if(typeof s?.name!=='string'||typeof s?.instructions!=='string'||!s.name.trim()||s.name.length>80||!s.instructions.trim()||s.instructions.length>4000)throw new Error('Skill 文件格式错误或指令超过 4000 字。');return {id:crypto.randomUUID(),name:s.name.trim(),instructions:s.instructions.trim(),updatedAt:Date.now()};});
        await write(values.map(value=>({store:'skills',value})));return state();
      }
      case 'RESEARCH_ENTRIES': {
        const entries=(await read('entries')).filter(e=>e.notebookId===message.notebookId&&(!message.query||(e.content+' '+e.source.title).toLowerCase().includes(text(message.query,100).toLowerCase()))).sort((a,b)=>b.updatedAt-a.updatedAt);
        const offset=Math.max(0,Math.min(300,Number(message.offset)||0));return {total:entries.length,entries:entries.slice(offset,offset+20)};
      }
      case 'RESEARCH_DELETE':
      case 'RESEARCH_CLEAR': {
        const entries=await read('entries');const removed=entries.filter(e=>message.type==='RESEARCH_DELETE'?e.id===message.id:e.notebookId===message.notebookId);
        await write([...removed.map(e=>({store:'entries',id:e.id,remove:true})),{store:'meta',value:{...prefs,epoch:prefs.epoch+1}}]);return state();
      }
      case 'RESEARCH_EXPORT': return {format:'qudadflow-research',version:1,exportedAt:new Date().toISOString(),notebooks:await read('notebooks'),skills:await read('skills'),entries:await read('entries')};
      default: throw new Error('不支持的研究存储操作。');
    }
  }
  async function context(message) {
    const prefs=await initialize(),book=await read('notebooks',message.notebookId||prefs.notebookId);
    if(message.useMemory!==true||!prefs.enabled)return {content:'',count:0,epoch:prefs.epoch,notebookId:book?.id||'default',enabled:false};
    if(!book)throw new Error('选择的研究笔记本已删除，请重新选择。');
    const terms=[...new Set(text(message.text||message.figureAnalysis,4000).toLowerCase().match(/[a-z]{4,}|[\u4e00-\u9fff]{2,4}/g)||[])].slice(0,80);
    const now=Date.now(),entries=(await read('entries')).filter(e=>e.notebookId===book.id&&(!prefs.retentionDays||now-e.updatedAt<=prefs.retentionDays*86400000));
    entries.sort((a,b)=>score(b)-score(a));
    function score(e){const content=e.content.toLowerCase();return terms.filter(t=>content.includes(t)).length*3+1/(1+(now-e.updatedAt)/86400000);}
    let content='',count=0;
    for(const entry of entries.slice(0,6)){
      const available=prefs.contextChars-content.length;if(available<200)break;
      content+=`\n[Memory ${++count}: ${entry.source.title}; ${entry.source.url}; page ${entry.source.page}]\n${entry.content}`.slice(0,available);
    }
    return {content,count,epoch:prefs.epoch,notebookId:book.id,enabled:true};
  }
  async function remember(message,result,context,signal) {
    if(!context.enabled||signal?.aborted)return;
    const prefs=await initialize();if(!prefs.enabled||prefs.epoch!==context.epoch||!await read('notebooks',context.notebookId))return;
    const excerpt=text(message.text||message.figureAnalysis,2000),content=`Source excerpt:\n${excerpt}\n\n${text(result,10000)}`;
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(context.notebookId+JSON.stringify(source(message.source))+content))),b=>b.toString(16).padStart(2,'0')).join('');
    const entry={id:hash,notebookId:context.notebookId,kind:message.type,source:source(message.source),content,truncated:result.length>10000,updatedAt:Date.now()};
    const entries=(await read('entries')).filter(e=>e.id!==hash).sort((a,b)=>b.updatedAt-a.updatedAt);
    let chars=content.length,count=1;const changes=[];
    for(const old of entries){chars+=old.content.length;if(++count>300||chars>2000000)changes.push({store:'entries',id:old.id,remove:true});}
    if(signal?.aborted)return;changes.push({store:'entries',value:entry});await write(changes);
  }
  async function capturePut(capture) {
    const prefs=await initialize();await cleanup(prefs);
    const existing=(await read('captures')).sort((a,b)=>b.createdAt-a.createdAt);
    const id=crypto.randomUUID(),now=Date.now();
    // Blob storage avoids persistent base64 expansion; captures expire on the next research access.
    const viewport=capture.figures.find(f=>f.kind==='viewport'),candidates=capture.figures.filter(f=>f.kind!=='viewport');
    const retained=[...(viewport?[viewport]:[]),...candidates.slice(0,100)],skipped=capture.figures.length-retained.length;
    const figures=[];let bytes=0,omitted=0;
    for(const figure of retained){
      const item={...figure};if(item.data){const payload=item.data.split(',')[1],raw=Uint8Array.from(atob(payload),c=>c.charCodeAt(0));if(bytes+raw.length<=16*1024*1024){bytes+=raw.length;item.blob=new Blob([raw],{type:'image/jpeg'});}else omitted++;delete item.data;}figures.push(item);
    }
    const value={...capture,id,figures,captureNotice:(capture.captureNotice||'')+(omitted?` ${omitted} 张图片仅保留来源与图注，可按需载入。`:'')+(skipped?` 另有 ${skipped} 个图表候选未保留，请分批提取。`:''),createdAt:now,expiresAt:now+3600000};
    await write([...existing.slice(3).map(c=>({store:'captures',id:c.id,remove:true})),{store:'captures',value}]);return id;
  }
  async function captureRead(id) {
    const capture=await read('captures',id);if(!capture||capture.expiresAt<Date.now())throw new Error('网页材料已过期，请返回论文网页重新提取。');
    return capture;
  }
  async function captureFigure(id,index) {
    const figure=(await captureRead(id)).figures[index];
    // Loading one remote source must not decode every stored image to base64.
    return figure?{id:figure.id,src:figure.src,caption:figure.caption}:undefined;
  }
  async function captureGet(id) {
    const capture=await captureRead(id);
    for(const item of [...capture.figures,...capture.supplements||[]])if(item.blob){const bytes=new Uint8Array(await item.blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));item.data='data:image/jpeg;base64,'+btoa(binary);delete item.blob;}
    capture.canSupplement=Boolean(capture.binding?.documentId);delete capture.binding;
    return capture;
  }
  async function captureAppendView(id,figure) {
    const capture=await captureRead(id),supplements=capture.supplements||[];
    if(supplements.some(f=>f.key===figure.key))return {figure,duplicate:true,count:supplements.length};
    const bytes=Uint8Array.from(atob(figure.data.split(',')[1]),c=>c.charCodeAt(0));
    if(supplements.length>=12||[...capture.figures,...supplements].reduce((n,f)=>n+(f.blob?.size||0),bytes.length)>16*1024*1024)throw new Error('这份材料已达到截图存储上限（12 张补图或合计 16 MB），可导出结果后重新提取，或在当前窗口导入局部截图。');
    const stored={...figure,blob:new Blob([bytes],{type:'image/jpeg'})};delete stored.data;
    await write([{store:'captures',value:{...capture,supplements:[...supplements,stored]}}]);
    return {figure,duplicate:false,count:supplements.length+1};
  }
  return {source,action:message=>queued(()=>action(message)),context:message=>queued(()=>context(message)),remember:(...args)=>queued(()=>remember(...args)),skill:async id=>BUILTINS.find(s=>s.id===id)||await read('skills',id),capturePut:c=>queued(()=>capturePut(c)),captureGet,captureFigure,captureBinding:async id=>(await captureRead(id)).binding,captureAppendView:(...args)=>queued(()=>captureAppendView(...args)),captureDelete:id=>queued(()=>write([{store:'captures',id,remove:true}]))};
})();
