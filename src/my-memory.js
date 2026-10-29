/* Documented anonymous MyMemory GET API. No contribution/upload endpoints or borrowed keys. */
const MY_MEMORY_MAX_CONCURRENT=4;
let myMemoryActive=0;
const myMemoryWaiting=[];
function pumpMyMemorySlots(){
  while(myMemoryActive<MY_MEMORY_MAX_CONCURRENT&&myMemoryWaiting.length){
    const waiter=myMemoryWaiting.shift();
    waiter.signal.removeEventListener('abort',waiter.abort);
    if(waiter.signal.aborted){waiter.reject(translationError('翻译已取消。','CANCELLED'));continue;}
    myMemoryActive++;
    let released=false;
    waiter.resolve(()=>{if(released)return;released=true;myMemoryActive--;pumpMyMemorySlots();});
  }
}
function myMemorySlot(signal){
  return new Promise((resolve,reject)=>{
    if(signal.aborted){reject(translationError('翻译已取消。','CANCELLED'));return;}
    const waiter={signal,resolve,reject,abort:null};
    waiter.abort=()=>{
      const index=myMemoryWaiting.indexOf(waiter);
      if(index>=0){myMemoryWaiting.splice(index,1);reject(translationError('翻译已取消。','CANCELLED'));}
    };
    signal.addEventListener('abort',waiter.abort,{once:true});
    myMemoryWaiting.push(waiter);pumpMyMemorySlots();
  });
}
function myMemoryChunks(text,limit=500) {
  const chunks=[];let start=0;
  while(start<text.length){let size=0,end=start,lastSpace=start;
    while(end<text.length){const code=text.codePointAt(end),width=code>0xffff?2:1;
      const bytes=code<=0x7f?1:code<=0x7ff?2:code<=0xffff?3:4;
      if(size+bytes>limit)break;
      size+=bytes;end+=width;
      if(/\s/u.test(text.slice(end-width,end)))lastSpace=end;
    }
    if(end===start)throw new Error('Invalid translation chunk limit.');
    if(end<text.length&&lastSpace>start+(end-start)*.5)end=lastSpace;
    chunks.push(text.slice(start,end));start=end;
  }
  return chunks;
}
function decodeTranslationEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match,entity)=>{
    if(entity[0]==='#'){const code=entity[1].toLowerCase()==='x'?parseInt(entity.slice(2),16):Number(entity.slice(1));return code>0&&code<=0x10ffff&&!(code>=0xd800&&code<=0xdfff)?String.fromCodePoint(code):match;}
    return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[entity.toLowerCase()]||match;
  });
}
async function translateMyMemory(settings,text,controller,onProgress,{cacheSettings=settings,cacheAllowed=true}={}) {
  if(!settings.sourceLanguage || settings.sourceLanguage==='auto')throw translationError('MyMemory 基础试用需要手动选择源语言（默认 English）。','SOURCE_LANGUAGE_REQUIRED');
  if(settings.sourceLanguage===settings.targetLanguage)return text;
  const marker=/^__(?:EDGE_WT|QF_DOC)_\d+__$/;
  const parts=text.split(/(__(?:EDGE_WT|QF_DOC)_\d+__|\n+)/).filter(Boolean);
  const limit=settings.mymemoryEmail?12000:5000;
  if(parts.filter(part=>!marker.test(part)).join('').length>limit)throw translationError(`MyMemory 单次最多处理 ${limit} 字符。请缩短材料，或切换自己的 API 方案。`,'TRIAL_LIMIT');
  const chunks=parts.flatMap(part=>marker.test(part)||!part.trim()?[part]:myMemoryChunks(part));
  const translated=new Array(chunks.length);
  let next=0,completed=0,progressText='',failure;
  const inFlight=new Map();
  const cacheContext=['mymemory-segment',settings.endpoint,settings.sourceLanguage,settings.targetLanguage,settings.mymemoryEmail||''];
  const requestController=new AbortController();
  const cancel=()=>requestController.abort();
  controller.signal.addEventListener('abort',cancel,{once:true});
  if(controller.signal.aborted)cancel();
  async function translateChunk(chunk) {
    if(marker.test(chunk)||!chunk.trim())return chunk;
    if(controller.signal.aborted)throw translationError('翻译已取消。','CANCELLED');
    const source=chunk.trim(),cached=cacheAllowed?cachedTranslation(cacheSettings,source,cacheContext):{};
    let translated=cached.translation;
    if(translated===undefined){
      let pending=inFlight.get(source);
      if(!pending){
        const requestChunk=async controller=>{
          const release=await myMemorySlot(controller.signal);
          try{
            const url=new URL(settings.endpoint);url.search='';url.hash='';
            url.searchParams.set('q',source);url.searchParams.set('langpair',settings.sourceLanguage+'|'+settings.targetLanguage);url.searchParams.set('mt','1');
            if(settings.mymemoryEmail)url.searchParams.set('de',settings.mymemoryEmail);
            const response=await fetch(url.href,{method:'GET',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',signal:controller.signal});
            if(!response.ok){response.body?.cancel().catch(()=>{});throw httpError(response.status,'MyMemory 基础试用暂不可用或额度已用完，请稍后重试或切换配置方案。');}
            const data=await response.json();
            if(Number(data.responseStatus)!==200 || data.quotaFinished===true || data.quotaFinished==='true')throw translationError('MyMemory 未完成翻译，可能达到当日额度或不支持该语言。请切换配置方案。','TRIAL_UNAVAILABLE');
            const output=data.responseData?.translatedText;
            if(typeof output!=='string'||!output.trim())throw translationError('MyMemory 返回空译文。','EMPTY_TRANSLATION');
            const result=decodeTranslationEntities(output);
            return cacheAllowed?rememberTranslation(cached.key,result,cacheSettings):result;
          }finally{release();}
        };
        pending=(cacheAllowed?sharedTranslation(cached.key,requestController,()=>{},requestChunk):requestChunk(requestController)).finally(()=>inFlight.delete(source));
        inFlight.set(source,pending);
      }
      translated=await pending;
    }
    return (chunk.match(/^\s*/)?.[0]||'')+translated+(chunk.match(/\s*$/)?.[0]||'');
  }
  try {
    await Promise.all(Array.from({length:Math.min(3,chunks.length)},async()=>{
      while(!failure && next<chunks.length) {
        const index=next++;
        try {
          translated[index]=await translateChunk(chunks[index]);
          let revealed=false;
          while(completed<translated.length && translated[completed]!==undefined){
            if(!marker.test(chunks[completed])&&chunks[completed].trim())revealed=true;
            progressText+=translated[completed++];
          }
          if(revealed)onProgress(progressText);
        } catch(error) { if(!failure){failure=error;cancel();} }
      }
    }));
    if(failure)throw failure;
    return translated.join('').trim();
  } finally { controller.signal.removeEventListener('abort',cancel); }
}
