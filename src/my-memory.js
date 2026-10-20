/* Documented anonymous MyMemory GET API. No contribution/upload endpoints or borrowed keys. */
function myMemoryChunks(text,limit=480) {
  const chunks=[];let rest=text;
  while(rest){let size=0,cut=0,lastSpace=0;for(const character of rest){const bytes=new TextEncoder().encode(character).length;if(size+bytes>limit)break;size+=bytes;cut+=character.length;if(/\s/.test(character))lastSpace=cut;}
    if(cut<rest.length&&lastSpace>cut*.5)cut=lastSpace;
    chunks.push(rest.slice(0,cut));rest=rest.slice(cut);
  }
  return chunks;
}
function decodeTranslationEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match,entity)=>{
    if(entity[0]==='#'){const code=entity[1].toLowerCase()==='x'?parseInt(entity.slice(2),16):Number(entity.slice(1));return code>0&&code<=0x10ffff&&!(code>=0xd800&&code<=0xdfff)?String.fromCodePoint(code):match;}
    return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[entity.toLowerCase()]||match;
  });
}
async function translateMyMemory(settings,text,controller,onProgress) {
  if(!settings.sourceLanguage || settings.sourceLanguage==='auto')throw translationError('MyMemory 基础试用需要手动选择源语言（默认 English）。','SOURCE_LANGUAGE_REQUIRED');
  if(settings.sourceLanguage===settings.targetLanguage)return text;
  const marker=/^__(?:EDGE_WT|QF_DOC)_\d+__$/;
  const parts=text.split(/(__(?:EDGE_WT|QF_DOC)_\d+__|\n+)/).filter(Boolean);
  if(parts.filter(part=>!marker.test(part)).join('').length>5000)throw translationError('基础试用单次最多处理 5000 字符。请试用短文，或切换自己的 API 方案。','TRIAL_LIMIT');
  let result='';
  for(const part of parts) {
    if(marker.test(part)||!part.trim()){result+=part;continue;}
    for(const chunk of myMemoryChunks(part)) {
      if(controller.signal.aborted)throw translationError('翻译已取消。','CANCELLED');
      const input=chunk.trim();if(!input){result+=chunk;continue;}
      const url=new URL(settings.endpoint);url.search='';url.hash='';
      url.searchParams.set('q',input);url.searchParams.set('langpair',settings.sourceLanguage+'|'+settings.targetLanguage);url.searchParams.set('mt','1');
      const response=await fetch(url.href,{method:'GET',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',signal:controller.signal});
      if(!response.ok)throw httpError(response.status,'MyMemory 基础试用暂不可用或额度已用完，请稍后重试或切换配置方案。');
      const data=await response.json();
      if(Number(data.responseStatus)!==200 || data.quotaFinished===true || data.quotaFinished==='true')throw translationError('MyMemory 未完成翻译，可能达到当日额度或不支持该语言。请切换配置方案。','TRIAL_UNAVAILABLE');
      const output=data.responseData?.translatedText;
      if(typeof output!=='string'||!output.trim())throw translationError('MyMemory 返回空译文。','EMPTY_TRANSLATION');
      result+=(chunk.match(/^\s*/)?.[0]||'')+decodeTranslationEntities(output)+(chunk.match(/\s*$/)?.[0]||'');
      onProgress(result);
    }
  }
  return result.trim();
}
