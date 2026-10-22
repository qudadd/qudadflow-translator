import {elementTable} from './table-export.mjs';
import {researchIdentity} from './research-coverage.mjs';

// A template stays detached and inert: publisher scripts, images, frames and
// styles are never inserted into the extension document or executed.
export function parseLinkedTable(html,link){
  const template=document.createElement('template');template.innerHTML=html;
  const root=template.content;
  root.querySelectorAll('script,style,noscript,template,iframe,object,embed,nav,form,[hidden],[aria-hidden="true"],[role="navigation"],[role="banner"]').forEach(node=>node.remove());
  const clean=node=>(node?.textContent||'').replace(/\s+/g,' ').trim();
  const identity=value=>researchIdentity(value)?.key;
  const expected=link.identity||identity(link.caption),candidates=[];
  const headings='caption,figcaption,h1,h2,h3,h4,[class*="caption"],[class*="Caption"]';
  const tables=Array.from(root.querySelectorAll('table')).filter(table=>!table.querySelector('table')&&table.rows.length&&Array.from(table.rows).some(row=>row.cells.length>1));
  for(const table of tables){
    let wrapper=table;
    for(let parent=table.parentElement,depth=0;parent&&depth<6;parent=parent.parentElement,depth++){
      if(parent.querySelectorAll('table').length!==1)break;
      wrapper=parent;
      if(Array.from(parent.querySelectorAll(headings)).some(node=>identity(clean(node))))break;
    }
    const ids=(table.getAttribute('aria-labelledby')||'').split(/\s+/).filter(Boolean);
    const labels=[table.caption,...Array.from(root.querySelectorAll('[id]')).filter(node=>ids.includes(node.id)),...Array.from(wrapper.querySelectorAll(headings)).filter(node=>!table.contains(node))].map(clean).filter(Boolean);
    if(tables.length===1)labels.push(...Array.from(root.querySelectorAll('h1')).map(clean));
    const numbered=labels.filter(label=>identity(label));
    if(!numbered.some(label=>identity(label)===expected)||numbered.some(label=>identity(label)!==expected))continue;
    const value=elementTable(table);if(!value.grid.length)continue;
    const caption=numbered.filter(label=>identity(label)===expected).sort((a,b)=>b.length-a.length)[0];
    const notes=Array.from(wrapper.querySelectorAll('[class*="footnote"],[class*="table-foot"],[class*="table-note"],[role="note"]')).filter(node=>!table.contains(node)&&!node.parentElement?.closest('[class*="footnote"],[class*="table-foot"],[class*="table-note"],[role="note"]')).map(clean).filter(Boolean).join('\n');
    candidates.push({...value,caption:caption.length>link.caption.length?caption:link.caption,notes,rows:value.grid.length,columns:Math.max(...value.grid.map(row=>row.length))});
  }
  const distinct=[...new Map(candidates.map(table=>[JSON.stringify(table.grid),table])).values()];
  if(distinct.length!==1)throw new Error(distinct.length?'表格页包含多个同编号表格，无法确定内容；请打开原表核对。':'表格页未返回匹配编号的可读表格，可能需要登录、展开或网站验证。请打开原表后重试，或在该页重新提取。');
  return distinct[0];
}
