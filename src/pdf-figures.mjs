import {pdfTextLines,pdfTextItems} from './document-format.mjs';
import {gridMarkdown} from './table-export.mjs';
import {pdfCaption,planPdfPage} from './pdf-figure-plan.mjs';

const box=lines=>({x:Math.min(...lines.map(l=>l.x)),y:Math.min(...lines.map(l=>l.top??l.y)),
  width:Math.max(...lines.map(l=>l.right??l.x+l.width))-Math.min(...lines.map(l=>l.x)),
  height:Math.max(...lines.map(l=>l.bottom??l.y+l.height))-Math.min(...lines.map(l=>l.top??l.y))});
function bounded(rect,width,height,pad=3){
  const x=Math.max(0,rect.x-pad),y=Math.max(0,rect.y-pad);
  return {x,y,width:Math.max(0,Math.min(width,rect.x+rect.width+pad)-x),height:Math.max(0,Math.min(height,rect.y+rect.height+pad)-y)};
}
function logicalBox(rect,viewport,base,library){
  const matrix=library.Util.transform(base.transform,library.Util.inverseTransform(viewport.transform)),out=[Infinity,Infinity,-Infinity,-Infinity];
  library.Util.axialAlignedBoundingBox([rect.x*viewport.width,rect.y*viewport.height,(rect.x+rect.width)*viewport.width,(rect.y+rect.height)*viewport.height],matrix,out);
  return bounded({x:out[0],y:out[1],width:out[2]-out[0],height:out[3]-out[1]},base.width,base.height,0);
}
export function pdfRasterRegions(coords,viewport,base,library){
  const regions=[];
  for(let i=0;i+5<(coords?.length||0);i+=6){
    const [x1,y1,x2,y2,x3,y3]=Array.from(coords.slice(i,i+6)),x4=x2+x3-x1,y4=y2+y3-y1;
    const x=Math.min(x1,x2,x3,x4),y=Math.min(y1,y2,y3,y4);
    if(![x,y,x1,y1,x2,y2,x3,y3].every(Number.isFinite))continue;
    const rect=logicalBox({x,y,width:Math.max(x1,x2,x3,x4)-x,height:Math.max(y1,y2,y3,y4)-y},viewport,base,library);
    if(rect.width>=12&&rect.height>=12)regions.push({...rect,kind:'image'});
  }
  return regions;
}
export function pdfDrawingRegions(page,operators,viewport,base,library){
  const boxes=page.recordedBBoxes;if(!boxes)return [];
  const pathOps=new Set(['constructPath','rawFillPath','stroke','closeStroke','fill','eoFill','fillStroke','eoFillStroke','closeFillStroke','closeEOFillStroke','shadingFill'].map(n=>library.OPS[n]).filter(Number.isFinite));
  const result=[];
  for(let i=0;i<Math.min(boxes.length,operators.fnArray.length,150000);i++){
    if(!pathOps.has(operators.fnArray[i])||boxes.isEmpty(i))continue;
    const rect=logicalBox({x:boxes.minX(i),y:boxes.minY(i),width:boxes.maxX(i)-boxes.minX(i),height:boxes.maxY(i)-boxes.minY(i)},viewport,base,library);
    if(rect.width*rect.height>base.width*base.height*.82||Math.max(rect.width,rect.height)<8)continue;
    result.push({...rect,kind:'vector'});
  }
  return result;
}
function tableFromCaption(caption,items,lines,base){
  const rows=[];
  for(const item of items.filter(i=>i.supported!==false).sort((a,b)=>a.y-b.y||a.x-b.x)){
    if(item.top<caption.top-3||item.top>base.height-20)continue;
    let row=rows.at(-1);if(!row||Math.abs(row.y-item.y)>Math.max(2,item.height*.35)){row={y:item.y,items:[]};rows.push(row);}row.items.push(item);
  }
  function cellsOf(list){const cells=[];for(const item of list.slice().sort((a,b)=>a.x-b.x)){const last=cells.at(-1),gap=last?item.x-last.right:Infinity;if(last&&gap<item.height*.8){last.text+=(gap>item.height*.15?' ':'')+item.text;last.right=item.x+item.width;}else cells.push({...item,right:item.x+item.width});}return cells;}
  const lateral=rows.find(r=>Math.abs(r.y-caption.y)<caption.height&&cellsOf(r.items.filter(i=>i.x>caption.right+8)).length>=2);
  // A short table caption does not imply a narrow table. Respect a neighboring
  // caption when present, otherwise allow headings to span the whole page.
  const neighbor=lines.filter(l=>pdfCaption(l.text)&&l.x>caption.right+20&&Math.abs(l.top-caption.top)<caption.height*2).sort((a,b)=>a.x-b.x)[0];
  const tableRight=neighbor?neighbor.x-8:base.width;
  const header=lateral||rows.find(r=>r.y>caption.bottom+2&&cellsOf(r.items.filter(i=>i.x>=caption.columnLeft-3&&i.x+i.width<=tableRight+3)).length>=2);
  if(!header||header.y-caption.bottom>65)return null;
  const left=lateral?Math.min(...header.items.filter(i=>i.x>caption.right+8).map(i=>i.x)):caption.columnLeft;
  const right=lateral?base.width:tableRight;
  const headings=cellsOf(header.items.filter(i=>i.x>=left-2&&i.x+i.width<=right));
  if(headings.length<2||headings.length>16)return null;
  const columns=headings.map(c=>c.x),grid=[headings.map(c=>c.text)],used=[...header.items.filter(i=>i.x>=left-2)],height=headings[0].height;
  let bottom=Math.max(...used.map(i=>i.bottom)),dataRows=0;
  for(const row of rows.filter(r=>r.y>header.y+height*.5)){
    const candidates=row.items.filter(i=>i.x>=left-2&&i.x+i.width<=right+2);
    if(!candidates.length){if(row.y-bottom>height*2)break;continue;}
    if(Math.min(...candidates.map(i=>i.top))-bottom>height*2.5||candidates.some(i=>Math.abs(i.height-height)>height*.18))break;
    const cells=Array(columns.length).fill('');
    for(const item of candidates){let index=0;for(let j=1;j<columns.length;j++)if(item.x>=columns[j]-2)index=j;cells[index]+=(cells[index]&&item.x>columns[index]+2?' ':'')+item.text;}
    if(cells.filter(Boolean).length===1&&dataRows){
      const index=cells.findIndex(Boolean);grid.at(-1)[index]+='\n'+cells[index];
    }else{grid.push(cells);dataRows++;}
    used.push(...candidates);bottom=Math.max(bottom,...candidates.map(i=>i.bottom));
  }
  if(dataRows<2)return null;
  const notes=lines.filter(l=>l.x<left-5&&l.top>caption.bottom+height&&l.bottom<=bottom+10).map(l=>l.text).join(' ');
  return {grid,raw:true,markdown:gridMarkdown(grid),caption:caption.text,unverified:true,
    notes:'从 PDF 文字坐标重建，空单元格保留；行列与合并单元格需对照原页核查。没有使用 AI/OCR。'+(notes?' 原表注：'+notes:''),rect:bounded(box(used),base.width,base.height,4)};
}
export function extractPdfFigures({page,content,operators,viewport,base,library}){
  const lines=pdfTextLines(content,base,library.Util.transform),items=pdfTextItems(content,base,library.Util.transform);
  const fallbackTables=lines.filter(l=>pdfCaption(l.text)?.kind==='table').map(l=>tableFromCaption({...l,columnLeft:l.x>base.width*.48?base.width*.48:0},items,lines,base)).filter(Boolean);
  const metadata={width:base.width,height:base.height,lines,items,fallbackTables,
    rasters:pdfRasterRegions(page.imageCoordinates,viewport,base,library),drawings:pdfDrawingRegions(page,operators,viewport,base,library)};
  const detected=planPdfPage(metadata);
  return {regions:detected.regions,tables:detected.tables,metadata,unmatched:detected.unmatched};
}

export function pdfCropRect(region,viewport,base,library,canvas){
  const matrix=library.Util.transform(viewport.transform,library.Util.inverseTransform(base.transform)),out=[Infinity,Infinity,-Infinity,-Infinity];
  library.Util.axialAlignedBoundingBox([region.x,region.y,region.x+region.width,region.y+region.height],matrix,out);
  return bounded({x:out[0]/viewport.width*canvas.width,y:out[1]/viewport.height*canvas.height,width:(out[2]-out[0])/viewport.width*canvas.width,height:(out[3]-out[1])/viewport.height*canvas.height},canvas.width,canvas.height,0);
}
