/* Local table formats and clipboard/download controls. Source/model text stays inert. */
export function markdownCells(line) {
  let value=String(line).trim(),cell='',escaped=false;const cells=[];
  if(value.startsWith('|'))value=value.slice(1);
  if(value.endsWith('|')){let slashes=0;for(let i=value.length-2;i>=0&&value[i]==='\\';i--)slashes++;if(slashes%2===0)value=value.slice(0,-1);}
  for(const char of value){
    if(escaped){cell+=char==='|'||char==='\\'?char:'\\'+char;escaped=false;}
    else if(char==='\\')escaped=true;
    else if(char==='|'){cells.push(cell.trim());cell='';}
    else cell+=char;
  }
  cells.push((cell+(escaped?'\\':'')).trim());return cells;
}
export const tableDivider=line=>String(line).includes('|')&&markdownCells(line).every(cell=>/^:?-{3,}:?$/.test(cell));
export function tableSurroundings(lines,start,end){
  const before=lines.slice(0,start).reverse().find(line=>line.trim())||'';
  const caption=before.includes('|')?'':before.replace(/^\s*#{1,6}\s+/, '').trim(),notes=[];
  for(let index=end;index<lines.length;index++){
    if(/^\s*#{1,6}\s|^\s*(?:Table|表)\s*\d|^\s*```/i.test(lines[index])||lines[index].includes('|')&&tableDivider(lines[index+1]||''))break;
    notes.push(lines[index]);
  }
  return {caption,notes:notes.join('\n').trim()};
}
export function markdownTables(value) {
  const lines=String(value||'').replace(/\r\n?/g,'\n').split('\n'),tables=[];let fence='';
  for(let index=0;index<lines.length;index++){
    const marker=lines[index].match(/^\s*(`{3,}|~{3,})/);
    if(marker){if(!fence)fence=marker[1];else if(fence[0]===marker[1][0]&&marker[1].length>=fence.length&&lines[index].trim()===marker[1])fence='';continue;}
    if(fence||!lines[index].includes('|')||!tableDivider(lines[index+1]||''))continue;
    const start=index,grid=[markdownCells(lines[index])];index+=2;
    while(index<lines.length&&lines[index].trim()&&lines[index].includes('|')&&!/^\s*```/.test(lines[index]))grid.push(markdownCells(lines[index++]));
    tables.push({grid,markdown:lines.slice(start,index).join('\n'),...tableSurroundings(lines,start,index)});index--;
  }
  return tables;
}
const plainCell=value=>String(value??'').replace(/<br\s*\/?\s*>/gi,'\n').replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g,'$1').replace(/\*\*([^*]+)\*\*/g,'$1').replace(/`([^`]+)`/g,'$1');
export function tableTsv(grid,{raw=false}={}) {
  const width=grid.reduce((maximum,row)=>Math.max(maximum,row.length),0);
  const field=value=>{
    let text=(raw?String(value??''):plainCell(value)).replace(/\r\n?/g,'\n');
    // Treat spreadsheet formulas as literal text, while retaining scientific negatives.
    if(/^\s*[=+@-]/.test(text)&&!/^\s*[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?%?\s*$/.test(text))text="'"+text;
    return /[\t\n"]/.test(text)?'"'+text.replace(/"/g,'""')+'"':text;
  };
  return grid.map(row=>Array.from({length:width},(_,i)=>field(row[i]??'')).join('\t')).join('\r\n');
}
export function gridMarkdown(grid) {
  const width=grid.reduce((maximum,row)=>Math.max(maximum,row.length),0);if(!width)return '';
  const row=values=>'| '+Array.from({length:width},(_,i)=>String(values[i]??'').replace(/\\/g,'\\\\').replace(/\|/g,'\\|').replace(/\r?\n/g,'<br>')).join(' | ')+' |';
  return [row(grid[0]),row(Array(width).fill('---')),...grid.slice(1).map(row)].join('\n');
}
export function elementTable(element) {
  const grid=[],rows=Array.from(element.rows||[]).filter(row=>row.closest('table')===element);let truncated=false;
  // A finite cell budget prevents malformed spans from freezing the reader.
  const rowLimit=10000,columnLimit=256,cellLimit=100000;let cells=0;
  outer:for(const [r,row]of rows.entries()){
    if(r>=rowLimit){truncated=true;break;}grid[r]||=[];let c=0;
    for(const cell of row.cells){
      while(grid[r][c]!==undefined)c++;
      const requestedHeight=cell.rowSpan===0?rows.slice(r).filter(next=>next.parentElement===row.parentElement).length:Number(cell.rowSpan)||1;
      const height=Math.max(1,Math.min(requestedHeight,rowLimit-r)),width=Math.max(1,Math.min(Number(cell.colSpan)||1,columnLimit-c));
      if(c>=columnLimit||cells+height*width>cellLimit){truncated=true;break outer;}
      if(height<requestedHeight||width<(Number(cell.colSpan)||1))truncated=true;
      const clone=cell.cloneNode(true);clone.querySelectorAll('[data-edge-wt-immersive-translation],script,style,[hidden]').forEach(node=>node.remove());
      clone.querySelectorAll('br').forEach(node=>node.replaceWith('\n'));
      const text=clone.textContent.replace(/[\t ]+/g,' ').replace(/ *\n */g,'\n').trim();
      for(let y=0;y<height;y++){grid[r+y]||=[];for(let x=0;x<width;x++)grid[r+y][c+x]=text;}
      cells+=height*width;c+=width;
    }
  }
  return {grid,raw:true,markdown:gridMarkdown(grid),caption:element.caption?.textContent.trim()||element.getAttribute('aria-label')||'',truncated};
}
function save(name,text,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function tableTools({grid,markdown,caption='',notes='',truncated=false,unverified=false,raw=false}) {
  grid||=markdownTables(markdown)[0]?.grid||[];markdown||=gridMarkdown(grid);
  const tools=document.createElement('div');tools.className='table-copy-tools';
  const full=[caption?'## '+caption:'',markdown,notes,truncated?'[表格内容已截断，请核对原表。]':'',unverified?'AI 转写，未经核验；请对照原图检查数字、单位和缺失单元格。':''].filter(Boolean).join('\n\n');
  const tsv=tableTsv(grid,{raw}),status=document.createElement('span');status.className='table-copy-status';status.setAttribute('role','status');
  const copy=(label,text)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=async()=>{
    try{await navigator.clipboard.writeText(text);status.textContent='已复制'+(label.includes('TSV')?'，可粘贴到 Excel。':'。');}
    catch{status.textContent='未能访问剪贴板，请从下方选中并复制，或下载文件。';let field=tools.querySelector('textarea');if(!field){field=document.createElement('textarea');field.readOnly=true;field.setAttribute('aria-label','手动复制表格');tools.append(field);}field.value=text;field.focus();field.select();}
  };tools.append(b);};
  copy('复制 Markdown',full);copy('复制 TSV（Excel）',tsv);
  for(const [label,extension,text,type]of [['下载 .md','md',full,'text/markdown;charset=utf-8'],['下载 .tsv','tsv','\uFEFF'+tsv,'text/tab-separated-values;charset=utf-8']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>save('QudadFlow-table.'+extension,text,type);tools.append(b);}
  tools.append(status);return tools;
}
