import {markdownCells as cells,tableDivider as divider,tableTools,tableSurroundings} from './table-export.mjs';
/* Small, inert Markdown renderer. Model/source text never becomes HTML or loads media. */
function inline(parent, text) {
  const pattern=/(`[^`\n]+`|\*\*[^*\n]+\*\*|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/g;
  let start=0;
  for(const match of text.matchAll(pattern)) {
    parent.append(document.createTextNode(text.slice(start,match.index)));
    const token=match[0];let element;
    if(token.startsWith('`')){element=document.createElement('code');element.textContent=token.slice(1,-1);}
    else if(token.startsWith('**')){element=document.createElement('strong');element.textContent=token.slice(2,-2);}
    else {const link=token.match(/^\[([^\]]+)\]\((.+)\)$/);element=document.createElement('a');element.textContent=link[1];element.href=link[2];element.target='_blank';element.rel='noopener noreferrer';}
    parent.append(element);start=match.index+token.length;
  }
  parent.append(document.createTextNode(text.slice(start)));
}
// Coalesce stream fragments without dropping text. Completion/cancellation flush
// immediately; disposal clears pending work before a different source is shown.
export function createResearchRenderer(container,options={unverified:true}) {
  let timer=null,pending=null,rendered=null;
  const flush=()=>{
    clearTimeout(timer);timer=null;
    if(pending===null)return;
    const value=pending;pending=null;
    if(value!==rendered){renderResearch(container,value,options);rendered=value;}
  };
  return {
    update(value,complete=false){
      pending=String(value??'');
      if(complete)flush();else if(timer===null)timer=setTimeout(flush,150);
    },
    flush,
    cancel(){clearTimeout(timer);timer=null;pending=null;rendered=null;}
  };
}
export function renderResearch(container, value,options={}) {
  const text=String(value||''),lines=text.replace(/\r\n?/g,'\n').split('\n'),fragment=document.createDocumentFragment();
  let index=0;
  while(index<lines.length) {
    const line=lines[index];
    if(!line.trim()){index++;continue;}
    const fence=line.match(/^\s*(`{3,}|~{3,})(.*)$/);
    if(fence) {
      const pre=document.createElement('pre'),code=document.createElement('code'),language=fence[2].trim().slice(0,30),parts=[],closing=new RegExp('^\\s*'+fence[1][0]+'{'+fence[1].length+',}\\s*$');index++;
      while(index<lines.length&&!closing.test(lines[index]))parts.push(lines[index++]);
      if(index<lines.length)index++;code.textContent=parts.join('\n');if(language)pre.setAttribute('aria-label',language+' code');pre.append(code);fragment.append(pre);continue;
    }
    if(index+1<lines.length&&line.includes('|')&&divider(lines[index+1])) {
      const wrapper=document.createElement('div');wrapper.className='research-table';wrapper.tabIndex=0;
      const table=document.createElement('table'),head=document.createElement('thead'),body=document.createElement('tbody'),grid=[cells(line)],start=index;
      const native=Array.isArray(options.tableGrid),row=(values,tag,r)=>{const tr=document.createElement('tr');for(const value of native?options.tableGrid[r]||[]:values){const cell=document.createElement(tag);if(tag==='th')cell.scope='col';const lines=String(value).split(native?/\r?\n/:/<br\s*\/?\s*>/gi);lines.forEach((line,index)=>{if(index)cell.append(document.createElement('br'));if(native)cell.append(document.createTextNode(line));else inline(cell,line);});tr.append(cell);}return tr;};
      head.append(row(grid[0],'th',0));index+=2;
      while(index<lines.length&&lines[index].includes('|')&&lines[index].trim()){const values=cells(lines[index++]);grid.push(values);body.append(row(values,'td',grid.length-1));}
      const context=tableSurroundings(lines,start,index);
      table.append(head,body);wrapper.append(table);fragment.append(wrapper,tableTools({grid:native?options.tableGrid:grid,raw:native,markdown:lines.slice(start,index).join('\n'),caption:options.tableCaption||context.caption,notes:options.tableNotes||context.notes,truncated:options.truncated,unverified:options.unverified}));continue;
    }
    const heading=line.match(/^(#{1,6})\s+(.+)$/);
    if(heading){const node=document.createElement('h'+Math.min(6,heading[1].length+1));inline(node,heading[2]);fragment.append(node);index++;continue;}
    const list=line.match(/^\s*(?:([-*+])|\d+[.)])\s+(.+)$/);
    if(list){const tag=list[1]?'ul':'ol',node=document.createElement(tag);while(index<lines.length){const item=lines[index].match(/^\s*(?:([-*+])|\d+[.)])\s+(.+)$/);if(!item||(item[1]?'ul':'ol')!==tag)break;const li=document.createElement('li');inline(li,item[2]);node.append(li);index++;}fragment.append(node);continue;}
    if(/^\s*([-*_])\1{2,}\s*$/.test(line)){fragment.append(document.createElement('hr'));index++;continue;}
    const node=document.createElement(/^>\s?/.test(line)?'blockquote':'p'),parts=[line.replace(/^>\s?/,'')];index++;
    while(index<lines.length&&lines[index].trim()&&!/^(?:#{1,6}\s|\s*```|\s*[-*+]\s|\s*\d+[.)]\s|>)/.test(lines[index])&&!(lines[index].includes('|')&&divider(lines[index+1]||'')))parts.push(lines[index++]);
    inline(node,parts.join('\n'));fragment.append(node);
  }
  const scroll=container.scrollTop,nearEnd=container.scrollHeight-container.clientHeight-scroll<60;
  container.replaceChildren(fragment);container.classList.add('research-markdown');
  container.scrollTop=nearEnd?container.scrollHeight:scroll;
}
