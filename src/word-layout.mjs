import {MAX_PAGES,MAX_TEXT_CHARS} from './document-format.mjs';
import {fitText,replacementNode} from './layout-view.mjs';
const decode=bytes=>new TextDecoder(bytes[0]===255&&bytes[1]===254?'utf-16le':bytes[0]===254&&bytes[1]===255?'utf-16be':'utf-8',{fatal:true}).decode(bytes);
const attribute=(node,name)=>Array.from(node.attributes).find(a=>a.localName===name)?.value;
function safeXml(bytes,relationships) {
  const xml=decode(bytes);if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('Word 文件包含不支持的 XML 声明。');
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  if(doc.getElementsByTagName('parsererror').length)throw new Error('无法读取 Word 文档结构。');
  for(const node of Array.from(doc.getElementsByTagName('*'))) {
    if(relationships && node.localName==='Relationship') {
      const target=attribute(node,'Target')||'';
      if(attribute(node,'TargetMode')==='External'||/^[a-z]+:|^\/\/|\.\./i.test(target))node.remove();
    }
    if(['del','altChunk','object','OLEObject','instrText'].includes(node.localName))node.remove();
    if(node.localName==='r'){
      const hidden=node.getElementsByTagNameNS('*','vanish')[0];
      if(hidden&&!/^(0|false|off)$/i.test(attribute(hidden,'val')||'true'))node.remove();
    }
  }
  return new XMLSerializer().serializeToString(doc);
}
export async function renderWord(files,signal) {
  const zip=new globalThis.JSZip();
  for(const [name,bytes] of Object.entries(files))zip.file(name,/\.(xml|rels)$/i.test(name)?safeXml(bytes,name.endsWith('.rels')):bytes);
  // Some generated DOCX files omit package relationships; the known body path still works.
  if(!files['_rels/.rels'])zip.file('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="body" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  if(signal.aborted)throw new Error('文档加载已取消。');
  const data=await zip.generateAsync({type:'uint8array',compression:'STORE'});
  const host=document.createElement('div');host.className='word-measure';host.setAttribute('aria-hidden','true');
  const styles=document.createElement('div');styles.className='word-styles';host.append(styles);
  const content=document.createElement('div');host.append(content);
  // Render detached first. External relationships, fonts, HTML chunks and embedded objects are excluded.
  try {
    await globalThis.docx.renderAsync(data,content,styles,{className:'qf-docx',inWrapper:false,ignoreFonts:true,ignoreLastRenderedPageBreak:false,renderAltChunks:false,renderComments:false,useBase64URL:true});
    if(signal.aborted)throw new Error('文档加载已取消。');
    for(const node of content.querySelectorAll('*')){
      if(['SCRIPT','IFRAME','OBJECT','EMBED','LINK','META','FORM'].includes(node.tagName)){node.remove();continue;}
      for(const attr of Array.from(node.attributes))if(/^on/i.test(attr.name)||['srcset','href','xlink:href'].includes(attr.name)||attr.name==='src'&&!/^data:image\/(png|jpeg|gif|webp);base64,/i.test(attr.value))node.removeAttribute(attr.name);
      if(node.getAttribute('style')?.match(/url\s*\(|@import|expression\s*\(/i))node.removeAttribute('style');
    }
    for(const style of styles.querySelectorAll('style'))if(/url\s*\(|@import|expression\s*\(/i.test(style.textContent))style.remove();
    document.body.append(host);
    await Promise.all(Array.from(content.querySelectorAll('img'),img=>img.decode().catch(()=>{})));
    await document.fonts.ready;
    if(signal.aborted)throw new Error('文档加载已取消。');
    const sections=Array.from(content.querySelectorAll('section.qf-docx'));
    if(!sections.length||sections.length>MAX_PAGES)throw new Error('Word 分页过多或无法排版。');
    let chars=0;
    const pages=sections.map(section=>{
      if(!section.style.width)section.style.width='816px';
      if(!section.style.minHeight)section.style.minHeight='1056px';
      const bounds=section.getBoundingClientRect(),height=Math.max(section.scrollHeight,bounds.height);
      section.style.height=`${height}px`;section.style.minHeight='0';section.style.margin='0';
      const blocks=[];
      for(const p of section.querySelectorAll('p')) {
        const text=p.textContent.trim();if(!text)continue;
        chars+=text.length;if(chars>MAX_TEXT_CHARS)throw new Error('文档文字超过 100 万字符，请拆分文件。');
        const box=p.getBoundingClientRect(),style=getComputedStyle(p),typography=paragraphTypography(p);
        if(!box.width||!box.height)continue;
        const index=blocks.length;p.dataset.qfBlock=index;
        blocks.push({text,kind:/heading|标题/i.test(p.className)?'heading':'paragraph',geometry:{x:box.left-bounds.left,y:box.top-bounds.top,width:box.width,height:box.height,fontSize:typography.fontSize,supported:text.length<=1500&&!p.querySelector('img,svg,table'),typography:{...typography,textAlign:style.textAlign,textIndent:style.textIndent,direction:style.direction}},index});
      }
      return {blocks,template:section.cloneNode(true),width:bounds.width,height};
    });
    if(!chars)throw new Error('没有找到可翻译的文字。');
    return {pages,styles:styles.cloneNode(true)};
  } finally {host.remove();}
}
function paragraphTypography(p){
  const styles=new Map(),walker=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);
  for(let node=walker.nextNode();node;node=walker.nextNode()){
    if(!node.textContent.trim())continue;
    const s=getComputedStyle(node.parentElement),key=[s.fontSize,s.fontWeight,s.fontStyle,s.fontFamily,s.color].join('|');
    const entry=styles.get(key)||{count:0,style:s};entry.count+=node.textContent.trim().length;styles.set(key,entry);
  }
  const style=Array.from(styles.values()).sort((a,b)=>b.count-a.count)[0]?.style||getComputedStyle(p);
  const fontSize=parseFloat(style.fontSize)||16,line=parseFloat(getComputedStyle(p).lineHeight);
  return {fontSize,fontWeight:style.fontWeight,fontStyle:style.fontStyle,fontFamily:style.fontFamily,color:style.color,lineHeight:Number.isFinite(line)?String(Math.max(1,line/fontSize)):'normal'};
}
export class WordLayoutView {
  constructor({page,sourceContainer,translationContainer,width}) {
    this.nodes=new Map();this.page=page;
    const scale=width/page.width;
    const create=container=>{const sheet=document.createElement('div');sheet.className='word-sheet';sheet.style.width=`${width}px`;sheet.style.height=`${page.height*scale}px`;const inner=document.createElement('div');inner.className='word-page';inner.style.width=`${page.width}px`;inner.style.height=`${page.height}px`;inner.style.transform=`scale(${scale})`;inner.append(page.template.cloneNode(true));sheet.append(inner);container.append(sheet);return inner;};
    this.source=create(sourceContainer);this.translated=create(translationContainer);
    for(const block of page.blocks){const p=this.translated.querySelector(`[data-qf-block="${block.index}"]`);const node=replacementNode(block,block.geometry);const {fontSize,...typography}=block.geometry.typography;Object.assign(node.style,typography);this.translated.append(node);this.nodes.set(block,{node,p});}
    this.update();
  }
  update(){
    let overflow=0;
    for(const [block,{node,p}] of this.nodes){
      const text=block.translation||block.partial;node.hidden=!text;node.textContent=text||'';node.classList.toggle('pending',!block.translation&&Boolean(block.partial));
      const fits=text&&block.geometry.supported&&fitText(node,block.geometry,block.geometry.fontSize);
      p.classList.toggle('word-replaced',Boolean(fits));node.classList.toggle('layout-fallback',Boolean(text&&!fits));
      if(text&&!fits){overflow++;node.textContent='↗';node.title='点击查看完整译文；原文保留。';}
    }
    document.getElementById('layoutNotice').textContent=`Word 浏览器排版，复杂版式与字体可能有差异；严格保真请先另存为 PDF。${overflow?` ${overflow} 段请点击 ↗ 查看完整译文。`:''}`;
  }
}
