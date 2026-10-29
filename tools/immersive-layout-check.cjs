/* Browser-level placement checks across common article and application layouts. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),reportPath=path.resolve(process.argv[2]||'immersive-layout-results.json');
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'qf-immersive-layout-')),results=[];
const server=http.createServer(async(req,res)=>{
  if(req.method==='GET'){res.setHeader('content-type','text/html; charset=utf-8');return res.end('<!doctype html><meta charset="utf-8"><main id="fixture"></main>');}
  let raw='';for await(const chunk of req)raw+=chunk;
  const body=JSON.parse(raw),source=String(body.prompt||'');
  res.setHeader('content-type','application/json');res.end(JSON.stringify({data:{translation:source.replace(/Hello world/g,'你好，世界').replace(/Good morning/g,'早上好')}}));
});
const scenarios=[
  {name:'plain paragraphs',html:'<p id="a">Hello world first paragraph.</p><p id="b">Good morning second paragraph.</p>',targets:{a:1,b:1}},
  {name:'inline links and emphasis',html:'<p id="a">Hello world <a href="#reading"><strong>Good morning</strong></a> with <em>emphasis</em>.</p>',targets:{a:1}},
  {name:'direct text around a nested block',html:'<div id="a">Hello world before<p id="b">Good morning inside</p>Hello world after</div>',targets:{a:2,b:1}},
  {name:'grid cards',html:'<style>.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.grid article{min-width:0;padding:12px;border:1px solid #ccc}</style><div class="grid"><article id="a"><p>Hello world left card.</p></article><article id="b"><p>Good morning right card.</p></article></div>',targets:{a:1,b:1},geometry:['#a','#b']},
  {name:'flex cards',html:'<style>.flex{display:flex;gap:12px}.flex>div{flex:1;min-width:0;padding:12px}</style><div class="flex"><div id="a">Hello world flex card.</div><div id="b">Good morning flex card.</div></div>',targets:{a:1,b:1},geometry:['#a','#b']},
  {name:'table cells',html:'<table style="width:100%;table-layout:fixed"><tbody><tr><td id="a">Hello world cell.</td><td id="b">Good morning cell.</td></tr></tbody></table>',targets:{a:1,b:1},geometry:['#a','#b']},
  {name:'list and blockquote',html:'<ul><li id="a">Hello world list item.</li><li id="b">Good morning list item.</li></ul><blockquote id="c">Hello world quote.</blockquote>',targets:{a:1,b:1,c:1}},
  {name:'display contents',html:'<div id="a"><span style="display:contents">Hello world contents <em>Good morning emphasis</em>.</span></div>',targets:{a:1}},
  {name:'right-to-left paragraph',html:'<p id="a" dir="rtl" style="text-align:right">Hello world right-to-left container.</p>',targets:{a:1}},
  {name:'vertical writing',html:'<p id="a" style="writing-mode:vertical-rl;height:230px">Hello world vertical text.</p>',targets:{a:1}},
  {name:'float beside text',html:'<div style="max-width:560px"><img alt="" style="float:left;width:80px;height:80px"><p id="a">Hello world paragraph that wraps beside an image and continues on another line.</p></div>',targets:{a:1}},
  {name:'sticky and transformed containers',html:'<div style="transform:translateX(20px)"><p id="a" style="position:sticky;top:0">Hello world sticky text.</p><p id="b">Good morning transformed text.</p></div>',targets:{a:1,b:1}},
  {name:'details summary and body',html:'<details open><summary id="a">Hello world summary.</summary><p id="b">Good morning expanded body.</p></details>',targets:{a:1,b:1}},
  {name:'excluded inline annotation',html:'<p id="a">Hello world source <span translate="no">PRIVATE ANNOTATION</span></p>',targets:{a:1}}
];
let context;
async function check(name,fn){try{await fn();results.push({name,passed:true});console.log('PASS '+name);}catch(error){results.push({name,passed:false,error:error.message});console.log('FAIL '+name+': '+error.message);}}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
  try{
    const extension=path.join(scratch,'extension');fs.mkdirSync(extension);
    for(const file of ['manifest.json','offscreen-translation.html','popup.html','popup.css','popup.js','options.html','options.css','options.js','privacy.html','src','assets','_locales'])fs.cpSync(path.join(root,file),path.join(extension,file),{recursive:true});
    const manifest=JSON.parse(fs.readFileSync(path.join(extension,'manifest.json'),'utf8'));manifest.host_permissions=['http://127.0.0.1/*','https://api.mymemory.translated.net/*'];fs.writeFileSync(path.join(extension,'manifest.json'),JSON.stringify(manifest));
    context=await chromium.launchPersistentContext(path.join(scratch,'profile'),{channel:'msedge',headless:true,viewport:{width:1440,height:900},args:['--disable-extensions-except='+extension,'--load-extension='+extension]});
    const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
    await worker.evaluate(values=>chrome.storage.local.set(values),{apiStyle:'custom-json',endpoint:origin+'/translate',apiKey:'',model:'',sourceLanguage:'en',targetLanguage:'zh-CN',requestTemplate:'{"prompt": {{text}}}',responsePath:'data.translation'});
    for(const width of [390,1440])for(const scenario of scenarios){
      await check(`${width}px: ${scenario.name}`,async()=>{
        const page=await context.newPage();page.setDefaultTimeout(10000);await page.setViewportSize({width,height:900});await page.goto(origin+'/fixture');
        try{
          await page.locator('#fixture').evaluate((element,html)=>{element.innerHTML=html;},scenario.html);
          const before=await page.evaluate(selectors=>selectors.map(selector=>{const rect=document.querySelector(selector).getBoundingClientRect();return {left:rect.left,width:rect.width};}),scenario.geometry||[]);
          const tabId=await worker.evaluate(async url=>(await chrome.tabs.query({})).find(tab=>tab.url===url)?.id,page.url());
          assert.ok(tabId,'fixture tab missing');await worker.evaluate(id=>chrome.scripting.executeScript({target:{tabId:id},files:['src/content.js']}),tabId);
          const response=await worker.evaluate(id=>chrome.tabs.sendMessage(id,{type:'TRANSLATE_IMMERSIVE'}),tabId);
          assert.equal(response.ok,true,response.error);
          const state=await page.evaluate(({targets,geometry})=>{
            const paired=Object.fromEntries(Object.entries(targets).map(([id,count])=>{
              const element=document.getElementById(id),translations=[...element.querySelectorAll('[data-edge-wt-immersive-translation="1"]')].filter(node=>node.closest('[id]')===element);
              let placement=true;
              if(translations.length===1 && count===1 && getComputedStyle(element).writingMode==='horizontal-tb'){
                const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT),rects=[];
                while(walker.nextNode()){
                  const node=walker.currentNode;
                  if(node.parentElement.closest('[data-edge-wt-immersive-translation]')||node.parentElement.closest('[id]')!==element)continue;
                  const range=document.createRange();range.selectNodeContents(node);
                  rects.push(...Array.from(range.getClientRects()).filter(rect=>rect.width>0&&rect.height>0));
                }
                if(rects.length){const box=translations[0].getBoundingClientRect();placement=box.top>=Math.max(...rects.map(rect=>rect.bottom))-1;}
              }
              return [id,{expected:count,count:translations.length,visible:translations.every(node=>{const box=node.getBoundingClientRect();return box.width>0&&box.height>0;}),outsideLinks:translations.every(node=>!node.closest('a')),placement,writingMode:translations.every(node=>getComputedStyle(node).writingMode===getComputedStyle(element).writingMode),texts:translations.map(node=>node.textContent),parents:translations.map(node=>node.parentElement.tagName)}];
            }));
            const boxes=geometry.map(selector=>{const rect=document.querySelector(selector).getBoundingClientRect();return {left:rect.left,width:rect.width};});
            return {paired,boxes};
          },{targets:scenario.targets,geometry:scenario.geometry||[]});
          for(const [id,pair] of Object.entries(state.paired)){assert.equal(pair.count,pair.expected,`${id} translation count: ${JSON.stringify(pair)}`);assert.equal(pair.visible,true,`${id} translation invisible`);assert.equal(pair.outsideLinks,true,`${id} translation entered a link`);assert.equal(pair.placement,true,`${id} translation precedes source text`);assert.equal(pair.writingMode,true,`${id} translation uses a different writing mode`);assert.ok(pair.texts.every(text=>text && !/__EDGE_WT_/.test(text)),`${id} marker shown`);}
          state.boxes.forEach((box,index)=>{assert.ok(Math.abs(box.left-before[index].left)<1,`${scenario.name} left shifted`);assert.ok(Math.abs(box.width-before[index].width)<1,`${scenario.name} width shifted`);});
          const restored=await worker.evaluate(id=>chrome.tabs.sendMessage(id,{type:'RESTORE_IMMERSIVE'}),tabId);assert.equal(restored.ok,true,restored.error);
          assert.equal(await page.locator('[data-edge-wt-immersive-translation]').count(),0);
        }catch(error){const screenshot=path.join(path.dirname(reportPath),`immersive-layout-${width}-${scenario.name.replace(/[^a-z0-9]+/gi,'-')}.png`);await page.screenshot({path:screenshot,fullPage:true}).catch(()=>{});throw error;}
        finally{await page.close();}
      });
    }
    for(const width of [390,1440])for(const kind of ['shadow','frame'])await check(`${width}px: open ${kind} root`,async()=>{
      const page=await context.newPage();page.setDefaultTimeout(10000);await page.setViewportSize({width,height:900});await page.goto(origin+'/fixture');
      try{
        await page.locator('#fixture').evaluate((element,kind)=>{
          if(kind==='shadow'){const host=document.createElement('div');host.id='component';host.attachShadow({mode:'open'}).innerHTML='<article><p id="inner">Hello world in shadow.</p></article>';element.append(host);}
          else{const frame=document.createElement('iframe');frame.id='frame';frame.srcdoc='<p id="inner">Good morning in frame.</p>';element.append(frame);}
        },kind);
        if(kind==='frame')await page.waitForFunction(()=>document.querySelector('#frame')?.contentDocument?.getElementById('inner'));
        const tabId=await worker.evaluate(async url=>(await chrome.tabs.query({})).find(tab=>tab.url===url)?.id,page.url());
        await worker.evaluate(id=>chrome.scripting.executeScript({target:{tabId:id},files:['src/content.js']}),tabId);
        const response=await worker.evaluate(id=>chrome.tabs.sendMessage(id,{type:'TRANSLATE_IMMERSIVE'}),tabId);assert.equal(response.ok,true,response.error);
        const count=await page.evaluate(kind=>kind==='shadow'?document.querySelector('#component').shadowRoot.querySelectorAll('#inner [data-edge-wt-immersive-translation]').length:document.querySelector('#frame').contentDocument.querySelectorAll('#inner [data-edge-wt-immersive-translation]').length,kind);
        assert.equal(count,1);
        if(kind==='frame'){
          // Old frame Documents can still contain connected text nodes while
          // defaultView has become null. They must be pruned without stopping scans.
          await page.locator('#frame').evaluate(frame=>frame.srcdoc='<p id="inner">Hello world after reload.</p>');
          await page.waitForFunction(()=>document.querySelector('#frame').contentDocument?.querySelector('#inner [data-edge-wt-immersive-translation]')?.textContent==='你好，世界 after reload.');
        }
        await worker.evaluate(id=>chrome.tabs.sendMessage(id,{type:'RESTORE_IMMERSIVE'}),tabId);
        const restored=await page.evaluate(kind=>kind==='shadow'?document.querySelector('#component').shadowRoot.querySelectorAll('[data-edge-wt-immersive-translation]').length:document.querySelector('#frame').contentDocument.querySelectorAll('[data-edge-wt-immersive-translation]').length,kind);
        assert.equal(restored,0);
      }finally{await page.close();}
    });
  }catch(error){results.push({name:'suite setup',passed:false,error:error.message});console.error(error);}
  finally{await context?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.rmSync(scratch,{recursive:true,force:true,maxRetries:5,retryDelay:200});fs.mkdirSync(path.dirname(reportPath),{recursive:true});fs.writeFileSync(reportPath,JSON.stringify({passed:results.filter(item=>item.passed).length,failed:results.filter(item=>!item.passed).length,results},null,2));console.log(JSON.stringify({passed:results.filter(item=>item.passed).length,failed:results.filter(item=>!item.passed).length}));if(results.some(item=>!item.passed))process.exitCode=1;}
})().catch(error=>{console.error(error);process.exitCode=1;});
