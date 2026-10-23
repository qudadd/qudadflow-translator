import {gridMarkdown} from './table-export.mjs';

const prefix=/^\s*((?:(?:supplementary|supplemental)\s+)?(?:fig(?:ure)?s?\.?|tables?|[图表]))\s*((?:[SA]?\d+(?:[.-]\d+)?[a-z]?)|[IVX]+)(?=\s|[.:：()）-]|$)\s*([.:：])?\s*/i;
export function pdfCaption(text){
  const m=String(text||'').match(prefix);if(!m)return null;
  if(!m[3]&&/^(?:shows?|illustrates?|depicts?|presents?|provides?|summari[sz]es?|demonstrates?|is|are|was|were|and|or|in|can|compares?)\b/i.test(text.slice(m[0].length)))return null;
  const kind=/table|表/i.test(m[1])?'table':'figure',supplement=/supplement/i.test(m[1]);
  const number=m[2].toLowerCase();
  return {identity:kind+':'+(supplement&&!number.startsWith('s')?'s':'')+number,kind,label:m[1].trim()+' '+m[2],length:m[0].length};
}
export const rectUnion=rs=>{const x=Math.min(...rs.map(r=>r.x)),y=Math.min(...rs.map(r=>r.top??r.y));return {x,y,width:Math.max(...rs.map(r=>r.right??r.x+r.width))-x,height:Math.max(...rs.map(r=>r.bottom??r.y+r.height))-y};};
export const rectOverlap=(a,b)=>Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
export function marginArtwork(r,page){return r.width>page.width*.5&&r.height<page.height*.12&&(r.y+r.height<page.height*.13||r.y>page.height*.9);}
const near=(a,b,pad=5)=>a.x<=b.x+b.width+pad&&a.x+a.width+pad>=b.x&&a.y<=b.y+b.height+pad&&a.y+a.height+pad>=b.y;
const clusterValues=(values,tolerance=4)=>{const groups=[];for(const n of values.sort((a,b)=>a-b)){const g=groups.at(-1);if(g&&n-g.at(-1)<=tolerance)g.push(n);else groups.push([n]);}return groups.map(g=>g.reduce((s,n)=>s+n,0)/g.length);};
const tableNotes='从 PDF 文字坐标及表格边框重建；数字、换行及合并单元格需对照原页核查。没有使用 AI/OCR。';

