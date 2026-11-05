/* Explicit public-site checks. New browser profile, real site scripts/styles,
 * synthetic local translations. No credentials or existing browser sessions. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
if(!process.argv.includes('--online')||!process.argv[3])throw new Error('Usage: node immersive-online-check.cjs report.json public-sites.json --online');
const root=path.resolve(__dirname,'..'),reportPath=path.resolve(process.argv[2]),sites=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
assert.ok(sites.length>0&&sites.length<=24&&sites.every(site=>/^https:\/\//.test(site.url)));
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'qf-online-web-')),results=[],unavailable=[],measurements=[];
let context,requests=0;
const selector='[data-edge-wt-immersive-translation="1"]';
const translate=text=>String(text).split(/(__EDGE_WT_\d+__)/g).map(part=>/^__EDGE_WT_\d+__$/.test(part)?part:part.trim()?'这是模拟译文，用于检验在线页面排版。'.repeat(Math.ceil(part.trim().length/18)).slice(0,Math.max(2,part.trim().length)):'').join('');
const server=http.createServer(async(req,res)=>{let raw='';for await(const chunk of req)raw+=chunk;requests++;res.setHeader('content-type','application/json');res.end(JSON.stringify({data:{translation:translate(JSON.parse(raw).prompt)}}));});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 fs.mkdirSync(path.dirname(reportPath),{recursive:true});
 try{
  const extension=path.join(scratch,'extension');fs.mkdirSync(extension);
  for(const file of ['manifest.json','offscreen-translation.html','popup.html','popup.css','popup.js','options.html','options.css','options.js','privacy.html','src','assets','_locales'])fs.cpSync(path.join(root,file),path.join(extension,file),{recursive:true});
  const manifest=JSON.parse(fs.readFileSync(path.join(extension,'manifest.json'),'utf8'));
  manifest.host_permissions=['http://127.0.0.1/*',...new Set(sites.map(site=>new URL(site.url).origin+'/*'))];
  fs.writeFileSync(path.join(extension,'manifest.json'),JSON.stringify(manifest));
  context=await chromium.launchPersistentContext(path.join(scratch,'profile'),{channel:'msedge',headless:true,viewport:{width:1280,height:900},args:['--disable-extensions-except='+extension,'--load-extension='+extension]});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker',{timeout:15000});
  await worker.evaluate(values=>chrome.storage.local.set(values),{apiStyle:'custom-json',endpoint:origin+'/translate',apiKey:'',sourceLanguage:'auto',targetLanguage:'zh-CN',requestTemplate:'{"prompt": {{text}}}',responsePath:'data.translation'});
  let next=0;
  await Promise.all(Array.from({length:2},async()=>{
   while(next<sites.length){
    const site=sites[next++],page=await context.newPage();page.setDefaultTimeout(8000);
    const width=site.width||1280;await page.setViewportSize({width,height:900});const started=Date.now();
    let phase='navigation',baseline;
    try{
     const response=await page.goto(site.url,{waitUntil:'domcontentloaded',timeout:30000});
     if(!response?.ok())throw new Error('HTTP '+response?.status());
     await page.waitForLoadState('load',{timeout:15000}).catch(()=>{});
     await page.evaluate(()=>Promise.race([document.fonts.ready,new Promise(resolve=>setTimeout(resolve,5000))]));
     const title=await page.title();
     if(/just a moment|access denied|checking your browser|verify you are human|captcha|^403/i.test(title))throw new Error('Access challenge; not bypassed');
     const before=await page.evaluate(()=>{
      window.__qfOnlineOriginal=[...document.querySelectorAll('main p,article p,body p')].slice(0,24).map(el=>({el,text:el.textContent}));
      window.__qfOnlineBoxes=new Map([...document.body.querySelectorAll('*')].map(el=>[el,el.getBoundingClientRect().toJSON()]));
      window.__qfOnlineAuthors=[...document.querySelectorAll('.c-article-author-list,.authors-list')].filter(el=>el.getBoundingClientRect().height>0).map(el=>({el,html:el.innerHTML}));
      return{width:document.documentElement.scrollWidth,paragraphs:document.querySelectorAll('p').length,stylesheets:document.styleSheets.length};
     });
     baseline=before;
     assert.ok(before.paragraphs>2,'page did not expose enough readable paragraphs');
     const tabId=await worker.evaluate(async url=>(await chrome.tabs.query({})).find(tab=>tab.url===url)?.id,page.url());
     assert.ok(tabId,'public tab not found');phase='translation';
     await worker.evaluate(id=>chrome.scripting.executeScript({target:{tabId:id},files:['src/content.js']}),tabId);
     const send=message=>worker.evaluate(({id,message})=>chrome.tabs.sendMessage(id,message),{id:tabId,message});
     let timer;
     const result=await Promise.race([send({type:'TRANSLATE_IMMERSIVE'}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Online page exceeded the 75-second translation budget')),75000);})]).finally(()=>clearTimeout(timer));
     assert.equal(result.ok,true,result.error);
     const translated=await page.evaluate(s=>({count:document.querySelectorAll(s).length,width:document.documentElement.scrollWidth,protected:document.querySelectorAll('pre '+s+',code '+s+',math '+s+',.katex '+s+',mjx-container '+s).length,markers:[...document.querySelectorAll(s)].some(el=>/__EDGE_WT_/.test(el.textContent)),authorGroups:(window.__qfOnlineAuthors||[]).map(({el,html})=>({unchanged:el.innerHTML===html,internal:el.querySelectorAll(s).length})),authorTranslations:document.querySelectorAll('[data-edge-wt-author-translation]').length,pinnedNavigation:[...document.querySelectorAll('nav,header,[role="navigation"],[role="banner"]')].filter(el=>['fixed','sticky'].includes(getComputedStyle(el).position)&&(el.matches('nav,[role="navigation"]')||el.querySelector('nav,[role="navigation"]'))).map(el=>({tag:el.tagName,position:getComputedStyle(el).position,height:el.getBoundingClientRect().height,translations:el.querySelectorAll(s).length})),stylesheets:document.styleSheets.length}),selector);
     assert.ok(translated.count>2,'insufficient translated content');assert.equal(translated.protected,0);assert.equal(translated.markers,false);
     for(const authors of translated.authorGroups){assert.equal(authors.unchanged,true,'online publisher author markup changed');assert.equal(authors.internal,0,'online authors received per-person blocks');}
     assert.ok(translated.pinnedNavigation.every(item=>item.translations===0),'pinned navigation contains injected translations');
     assert.ok(translated.width<=Math.max(before.width,width)+2,'translation increased online page overflow: '+before.width+' → '+translated.width);
     await page.screenshot({path:path.join(path.dirname(reportPath),'online-'+site.id+'-'+width+'.png'),caret:'initial'});
     await send({type:'RESTORE_IMMERSIVE'});
     assert.equal(await page.locator(selector).count(),0);assert.equal(await page.locator('[data-edge-wt-unclipped]').count(),0);
     measurements.push({id:site.id,url:page.url(),title,viewportWidth:width,before,...translated,elapsedMs:Date.now()-started});
     results.push({name:'online '+site.id+' '+width+'px',passed:true});console.log('PASS online '+site.id+' '+width+'px');
    }catch(error){
     if(phase==='navigation'){unavailable.push({id:site.id,url:site.url,error:error.message});console.log('UNAVAILABLE online '+site.id+': '+error.message);}
     else{
      const diagnostic=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow:[...document.body.querySelectorAll('*')].filter(el=>el.getBoundingClientRect().right>innerWidth+2).slice(0,35).map(el=>({tag:el.tagName,classes:el.className,text:el.textContent.slice(0,100),before:window.__qfOnlineBoxes?.get(el),after:el.getBoundingClientRect().toJSON(),clipping:el.getAttribute('data-edge-wt-unclipped')}))})).catch(()=>({}));
      diagnostic.translationGeometry=await page.evaluate(()=>{
        const inspect=el=>({tag:el.tagName,classes:el.className,text:el.textContent.slice(0,65),box:el.getBoundingClientRect().toJSON(),before:window.__qfOnlineBoxes?.get(el),styles:['display','position','width','minWidth','maxWidth','whiteSpace','overflowX','overflowY','flexShrink'].map(key=>[key,getComputedStyle(el)[key]])});
        return {changed:[...document.body.querySelectorAll('*')].filter(el=>{const old=window.__qfOnlineBoxes?.get(el),r=el.getBoundingClientRect();return old&&r.right>innerWidth+2&&r.right>old.right+2;}).slice(0,20).map(inspect),expanded:[...document.querySelectorAll('[data-edge-wt-unclipped]')].map(inspect),translations:[...document.querySelectorAll('[data-edge-wt-immersive-translation]')].filter(el=>{const range=document.createRange();range.selectNodeContents(el);return range.getBoundingClientRect().right>innerWidth+2;}).slice(0,15).map(el=>({output:inspect(el),ancestors:Array.from((function*(node){for(let i=0;node&&i<5;i++,node=node.parentElement)yield node;})(el.parentElement)).map(inspect)}))};
      }).catch(()=>({}));
      await page.screenshot({path:path.join(path.dirname(reportPath),'failure-online-'+site.id+'.png'),caret:'initial'}).catch(()=>{});
      const tabId=await worker.evaluate(async url=>(await chrome.tabs.query({})).find(tab=>tab.url===url)?.id,page.url()).catch(()=>null);
      if(tabId)await worker.evaluate(id=>chrome.tabs.sendMessage(id,{type:'RESTORE_IMMERSIVE'}),tabId).catch(()=>{});
      diagnostic.restoredWidth=await page.evaluate(()=>document.documentElement.scrollWidth).catch(()=>null);diagnostic.baseline=baseline;
      fs.writeFileSync(path.join(path.dirname(reportPath),'online-diagnostic-'+site.id+'.json'),JSON.stringify(diagnostic,null,2));
      results.push({name:'online '+site.id+' '+width+'px',passed:false,error:error.message});console.error('FAIL online '+site.id+': '+error.message);
     }
    }finally{await page.close();}
   }
  }));
 }catch(error){results.push({name:'suite setup',passed:false,error:error.message});}
 finally{
  await context?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.rmSync(scratch,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  const report={generatedAt:new Date().toISOString(),scope:'Real public pages including their scripts/styles, isolated Edge MV3; synthetic local translations, not upstream language quality. Unavailable pages are excluded from passed/failed checks.',passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length,requests,measurements,results,unavailable};fs.writeFileSync(reportPath,JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failed:report.failed,unavailable:unavailable.length}));if(report.failed)process.exitCode=1;
 }
})();
