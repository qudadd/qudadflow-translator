/* Executed only by an explicit paper-extraction action. No requests or persistent page listeners. */
(async () => {
  const excluded='script,style,noscript,template,nav,footer,form,input,textarea,select,button,[contenteditable]:not([contenteditable="false"]),[translate="no"],.notranslate,[data-edge-wt-ignore],[data-edge-wt-immersive-translation],#edge-web-translator-host,#edge-wt-selection-host';
  const root=document.querySelector('article')||document.querySelector('main,[role="main"]')||document.body;
  const visible=node=>{for(let p=node;p&&p!==document.documentElement;p=p.parentElement){const style=getComputedStyle(p);if(p.hidden||style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)return false;}return true;};
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node,text='',visited=0,truncated=false;
  while((node=walker.nextNode())&&++visited<=25000){const p=node.parentElement;if(!p||p.closest(excluded)||p.closest('svg,canvas')||!visible(p))continue;const part=node.textContent.trim();if(!part)continue;const addition=(text?'\n':'')+part;if(text.length+addition.length>60000){text+=addition.slice(0,60000-text.length);truncated=true;break;}text+=addition;}
  if(visited>25000)truncated=true;
  const figures=[],seen=new Set();
  for(const element of root.querySelectorAll('img,svg,canvas')){
    if(figures.length>=20)break;if(element.closest(excluded)||!visible(element)||element.parentElement?.closest('svg'))continue;
    const rect=element.getBoundingClientRect();if(rect.width<80||rect.height<45)continue;
    const wrapper=element.closest('figure,[role="figure"],.figure,.fig');
    const caption=(wrapper?.querySelector('figcaption,.caption,.figcaption')?.textContent||element.getAttribute('alt')||element.getAttribute('aria-label')||`图 ${figures.length+1}`).trim().slice(0,2000);
    let src='';try{const url=new URL(element.currentSrc||element.getAttribute('src')||'',location.href);if(element.tagName==='IMG'&&/^https?:$/.test(url.protocol)&&!url.username&&!url.password)src=url.href;}catch{}
    if(src&&seen.has(src))continue;if(src)seen.add(src);
    let data='';
    if(element.tagName==='IMG'&&element.complete&&element.naturalWidth||element.tagName==='CANVAS')try{
      const w=element.naturalWidth||element.width,h=element.naturalHeight||element.height,scale=Math.min(1,1600/Math.max(w,h));
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
      const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(element,0,0,canvas.width,canvas.height);data=canvas.toDataURL('image/jpeg',.9);if(data.length>4*1024*1024)data='';
    }catch{}
    figures.push({data,src,caption,kind:element.tagName.toLowerCase(),rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},visible:rect.x>=0&&rect.y>=0&&rect.right<=innerWidth&&rect.bottom<=innerHeight});
  }
  const selected=getSelection()?.toString().trim().slice(0,60000)||'';
  return {title:document.title.slice(0,300),url:location.origin+location.pathname,text,selection:selected,truncated,figures,view:{width:innerWidth,height:innerHeight,x:scrollX,y:scrollY},href:location.href};
})();