// Border geometry gives rows and columns independently of wrapped cell text.
// Only ruled grids are admitted here; unruled tables retain the caption-based fallback.
export function pdfRuledTables(meta){
  const rules=(meta.drawings||[]).filter(r=>!marginArtwork(r,meta)&&((r.width<=10&&r.height>=12)||(r.height<=10&&r.width>=24))).slice(0,5000),groups=[];
  for(const r of rules){const hits=groups.filter(g=>near(g.rect,r));if(!hits.length){groups.push({rect:r,rules:[r]});continue;}const first=hits[0];first.rules.push(r);for(const g of hits.slice(1)){first.rules.push(...g.rules);groups.splice(groups.indexOf(g),1);}first.rect=rectUnion(first.rules);}
  const result=[];
  for(const group of groups){
    const r=group.rect;if(r.width<80||r.height<30||r.width*r.height>meta.width*meta.height*.85)continue;
    const vertical=group.rules.filter(v=>v.width<=10&&v.height>=12),horizontal=group.rules.filter(v=>v.height<=10&&v.width>=24);
    const xs=clusterValues(vertical.map(v=>v.x+v.width/2)),ys=clusterValues(horizontal.map(v=>v.y+v.height/2));
    if(xs.length<3||xs.length>25||ys.length<2||ys.length>180)continue;
    if(xs.at(-1)-xs[0]<r.width*.8||ys.at(-1)-ys[0]<r.height*.8)continue;
    const grid=Array.from({length:ys.length-1},()=>Array(xs.length-1).fill(''));
    const members=meta.items.filter(i=>i.supported!==false&&i.x+i.width/2>=xs[0]-2&&i.x+i.width/2<=xs.at(-1)+2&&i.top+i.height/2>=ys[0]-2&&i.top+i.height/2<=ys.at(-1)+2).sort((a,b)=>a.y-b.y||a.x-b.x);
    for(const item of members){const cx=item.x+Math.min(item.width/2,3),cy=(item.top+item.bottom)/2;let x=xs.findIndex(v=>v>cx)-1,y=ys.findIndex(v=>v>cy)-1;if(x<0)x=cx>=xs.at(-1)?xs.length-2:0;if(y<0)y=cy>=ys.at(-1)?ys.length-2:0;grid[y][x]+=(grid[y][x]?' ':'')+item.text;}
    if(!grid.flat().some(Boolean))continue;
    result.push({rect:r,grid,columns:xs,raw:true,unverified:true,notes:tableNotes,markdown:gridMarkdown(grid)});
  }
  return result.sort((a,b)=>a.rect.y-b.rect.y);
}
function captionGroup(caption,meta){
  const group=[caption];let bottom=caption.bottom;
  for(const line of meta.lines.filter(l=>l.top>caption.top+2&&l.x>=caption.x-4&&l.x<=caption.x+35&&Math.abs(l.height-caption.height)<caption.height*.25).sort((a,b)=>a.top-b.top)){
    if(pdfCaption(line.text)||line.top-bottom>caption.height*.9)break;
    group.push(line);bottom=Math.max(bottom,line.bottom);
  }
  return group;
}
function regionFor(rects,caption,meta,extra={}){
  const area=rectUnion(rects),labels=meta.lines.filter(l=>l.top>=area.y-5&&l.bottom<=area.y+area.height+9&&l.x<area.x+area.width&&l.right>area.x&&!pdfCaption(l.text));
  const r=rectUnion([...rects,...labels]),x=Math.max(0,r.x-4),y=Math.max(0,r.y-4);
  return {...r,x,y,width:Math.min(meta.width,r.x+r.width+4)-x,height:Math.min(meta.height,r.y+r.height+4)-y,
    label:caption.label,identity:caption.identity,kind:caption.kind,caption:caption.caption||caption.text,...extra};
}
function panelRects(graphics,meta){
  return graphics.flatMap(r=>meta.lines.filter(l=>/^\([A-H]\)/.test(l.text)&&l.top>=r.y+r.height-6&&l.top-r.y-r.height<75).flatMap(l=>captionGroup(l,meta)));
}
const decoration=line=>line.top<25||/^(?:accepted manuscript|article in press|accepted manuscriptarticle in press|\d+)$/i.test(line.text.trim());
// Manuscripts can place an explicitly headed legend list far before a run of
// figure-only pages. Associate only a complete, ordered, unambiguous sequence.
function associateDetachedLegends(plans){
  const legends=[];let inLegends=false;
  for(const [index,plan]of plans.entries())for(const line of plan.meta.lines){
    if(/^(?:figure legends?|figure captions?)\s*[:.]?$/i.test(line.text.trim())){inLegends=true;continue;}
    if(/^(?:supplement(?:ary|al)|table|references|bibliography|appendix)\b/i.test(line.text.trim())&&!pdfCaption(line.text)){inLegends=false;}
    if(!inLegends)continue;
    const caption=plan.captions.find(c=>c.top===line.top&&c.x===line.x&&c.kind==='figure'&&/^figure:\d+$/.test(c.identity));
    if(caption&&!legends.some(c=>c.identity===caption.identity))legends.push({...caption,index});
  }
  if(legends.length<2||legends.some((c,i)=>Number(c.identity.split(':')[1])!==i+1)||legends.some(c=>plans.some(p=>p.regions.some(r=>r.identity===c.identity))))return;
  const candidates=[];
  for(let i=legends.at(-1).index+1;i<plans.length;i++){
    const plan=plans[i],meta=plan.meta;
    if(plan.regions.length||plan.tables.length||plan.captions.length)continue;
    const graphics=[...meta.rasters,...meta.drawings].filter(r=>!marginArtwork(r,meta)&&r.y>25&&r.width>=6&&r.height>=3);
    const rasters=graphics.filter(r=>meta.rasters.includes(r)&&r.width>meta.width*.25&&r.height>meta.height*.12);
    if(!rasters.length&&graphics.filter(r=>r.width>=25&&r.height>=12).length<8)continue;
    const area=rectUnion(graphics);if(!graphics.length||area.width*area.height<meta.width*meta.height*.09)continue;
    const prose=meta.lines.filter(l=>!decoration(l)&&l.text.length>75&&l.height>=12);
    if(prose.length>2)continue;
    // Every substantive line must belong to the graphic; exclude body pages.
    if(meta.lines.some(l=>!decoration(l)&&(l.bottom<area.y-15||l.top>area.y+area.height+25)))continue;
    candidates.push({plan,index:i,graphics:rasters.length?rasters:graphics});
  }
  if(candidates.length!==legends.length||candidates.some((c,i)=>i&&c.index!==candidates[i-1].index+1))return;
  for(const [i,candidate]of candidates.entries()){
    const legend=legends[i],page=plans[legend.index].meta.page||legend.index+1;
    candidate.plan.regions.push(regionFor(candidate.graphics,legend,candidate.plan.meta,{detachedLegend:true,captionPage:page,caption:legend.caption+`（集中图注第 ${page} 页；按完整图版顺序关联，请核对）`}));
    candidate.plan.unmatched=[];
  }
}
export function planPdfPage(meta){
  const rasters=meta.rasters.filter(r=>!marginArtwork(r,meta)),drawings=meta.drawings.filter(r=>!marginArtwork(r,meta)),ruled=pdfRuledTables(meta);
  const headings=new Set(ruled.map(t=>meta.lines.filter(l=>l.bottom<=t.rect.y+4&&t.rect.y-l.bottom<65&&/^\s*\d+(?:\.\d+)*[a-z]?\.\s+\S/i.test(l.text)).at(-1)).filter(Boolean));
  const captions=meta.lines.flatMap(l=>{const c=pdfCaption(l.text)||(headings.has(l)?{identity:'table:section:'+l.text.match(/^\s*(\S+)/)[1],kind:'table',label:'Table '+l.text.match(/^\s*(\S+)/)[1]}:null);if(!c)return [];const lines=captionGroup(l,meta);return [{...l,...c,caption:lines.map(l=>l.text).join(' '),captionRect:rectUnion(lines)}];});
  const regions=[],tables=[],unresolved=[];
  for(const c of captions){
    const grid=c.kind==='table'?ruled.find(t=>t.rect.y>=c.bottom-6&&t.rect.y-c.bottom<70):null;
    if(grid){const table={...grid,caption:c.caption,identity:c.identity};tables.push(table);regions.push(regionFor([grid.rect,c.captionRect],c,meta));continue;}
    const fallback=c.kind==='table'?meta.fallbackTables?.find(t=>pdfCaption(t.caption)?.identity===c.identity):null;
    if(fallback){tables.push({...fallback,identity:c.identity});regions.push(regionFor([fallback.rect,c.captionRect],c,meta));continue;}
    const prev=captions.filter(o=>o.bottom<c.top).at(-1),next=captions.find(o=>o.top>c.bottom+2),left=c.x>meta.width*.48?meta.width*.48:0,right=c.right<meta.width*.53?meta.width*.53:meta.width;
    const graphics=[...rasters,...drawings].filter(r=>Math.min(r.x+r.width,right)-Math.max(r.x,left)>=Math.min(20,r.width)&&r.width*r.height<meta.width*meta.height*.82);
    const sides=rasters.filter(r=>r.x>c.right&&r.x-c.right<meta.width*.4&&r.width>=35&&r.height>=25&&Math.abs(r.y-c.top)<c.height*2);
    const above=graphics.filter(r=>r.y+r.height<=c.top+8&&r.y>=(prev?.captionRect.y+prev?.captionRect.height||0)-4),below=graphics.filter(r=>r.y>=c.captionRect.y+c.captionRect.height-6&&r.y+r.height<=(next?.top||meta.height)-2);
    const distance=(r,down)=>down?r.y-c.captionRect.y-c.captionRect.height:c.top-r.y-r.height;
    const clear=(r,down)=>{const from=down?c.captionRect.y+c.captionRect.height:r.y+r.height,to=down?r.y:c.top;return !meta.lines.some(l=>l.top>from+4&&l.bottom<to-3&&l.right>r.x+10&&l.x<r.x+r.width-10&&!/^\(?[A-H]\)/.test(l.text));};
    const a=above.filter(r=>distance(r,false)<meta.height*.4&&clear(r,false)).sort((a,b)=>distance(a,false)-distance(b,false))[0],b=below.filter(r=>distance(r,true)<meta.height*.3&&clear(r,true)).sort((a,b)=>distance(a,true)-distance(b,true))[0];
    const claimedByNext=b&&next&&b.y+b.height<=next.top+5&&next.top-b.y-b.height<distance(b,true);
    const down=!sides.length&&b&&!claimedByNext&&(!a||distance(b,true)+5<distance(a,false)),nearest=sides[0]||(down?b:a);
    if(!nearest){unresolved.push(c);continue;}
    const candidates=sides.length?sides:(down?below:above),selected=[nearest];let area=nearest,changed=true;
    while(changed){changed=false;for(const r of candidates){if(selected.includes(r))continue;if(near(area,r,20)){selected.push(r);area=rectUnion(selected);changed=true;}}}
    // Multi-panel figures can have large white gaps; panel captions establish membership.
    if(c.kind==='figure')for(const r of (down?below:above).filter(r=>rasters.includes(r)&&r.width>=40&&r.height>=30)){
      if(!selected.includes(r)&&meta.lines.some(l=>/^\([A-H]\)/.test(l.text)&&l.top>=r.y+r.height-5&&l.top-r.y-r.height<75)){selected.push(r);}
    }
    if(rectUnion(selected).width<35||rectUnion(selected).height<20){unresolved.push(c);continue;}
    regions.push(regionFor([...selected,c.captionRect,...(c.kind==='figure'?panelRects(selected.filter(r=>rasters.includes(r)),meta):[])],c,meta,{placement:sides.length?'side':down?'below':'above'}));
  }
  const merge=[];for(const r of regions){const existing=merge.find(o=>o.identity===r.identity);if(existing){Object.assign(existing,regionFor([existing,r],existing,meta));}else merge.push(r);}
  return {regions:merge,tables,captions,unresolved,ruled,unmatched:rasters.filter(r=>!merge.some(o=>rectOverlap(r,o)>.7*r.width*r.height)),meta};
}

