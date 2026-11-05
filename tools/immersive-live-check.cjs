/* Explicit live-provider smoke check, using public excerpts supplied in a local
 * JSON file. Never reads a user's browser profile, provider keys or settings. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const mocked=process.argv.includes('--mock');
if((!process.argv.includes('--live')&&!mocked)||!process.argv[3])throw new Error('Usage: node immersive-live-check.cjs report.json samples.json --live | --mock');
const root=path.resolve(__dirname,'..'),reportPath=path.resolve(process.argv[2]);
const samples=JSON.parse(fs.readFileSync(path.resolve(process.argv[3]),'utf8'));
assert.ok(samples.length>0&&samples.length<=12);
assert.ok(samples.every(x=>(/^https:\/\//.test(x.url)||x.kind==='generated')&&typeof x.text==='string'&&x.text.length>25&&x.text.length<=400),'Use bounded public excerpts or explicitly generated non-sensitive samples');
assert.ok(samples.reduce((sum,x)=>sum+x.text.length,0)<=4000,'Keep live trial input small');
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'qf-live-web-')),results=[],network=[];
let context;
const server=http.createServer((_req,res)=>{res.setHeader('content-type','text/html; charset=utf-8');res.end('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:16px/1.7 system-ui;max-width:860px;margin:32px auto;padding:0 18px}article{padding-bottom:24px;border-bottom:1px solid #ddd}h2{font-size:16px}</style><body><header data-edge-wt-ignore><h1>QudadFlow · '+(mocked?'多语言流程测试':'真实翻译抽测')+'</h1><p>公开节选 / 生成样例 · '+(mocked?'模拟服务':'默认服务')+' · 2026-11-05</p></header><main></main></body></html>');});
async function check(name,fn){try{await fn();results.push({name,passed:true});console.log('PASS '+name);}catch(error){results.push({name,passed:false,error:error.message});console.error('FAIL '+name+': '+error.message);}}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
  fs.mkdirSync(path.dirname(reportPath),{recursive:true});
  try{
    const extension=path.join(scratch,'extension');fs.mkdirSync(extension);
    for(const file of ['manifest.json','offscreen-translation.html','popup.html','popup.css','popup.js','options.html','options.css','options.js','privacy.html','src','assets','_locales'])fs.cpSync(path.join(root,file),path.join(extension,file),{recursive:true});
    const manifest=JSON.parse(fs.readFileSync(path.join(extension,'manifest.json'),'utf8'));manifest.host_permissions.push('http://127.0.0.1/*');fs.writeFileSync(path.join(extension,'manifest.json'),JSON.stringify(manifest));
    context=await chromium.launchPersistentContext(path.join(scratch,'profile'),{channel:'msedge',headless:true,viewport:{width:1440,height:1000},args:['--disable-extensions-except='+extension,'--load-extension='+extension]});
    if(mocked)await context.route('https://api.mymemory.translated.net/**',async route=>{
      const url=new URL(route.request().url()),sample=samples.find(item=>item.text===url.searchParams.get('q'));
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({responseStatus:200,responseData:{translatedText:'这是模拟中文译文：'+(sample?.id||'unknown')}})});
    });
    context.on('response',response=>{if(response.url().startsWith('https://api.mymemory.translated.net/')){const url=new URL(response.url()),sample=samples.find(item=>item.text===url.searchParams.get('q'));network.push({status:response.status(),languagePair:url.searchParams.get('langpair'),sampleId:sample?.id||'unknown'});}});
    const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
    if(mocked)await worker.evaluate(()=>{globalThis.requestBrowserTranslator=async()=>null;});
    await worker.evaluate(()=>chrome.storage.local.set({apiStyle:'auto-machine',sourceLanguage:'auto',targetLanguage:'zh-CN'}));
    const page=await context.newPage();await page.goto(origin+'/live');
    await page.locator('main').evaluate((main,samples)=>{for(const sample of samples){const article=document.createElement('article');article.id=sample.id;if(sample.language)article.lang=sample.language;if(['ar','he'].includes(sample.language))article.dir='rtl';const heading=document.createElement('h2');heading.setAttribute('data-edge-wt-ignore','1');const link=document.createElement(sample.url?'a':'span');if(sample.url)link.href=sample.url;link.textContent=sample.id+(sample.kind==='generated'?' · 生成样例':'');heading.append(link);const paragraph=document.createElement('p');paragraph.textContent=sample.text;article.append(heading,paragraph);main.append(article);}},samples);
    const tabId=await worker.evaluate(async url=>(await chrome.tabs.query({})).find(tab=>tab.url===url).id,page.url());
    await worker.evaluate(id=>chrome.scripting.executeScript({target:{tabId:id},files:['src/content.js']}),tabId);
    const send=message=>worker.evaluate(({id,message})=>chrome.tabs.sendMessage(id,message),{id:tabId,message});
    let initial,started=Date.now();
    await check((mocked?'simulated multilingual fallback':'default service')+' translates bounded samples',async()=>{
      let watchdog;const timeout=new Promise((_,reject)=>{watchdog=setTimeout(()=>{send({type:'RESTORE_IMMERSIVE'}).catch(()=>{});reject(new Error('Live smoke check exceeded its 60 second test budget'));},60000);});
      try{const response=await Promise.race([send({type:'TRANSLATE_IMMERSIVE'}),timeout]);assert.equal(response.ok,true,response.error);assert.equal(response.translatedCount,samples.length);}
      finally{clearTimeout(watchdog);}
      initial=await page.locator('article').evaluateAll(articles=>articles.map(el=>({id:el.id,source:el.querySelector('p').firstChild.textContent,translation:el.querySelector('[data-edge-wt-immersive-translation]')?.textContent||''})));
      for(const item of initial){assert.ok(/\p{Script=Han}/u.test(item.translation),'no Chinese translation: '+item.id);assert.notEqual(item.source,item.translation);assert.doesNotMatch(item.translation,/__EDGE_WT_|MYMEMORY WARNING|<script/i);}
      if(mocked)for(const sample of samples){const response=network.find(item=>item.sampleId===sample.id);assert.equal(response?.languagePair?.split('|')[0],sample.language,'wrong detected source for '+sample.id);}
      await page.screenshot({path:path.join(path.dirname(reportPath),'live-desktop.png'),fullPage:true,caret:'initial'});
      fs.writeFileSync(path.join(path.dirname(reportPath),'live-preview.html'),await page.content());
    });
    if(initial){
      const before=network.length;
      await check('second pass restores and reuses complete translations on a phone viewport',async()=>{
        await send({type:'RESTORE_IMMERSIVE'});assert.equal(await page.locator('[data-edge-wt-immersive-translation]').count(),0);
        await page.setViewportSize({width:390,height:900});const response=await send({type:'TRANSLATE_IMMERSIVE'});assert.equal(response.ok,true,response.error);
        assert.equal(network.length,before,'cached replay made an additional MyMemory request');
        const replay=await page.locator('article').evaluateAll(articles=>articles.map(el=>({id:el.id,source:el.querySelector('p').firstChild.textContent,translation:el.querySelector('[data-edge-wt-immersive-translation]')?.textContent||''})));assert.deepEqual(replay,initial);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
        await page.screenshot({path:path.join(path.dirname(reportPath),'live-phone.png'),fullPage:true,caret:'initial'});
        await send({type:'RESTORE_IMMERSIVE'});
      });
    }
    fs.writeFileSync(reportPath,JSON.stringify({generatedAt:new Date().toISOString(),scope:mocked?'Actual content script, extension worker and browser language detection with intercepted MyMemory responses; local model forced unavailable; no real upstream translation.':'Actual default auto-machine extension service; new isolated Edge profile; bounded public excerpts or explicitly generated non-sensitive samples; no custom credentials. Chinese presence is a smoke check, not a translation-quality score.',mocked,elapsedMs:Date.now()-started,inputCharacters:samples.reduce((sum,x)=>sum+x.text.length,0),upstreamResponses:network,translations:initial||[],passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length,results},null,2));
  }finally{await context?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.rmSync(scratch,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
  if(results.some(x=>!x.passed))process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
