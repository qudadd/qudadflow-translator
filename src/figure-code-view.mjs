// Read-only source text is never evaluated. One editor is moved into the focus dialog.
export function figureCodeView({code,language,onDownload}){
  const name=language==='r'?'R':'Python',root=document.createElement('div'),toolbar=document.createElement('div'),title=document.createElement('strong'),actions=document.createElement('div');
  root.className='figure-code-frame';toolbar.className='figure-code-toolbar';actions.className='figure-code-tools';
  title.textContent=name+' · '+code.split('\n').length+' 行';
  const button=label=>{const b=document.createElement('button');b.type='button';b.textContent=label;actions.append(b);return b;};
  const copy=button('复制代码'),download=button('下载 '+(language==='r'?'.R':'.py')),wrap=button('自动换行'),expand=button('放大代码');
  wrap.setAttribute('aria-pressed','false');expand.setAttribute('aria-haspopup','dialog');
  const viewport=document.createElement('div'),lines=document.createElement('pre'),source=document.createElement('textarea'),status=document.createElement('small');
  viewport.className='figure-code-viewport';lines.className='figure-code-lines';lines.setAttribute('aria-hidden','true');lines.textContent=code.split('\n').map((_,i)=>i+1).join('\n');
  source.className='figure-code-source';source.readOnly=true;source.spellcheck=false;source.wrap='off';source.setAttribute('aria-label',name+' 复刻代码');source.textContent=code;
  source.addEventListener('scroll',()=>{lines.scrollTop=source.scrollTop;});
  status.className='figure-code-status';status.setAttribute('role','status');status.textContent='可选择文本，Ctrl/Cmd+A 全选；代码在本地运行。';
  copy.onclick=async()=>{try{await navigator.clipboard.writeText(code);status.textContent='已复制全部代码';}catch{source.focus();source.select();status.textContent='已选中全部代码，请按 Ctrl/Cmd+C 复制';}};
  download.onclick=onDownload;
  wrap.onclick=()=>{const on=wrap.getAttribute('aria-pressed')!=='true';source.wrap=on?'soft':'off';lines.hidden=on;lines.scrollTop=source.scrollTop;wrap.setAttribute('aria-pressed',String(on));};
  expand.onclick=()=>{
    const dialog=document.createElement('dialog'),header=document.createElement('div'),heading=document.createElement('strong'),close=document.createElement('button'),anchor=document.createComment('figure-code-position'),scroll={top:source.scrollTop,left:source.scrollLeft};
    dialog.className='figure-code-focus';dialog.setAttribute('aria-label',name+' 代码查看器');header.className='figure-code-focus-header';heading.textContent=name+' 复刻代码';close.type='button';close.textContent='返回解析 · Esc';
    root.before(anchor);header.append(heading,close);dialog.append(header,root);document.body.append(dialog);expand.hidden=true;
    const observer=new MutationObserver(()=>{if(!anchor.isConnected)dialog.close();});
    const restore=()=>{observer.disconnect();const current={top:source.scrollTop,left:source.scrollLeft};if(anchor.isConnected){anchor.replaceWith(root);expand.hidden=false;expand.focus({preventScroll:true});source.scrollTop=current.top;source.scrollLeft=current.left;}dialog.remove();};
    close.onclick=()=>dialog.close();dialog.addEventListener('close',restore,{once:true});dialog.showModal();observer.observe(document.body,{childList:true,subtree:true});source.focus({preventScroll:true});source.scrollTop=scroll.top;source.scrollLeft=scroll.left;
  };
  toolbar.append(title,actions);viewport.append(lines,source);root.append(toolbar,viewport,status);return root;
}
