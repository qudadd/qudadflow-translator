/* Conservative local cross-check, not an assertion that a paper is complete. */
export function researchReferences(text='') {
  const found=new Map();
  const pattern=/(?:(supplementary|supplemental|supporting)\s+)?\b(fig(?:ure)?s?\.?|tables?)\s*(S?\d{1,3}[a-z]?(?:\s*(?:[,，、&]|and\b|to\b|[–—-])\s*S?\d{1,3}[a-z]?){0,12})(?![\d\w])|([图表])\s*(S?\d{1,3}[a-z]?(?:\s*(?:[,，、和及]|[–—-])\s*S?\d{1,3}[a-z]?){0,12})(?![\d\w])/gi;
  for(const match of String(text).matchAll(pattern)) {
    const kind=/^(?:table|表)/i.test(match[2]||match[4])?'table':'figure',sequence=match[3]||match[5];
    let last=0,supplement=Boolean(match[1]);
    for(const number of sequence.matchAll(/(S?)(\d{1,3})[a-z]?/gi)) {
      const value=Number(number[2]);if(!value)continue;
      supplement ||= Boolean(number[1]);
      const add=n=>{const label=(kind==='table'?'Table ':'Figure ')+(supplement?'S':'')+n;found.set(kind+':'+(supplement?'S':'')+n,{kind,label,supplement});};
      const separator=sequence.slice(last,number.index);
      const previous=sequence.slice(0,last).match(/(\d{1,3})[a-z]?$/i)?.[1];
      if(previous&&/^\s*(?:[–—-]|to)\s*$/i.test(separator)&&value>Number(previous)&&value-Number(previous)<=20)for(let n=Number(previous)+1;n<value;n++)add(n);
      add(value);last=number.index+number[0].length;
    }
  }
  return found;
}

export function researchIdentity(caption) {
  const first=String(caption||'').match(/^\s*(?:(?:supplementary|supplemental|supporting)\s+)?(?:fig(?:ure)?\.?|table|[图表])\s*S?\d{1,3}[a-z]?(?!\w)/i);
  if(!first)return undefined;
  const entry=[...researchReferences(first[0])][0];
  return entry?{key:entry[0],...entry[1]}:undefined;
}

export function assessResearchCapture(capture) {
  const tables=Array.isArray(capture.tables)?capture.tables:[],figures=Array.isArray(capture.figures)?capture.figures:[];
  const readable=new Set(),images=new Set();
  // Only a caption's leading label identifies the item; a caption may also cite other figures.
  const identity=caption=>researchIdentity(caption)?.key;
  for(const table of tables){const key=identity(table.caption);if(key)readable.add(key);}
  for(const figure of figures){if(figure.kind==='viewport'||figure.captionInferred)continue;const key=identity(figure.caption);if(key)images.add(key);}
  const issues=[];
  for(const [key,reference] of researchReferences(capture.text)) {
    if(readable.has(key))continue;
    if(images.has(key)){if(reference.kind==='table')issues.push({...reference,reason:'image',text:`${reference.label} 已找到图片形式；尚未转写为可读表格，可载入原图或补图后用 AI 识别。`});continue;}
    issues.push({...reference,reason:reference.supplement?'supplement':'unmatched',text:`${reference.label} ${reference.supplement?'可能属于外部补充材料，本次未读取。':'在材料中被提及，未匹配到对应的图表；请在原文核对是否折叠、未加载或属于引用。'}`});
  }
  for(const [index,table] of tables.entries())if(table.truncated)issues.push({kind:'table',reason:'truncated',text:`${table.caption||'表 '+(index+1)} 仅提取了部分行列，请核对完整表格。`});
  if(capture.truncated||capture.figuresTruncated)issues.push({reason:'limited',text:'本地提取触及结构或图片数量限制，请核对原文。'});
  return {issues,tableCount:tables.length,figureCount:figures.filter(f=>f.kind!=='viewport').length,imageTableCount:figures.filter(f=>f.kind!=='viewport'&&!f.captionInferred&&researchIdentity(f.caption)?.kind==='table').length};
}
