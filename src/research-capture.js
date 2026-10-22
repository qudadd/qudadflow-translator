/* Explicit, local-only extraction. Offscreen figures are inventoried without scrolling or fetching. */
(async () => {
  const excluded='script,style,noscript,template,nav,[role="navigation"],[role="toolbar"],form,input,textarea,select,[contenteditable]:not([contenteditable="false"]),[translate="no"],.notranslate,[data-edge-wt-ignore],[data-edge-wt-immersive-translation],#edge-web-translator-host,#edge-wt-selection-host,[class*="sr-only"],.visually-hidden,.screen-reader-text';
  const visibility=new WeakMap();
  function visible(node){if(!node||node===document.documentElement)return true;if(visibility.has(node))return visibility.get(node);const style=getComputedStyle(node),value=!node.hidden&&style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)!==0&&visible(node.parentElement);visibility.set(node,value);return value;}
  const candidates=Array.from(document.querySelectorAll('article,[role="article"],[itemprop="articleBody"],main,[role="main"],.article-body,.article-content,#article-body')).filter(visible);
  const score=node=>(node.textContent.length+node.querySelectorAll('p,figure,table').length*100)*(node.matches('main,[role="main"]')?0.8:1);
  const root=candidates.sort((a,b)=>score(b)-score(a))[0]||document.body;
  const citation=node=>node.tagName==='BUTTON'&&/^\s*[\[\(]?\d[\d\s,–—\-\]\)]{0,45}$/.test(node.textContent)&&Boolean(node.closest('sup,[class*="citation"],[class*="reference"],[class*="cite"]'));
  const skip=node=>node.matches(excluded)||node.tagName==='BUTTON'&&!citation(node)||!visible(node)||node.tagName==='FOOTER'&&!node.closest('[class*="table"]');
  let truncated=false,text='';
  function plain(node,depth=0){
    if(depth>200){truncated=true;return '';}
    if(node.nodeType===Node.TEXT_NODE)return node.textContent;
    if(node.nodeType!==Node.ELEMENT_NODE||skip(node)||node.matches('svg,canvas,img'))return '';
    if(node.tagName==='BR')return '\n';
    return Array.from(node.childNodes,n=>plain(n,depth+1)).join('');
  }
  const clean=value=>value.replace(/\s+/g,' ').trim();
  // Only leading names identify a panel. References elsewhere in a caption do not.
  function named(value){
    const match=clean(value||'').match(/^(?:(supplementary|supplemental|supporting)\s+)?(fig(?:ure)?\.?|table|[图表])\s*(S?\d{1,3}[a-z]?)(?!\w)/i);
    if(!match)return null;
    const kind=/^(table|表)$/i.test(match[2])?'table':'figure',number=(match[1]||/^S/i.test(match[3])?'S':'')+match[3].replace(/^S/i,'').toUpperCase();
    return {kind,key:kind+':'+number,label:(kind==='table'?'Table ':'Figure ')+number,length:match[0].length};
  }
  function append(value){value=value.trim();if(value)text+=(text?'\n\n':'')+value;}
  const tableSelector='table,[role="table"],[role="grid"]';
  const tables=[],tableValues=new Map(),appendedTables=new Set(),seenTables=new Map();
  function tableRows(table){
    if(table.tagName==='TABLE')return Array.from(table.rows).filter(row=>row.closest('table')===table&&visible(row)).map(row=>Array.from(row.cells));
    const rows=Array.from(table.querySelectorAll('[role="row"]')).filter(row=>row.closest(tableSelector)===table&&visible(row));
    return rows.map(row=>Array.from(row.querySelectorAll('[role="cell"],[role="columnheader"],[role="rowheader"],[role="gridcell"]')).filter(cell=>cell.closest('[role="row"]')===row));
  }
  function mediaLayout(table){
    // A thumbnail and its caption are not data cells. Keep real tables with headers,
    // multiple data rows or mixed text/image values in the normal table extractor.
    const rows=tableRows(table);
    if(rows.length!==1||rows[0].length>2||!table.querySelector('img,svg,canvas')||table.querySelector('th,thead,[role="columnheader"],[role="rowheader"],table'))return false;
    const values=rows[0].map(cell=>clean(plain(cell))).filter(Boolean);
    return values.length===1&&Boolean(named(values[0]));
  }
  function tableContext(table){
    const captionNode=wrapper=>Array.from(wrapper.querySelectorAll('caption,figcaption,h2,h3,h4,.caption,[class*="caption"],[class*="Caption"]')).find(node=>(node.tagName==='CAPTION'||!table.contains(node))&&visible(node));
    let wrapper=table;
    for(let parent=table.parentElement,depth=0;parent&&parent!==root&&parent!==document.body&&depth<5;parent=parent.parentElement,depth++){
      if(parent.matches('article,main,[role="main"],[role="article"]'))break;
      if(parent.matches('figure,[role="figure"],[class*="table"],[class*="Table"],[id^="tbl"],[id^="Tab"],[id^="T"]')&&parent.querySelectorAll(tableSelector).length===1){wrapper=parent;if(captionNode(parent))break;}
    }
    const labelledBy=(table.getAttribute('aria-labelledby')||'').split(/\s+/).filter(Boolean).map(id=>document.getElementById(id)).filter(Boolean);
    const title=captionNode(wrapper),header=title?.closest('[class*="table-header"],[class*="table-caption"]'),titleSource=header&&wrapper.contains(header)&&!header.contains(table)?header:title;
    const titleText=header&&titleSource===header?Array.from(header.childNodes,node=>plain(node)).join(' '):plain(titleSource||document.createElement('span'));
    const caption=clean(titleText)||clean(labelledBy.map(node=>plain(node)).join(' '))||clean(table.getAttribute('aria-label')||'');
    const notes=Array.from(wrapper.querySelectorAll('[class*="footnote"],[class*="table-foot"],[class*="table-note"],[role="note"]')).filter(node=>!table.contains(node)&&!node.parentElement?.closest('[class*="footnote"],[class*="table-foot"],[class*="table-note"],[role="note"]')).map(node=>clean(plain(node))).filter(Boolean).join('\n');
    return {wrapper,caption,notes};
  }
  function tableText(table){
    const grid=[],rows=tableRows(table),rowLimit=10000,columnLimit=256,cellLimit=100000;let limited=rows.length>rowLimit,cells=0;
    outer:for(const [r,row] of rows.slice(0,rowLimit).entries()){
      grid[r]||=[];let c=0;
      for(const cell of row){while(grid[r][c]!==undefined)c++;if(c>=columnLimit){limited=true;break;}
        const value=plain(cell).trim().replace(/[\t ]+/g,' '),rowSpan=cell.rowSpan===0?rows.slice(r).filter(next=>next[0]?.parentElement?.parentElement===cell.parentElement.parentElement).length:Math.max(1,Number(cell.rowSpan||cell.getAttribute('aria-rowspan')||1)||1),colSpan=Math.max(1,Number(cell.colSpan||cell.getAttribute('aria-colspan')||1)||1),height=Math.min(rowLimit-r,rowSpan),width=Math.min(columnLimit-c,colSpan);
        if(cells+height*width>cellLimit){limited=true;break outer;}cells+=height*width;
        if(height<rowSpan||width<colSpan)limited=true;
        for(let dy=0;dy<height&&r+dy<rowLimit;dy++){grid[r+dy]||=[];for(let dx=0;dx<width;dx++)grid[r+dy][c+dx]=value;}c+=width;
      }
    }
    const columns=grid.reduce((maximum,row)=>Math.max(maximum,row.length),0),lines=grid.map(row=>'| '+Array.from({length:columns},(_,i)=>(row[i]||'').replace(/\\/g,'\\\\').replace(/\|/g,'\\|').replace(/\r?\n/g,'<br>')).join(' | ')+' |');
    if(!columns)return '';
    lines.splice(1,0,'| '+Array(columns).fill('---').join(' | ')+' |');
    if(limited)lines.push('\n[Table truncated: large row/column span or table size.]');
    const {wrapper,caption,notes}=tableContext(table),markdown=lines.join('\n'),signature=JSON.stringify([caption.toLowerCase(),markdown,notes]);
    let record=seenTables.get(signature);
    if(!record){record={id:wrapper.id||table.id||`T${tables.length+1}`,caption,notes,rows:rows.length,columns,truncated:limited,markdown,grid};tables.push(record);seenTables.set(signature,record);}
    return record;
  }
  // Inventory all visible HTML/ARIA tables. Some publishers render the article
  // body and table panels in sibling containers, so a root-only scan loses them.
  for(const table of Array.from(document.querySelectorAll('table,[role="table"],[role="grid"]'))){
    if(table.closest(excluded)||!visible(table)||!root.contains(table)&&table.closest('aside,[role="complementary"],header,footer,[role="banner"]'))continue;
    // Prefer the actual table to a surrounding ARIA grid used for layout.
    if(table.tagName!=='TABLE'&&table.querySelector('table')||mediaLayout(table))continue;
    const value=tableText(table);if(value)tableValues.set(table,value);
  }
  function appendTable(record){if(appendedTables.has(record))return;append([record.caption?`## ${record.caption}`:'',record.markdown,record.notes].filter(Boolean).join('\n\n'));appendedTables.add(record);}
  function walk(node,depth=0){
    if(depth>200){truncated=true;return;}
    if(node.nodeType!==Node.ELEMENT_NODE||skip(node)||node.matches('img,svg,canvas'))return;
    if(tableValues.has(node)){appendTable(tableValues.get(node));return;}
    if(node.matches('h1,h2,h3,h4,h5,h6,p,li,dt,dd,pre,figcaption,blockquote')&&!node.querySelector(tableSelector)){
      const value=clean(plain(node));append((/^H[1-6]$/.test(node.tagName)?'#'.repeat(Number(node.tagName[1]))+' ':node.tagName==='LI'?'- ':'')+value);return;
    }
    let inline='';const flush=()=>{append(clean(inline));inline='';};
    for(const child of node.childNodes){
      if(child.nodeType===Node.TEXT_NODE){inline+=child.textContent;continue;}
      if(child.nodeType!==Node.ELEMENT_NODE||skip(child))continue;
      if(tableValues.has(child)||child.querySelector(tableSelector)||child.matches('div,section,article,main,header,footer,figure,table,h1,h2,h3,h4,h5,h6,p,ul,ol,li,dl,dt,dd,pre,figcaption,blockquote')){flush();walk(child,depth+1);}else inline+=plain(child);
    }
    flush();
  }
  walk(root);
  for(const record of tables)appendTable(record);
  const figures=[],seen=new Map();let figuresTruncated=false,pixels=0;
  function safeUrl(value){try{const url=new URL(value,location.href);if(value&&/^https?:$/.test(url.protocol)&&!url.username&&!url.password)return url.href;}catch{}return '';}
  function imageUrl(img){
    const link=img.closest('a[href]')?.getAttribute('href');if(link&&/\.(?:png|jpe?g|webp|gif)(?:[?#]|$)|\/image-api\//i.test(link))return safeUrl(link);
    const sets=[img.getAttribute('data-srcset'),img.getAttribute('srcset'),...Array.from(img.closest('picture')?.querySelectorAll('source')||[]).flatMap(s=>[s.getAttribute('srcset'),s.getAttribute('data-srcset')])].filter(Boolean).flatMap(s=>s.split(',').map(part=>{const [url,size]=part.trim().split(/\s+/);return {url,score:parseFloat(size)||1};})).sort((a,b)=>b.score-a.score);
    const originals=['data-original','data-full-src','data-large-src','data-zoom-image','data-original-src'].flatMap(name=>[img.getAttribute(name),img.closest('a')?.getAttribute(name)]);
    return [...originals,...sets.map(s=>s.url),img.getAttribute('data-src'),img.getAttribute('data-lazy-src'),img.currentSrc,img.getAttribute('src')].map(safeUrl).find(Boolean)||'';
  }
  function imageIdentity(src){
    if(!src)return '';
    const url=new URL(src);url.hash='';
    // Springer repeats the same MediaObject in the reading companion, with
    // different size and format parameters. Retain identity-bearing queries
    // on other hosts (e.g. ?panel=A versus ?panel=B).
    if(/(^|\.)springernature\.com$/i.test(url.hostname)&&url.pathname.includes('/springer-static/image/')){
      url.pathname=url.pathname.replace(/^\/[^/]+(?=\/springer-static\/image\/)/,'/full');
      for(const key of ['as','width','height','quality'])url.searchParams.delete(key);
    }
    return url.href.replace(/\/width\/\d+(?=\.)/i,'/width/full').replace(/\.(?:png|webp|jpe?g)(?=[?#]|$)/i,'.image');
  }
  function describedCaption(element,caption){
    const descriptions=(element.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean).map(id=>document.getElementById(id)).filter(node=>node&&visible(node)&&!node.closest(excluded)).map(node=>clean(plain(node)));
    for(const description of descriptions)if(description&&!caption.includes(description)&&(!named(description)||named(description)?.key===named(caption)?.key))caption+=' · '+description;
    return caption;
  }
  const figureWrapper='figure,[role="figure"],.fig,.fig-section,[class*="figure"],[class*="Figure"],[class*="table"],[class*="Table"],[id^="fig"],[id^="Fig"]';
  const figureCaption='figcaption,.caption,.figcaption,[class*="caption"],[class*="Caption"],[class*="table-header"]';
  const captionCache=new WeakMap(),anchorNames=new Map();
  for(const link of document.querySelectorAll('a[href]'))try{
    if(link.closest(excluded)||!visible(link))continue;
    const label=clean(plain(link)),name=named(label);if(!name||label.slice(name.length).replace(/[.:：\s]/g,''))continue;
    const url=new URL(link.getAttribute('href'),location.href);
    if(!url.hash||url.origin!==location.origin||url.pathname!==location.pathname||url.search!==location.search)continue;
    const id=decodeURIComponent(url.hash.slice(1)),previous=anchorNames.get(id);
    if(previous===null||previous&&previous.key!==name.key)anchorNames.set(id,null);else anchorNames.set(id,name);
  }catch{}
  function captionEntry(node){
    if(!node||!visible(node)||node.closest(excluded)||node.closest('a'))return null;
    const value=clean(plain(node)),name=named(value),firstLink=node.querySelector('a[href]');
    // A paragraph starting with a linked cross-reference is prose, not a caption.
    if(firstLink&&name&&value.startsWith(clean(plain(firstLink)))&&named(clean(plain(firstLink))))return null;
    return name||node.matches(figureCaption)?{node,value,name}:null;
  }
  function captions(panel){
    if(captionCache.has(panel))return captionCache.get(panel);
    const entries=[];
    for(const node of panel.querySelectorAll(figureCaption+',caption,p,h2,h3,h4,h5,h6,[role="heading"],strong,b')){
      const entry=captionEntry(node);if(entry)entries.push(entry);
    }
    captionCache.set(panel,entries);return entries;
  }
  function panelReference(panel){
    const anchors=[panel];
    for(let prev=panel.previousElementSibling,n=0;prev&&n<3;prev=prev.previousElementSibling,n++){
      if(clean(plain(prev))||prev.querySelector('img,svg,canvas,table'))break;
      anchors.push(prev);
    }
    const names=anchors.map(node=>({name:anchorNames.get(node.id||node.getAttribute('name')),id:node.id||node.getAttribute('name')})).filter(entry=>entry.name);
    return new Set(names.map(entry=>entry.name.key)).size===1?names[0]:null;
  }
  function figureContext(element){
    const accessible=(element.getAttribute('aria-labelledby')||'').split(/\s+/).filter(Boolean).map(id=>document.getElementById(id)).filter(node=>node&&visible(node)&&!node.closest(excluded)).map(node=>clean(plain(node))).join(' ');
    if(named(accessible))return {wrapper:element.closest(figureWrapper)||element.parentElement,caption:accessible,captionSource:'aria-label',id:element.id};
    let fallback=null,reference=null;
    for(let panel=element,depth=0;panel&&panel!==root&&panel!==document.body&&depth<7;panel=panel.parentElement,depth++){
      if(panel.matches('article,main,[role="article"],[role="main"]'))break;
      const entries=captions(panel),numbered=entries.filter(entry=>entry.name),identities=new Set(numbered.map(entry=>entry.name.key));
      // Never attach the first caption from a container holding different figures.
      if(identities.size>1)break;
      if(numbered.length){const best=numbered.sort((a,b)=>b.value.length-a.value.length)[0];return {wrapper:panel,caption:best.value,captionSource:'caption',id:panelReference(panel)?.id||panel.id};}
      const nearby=[panel.nextElementSibling,panel.previousElementSibling].filter(node=>node?.matches(figureCaption+',p,h2,h3,h4,h5,h6,strong,b')&&!node.querySelector('img,svg,canvas,table')).map(captionEntry).filter(entry=>entry?.name);
      if(new Set(nearby.map(entry=>entry.name.key)).size===1)return {wrapper:panel,caption:nearby[0].value,captionSource:'adjacent-caption',id:panelReference(panel)?.id||panel.id};
      if(!fallback&&panel.matches(figureWrapper)){
        fallback={wrapper:panel,caption:entries.find(entry=>entry.value)?.value||'',captionSource:'caption',id:panel.id};
      }
      if(!reference){const ref=panelReference(panel);if(ref)reference={...ref,wrapper:panel};}
    }
    const alt=clean(element.getAttribute('alt')||element.getAttribute('aria-label')||'');
    if(named(alt))return {wrapper:fallback?.wrapper,caption:alt,captionSource:'image-label',id:reference?.id||fallback?.id};
    if(reference)return {wrapper:reference.wrapper,caption:reference.name.label+(alt?'. '+alt:''),captionSource:'anchor-reference',id:reference.id};
    return fallback?.caption?fallback:{wrapper:fallback?.wrapper,caption:accessible||alt,captionSource:accessible?'aria-label':'image-label',id:fallback?.id};
  }
  // Publisher panels can be siblings of the article. Require figure/table
  // semantics outside the body, instead of collecting every site image.
  for(const element of document.querySelectorAll('img,svg,canvas')){
    if(element.closest(excluded)||!visible(element)||element.parentElement?.closest('svg'))continue;
    const outside=!root.contains(element);if(outside&&element.closest('aside,[role="complementary"],header,footer,[role="banner"]'))continue;
    const rect=element.getBoundingClientRect();
    // Controls embedded inside a caption/figure are not additional charts.
    // Keep substantial SVG plots and lazy image placeholders.
    if(element.closest('button,[role="button"]')||element.matches('svg')&&(element.getAttribute('aria-hidden')==='true'||element.getAttribute('role')==='presentation'))continue;
    const small=rect.width>0&&rect.height>0&&rect.width<48&&rect.height<48;
    if(small&&!named(element.getAttribute('alt')||element.getAttribute('aria-label')||''))continue;
    const context=figureContext(element),wrapper=context.wrapper;
    const containingTable=element.closest(tableSelector);
    if(containingTable&&tableValues.has(containingTable)&&(rect.width<80||rect.height<45)&&!named(element.getAttribute('alt')||element.getAttribute('aria-label')))continue;
    const labelled=/^(?:(?:supplementary\s+)?(?:fig(?:ure)?\.?|table|chart|graph|scheme)\b|[图表])/i.test(element.getAttribute('alt')||element.getAttribute('aria-label')||'');
    // A large image inside an article is not necessarily a paper figure. Require
    // a numbered caption/reference, an explicit captioned panel, or chart semantics.
    const paperFigure=Boolean(named(context.caption)||wrapper&&context.caption&&context.captionSource==='caption'||labelled);
    if(!paperFigure)continue;
    const lazyFigure=element.tagName==='IMG'&&(element.hasAttribute('data-src')||element.hasAttribute('data-original')||element.hasAttribute('data-lazy-src'))&&labelled;
    if(!wrapper&&!lazyFigure&&(rect.width<80||rect.height<45))continue;
    const realCaption=describedCaption(element,context.caption);
    const caption=realCaption||`图 ${figures.length+1}`;
    const src=element.tagName==='IMG'?imageUrl(element):'',canonical=imageIdentity(src),previous=seen.get(canonical);
    if(previous){if(realCaption.length>previous.caption.length){previous.caption=realCaption.slice(0,2000);previous.captionSource=context.captionSource;}continue;}
    if(figures.length>=100){figuresTruncated=true;break;}
    const previewOnly=element.tagName==='IMG'&&Boolean(src)&&safeUrl(element.currentSrc||element.getAttribute('src'))!==src;
    let data='';
    if(pixels<16*1024*1024&&(element.tagName==='IMG'&&element.complete&&element.naturalWidth||element.tagName==='CANVAS'))try{
      const w=element.naturalWidth||element.width,h=element.naturalHeight||element.height;if(w*h>32000000)throw new Error('large image');const scale=Math.min(1,(previewOnly?800:3200)/Math.max(w,h));
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
      const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(element,0,0,canvas.width,canvas.height);data=canvas.toDataURL('image/jpeg',.9);
      if(data.length>4*1024*1024||pixels+data.length>16*1024*1024)data='';pixels+=data.length;
    }catch{}
    figures.push({data,src,previewOnly,paperFigure,contentType:named(realCaption)?.kind||'figure',caption:caption.slice(0,2000),captionSource:realCaption?context.captionSource:'generated',captionInferred:!realCaption,id:context.id||`F${figures.length+1}`,kind:element.tagName.toLowerCase(),rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},visible:rect.width>=80&&rect.height>=45&&rect.x>=0&&rect.y>=0&&rect.right<=innerWidth&&rect.bottom<=innerHeight&&(element.tagName!=='IMG'||element.complete&&element.naturalWidth>0)});
    if(canonical)seen.set(canonical,figures.at(-1));
  }
  const linkedTables=[],tableLinks=new Map(),readableTables=new Set(tables.map(table=>named(table.caption)?.key).filter(Boolean));
  for(const link of document.querySelectorAll('a[href]')){
    if(link.closest(excluded)||!visible(link))continue;
    const href=safeUrl(link.getAttribute('href'));if(!href)continue;
    const url=new URL(href);if(url.origin!==location.origin||url.pathname===location.pathname&&url.search===location.search)continue;
    // Only an explicit, numbered table panel or table link is eligible. Prose,
    // citations and supplement downloads must not become automatic requests.
    const label=clean(link.textContent),context=figureContext(link),name=named(context.caption)||named(label);
    if(name?.kind!=='table'||readableTables.has(name.key)||!/full\s*(?:size\s*)?table|view\s+table|open\s+table|完整表|查看表|\/tables?\/\d+/i.test(label+' '+(link.getAttribute('aria-label')||'')+' '+url.pathname)||/\.(?:pdf|docx?|xlsx?|zip)(?:$|[?#])/i.test(url.pathname))continue;
    const caption=named(context.caption)?.kind==='table'?context.caption:label;
    url.hash='';const previous=tableLinks.get(url.href);if(previous){if(caption.length>previous.caption.length)previous.caption=caption;continue;}
    if(linkedTables.length>=30)break;
    const record={url:url.href,caption:caption.slice(0,2000),identity:name.key,status:'pending'};tableLinks.set(url.href,record);linkedTables.push(record);
  }
  const attachments=[],links=new Set();
  for(const link of root.querySelectorAll('a[href]')){const label=clean(link.textContent),url=safeUrl(link.getAttribute('href'));if(url&&!links.has(url)&&/supplement|supplemental|supporting (?:information|data)|附录|补充|\.pdf\b/i.test(label+' '+url)){links.add(url);attachments.push({label:label.slice(0,180)||'External attachment',url});if(attachments.length>=30)break;}}
  return {title:clean(root.querySelector('h1')?.textContent||document.title).slice(0,300),documentTitle:document.title,url:location.origin+location.pathname,text,selection:getSelection()?.toString().trim()||'',truncated,figures,figuresTruncated,tables,linkedTables,attachments,view:{width:innerWidth,height:innerHeight,x:scrollX,y:scrollY},href:location.href};
})();