// Resolve document-level associations without retaining full-page bitmaps.
export function buildPdfFigurePlan(metadata){
  const plans=metadata.map(planPdfPage);
  for(let i=0;i<plans.length;i++){
    const plan=plans[i],previous=plans[i-1];
    for(const c of plan.captions){
      if(!previous||c.kind!=='figure'||c.top>plan.meta.height*.35)continue;
      const current=plan.regions.find(r=>r.identity===c.identity);if(current&&current.placement!=='below')continue;
      const candidate=previous.unmatched.filter(r=>r.y+r.height>previous.meta.height*.6&&r.width>=40&&r.height>=30).sort((a,b)=>b.y+b.height-a.y-a.height)[0];
      if(!candidate||previous.meta.lines.some(l=>l.top>candidate.y+candidate.height+12))continue;
      previous.regions.push(regionFor([candidate],c,previous.meta,{caption:c.caption+'（图注位于第 '+(i+1)+' 页）',crossPage:true}));previous.unmatched=previous.unmatched.filter(r=>r!==candidate);if(current)plan.regions.splice(plan.regions.indexOf(current),1);
    }
    if(previous){
      const recent=previous.captions.at(-1)||previous.regions.filter(r=>r.kind==='figure').at(-1);
      if(recent?.kind==='figure'){
        const first=plan.captions[0]?.top??Infinity,panels=plan.unmatched.filter(r=>r.y<first&&plan.meta.lines.some(l=>/^\([B-H]\)/.test(l.text)&&l.top>=r.y+r.height-6&&l.top-r.y-r.height<75));
        if(panels.length){plan.regions.push(regionFor([...panels,...panelRects(panels,plan.meta)],recent,plan.meta,{caption:recent.caption+'（跨页子图；请对照原页）',continued:true}));plan.unmatched=plan.unmatched.filter(r=>!panels.includes(r));}
      }
    }
    // Continue a named ruled table only across adjacent pages with matching borders.
    const previousTable=previous?.tables.at(-1);
    for(const grid of plan.ruled){
      if(plan.regions.some(r=>rectOverlap(r,grid.rect)>.6*grid.rect.width*grid.rect.height))continue;
      if(!previousTable?.columns||grid.rect.y>plan.meta.height*.32||grid.columns.length!==previousTable.columns.length||previous.meta.width!==plan.meta.width||grid.columns.some((x,j)=>Math.abs(x-previousTable.columns[j])>8))continue;
      const c={kind:'table',identity:previousTable.identity,label:previousTable.label||pdfCaption(previousTable.caption)?.label||'Table',caption:previousTable.caption.replace(/（续页）/g,'')};
      const header=previousTable.grid[0],sameHeader=grid.grid[0].every((v,j)=>v.replace(/\s/g,'').toLowerCase()===header[j]?.replace(/\s/g,'').toLowerCase());
      const table={...grid,identity:c.identity,caption:c.caption+'（续页）',continued:true,grid:sameHeader?grid.grid:[header,...grid.grid]};table.markdown=gridMarkdown(table.grid);plan.tables.push(table);plan.regions.push(regionFor([grid.rect],c,plan.meta,{continued:true}));
    }
    plan.regions.sort((a,b)=>a.y-b.y);plan.tables.sort((a,b)=>a.rect.y-b.rect.y);
  }
  associateDetachedLegends(plans);
  return plans.map(p=>({page:p.meta.page,regions:p.regions,tables:p.tables,unmatched:p.unmatched,captions:p.captions}));
}
