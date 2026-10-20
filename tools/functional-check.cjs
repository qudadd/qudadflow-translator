/* Local integration checks. All credentials and API responses are synthetic. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const reportPath = path.resolve(process.argv[2] || path.join(root, '..', 'functional-results.json'));
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'qudadflow-check-'));
const results = [];
const requests = [];
let replyMode = 'normal';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const translation = text => String(text).replace(/Hello world/g, '你好，世界').replace(/Good morning/g, '早上好').replace(/Read more/g, '了解更多');
const fixture = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>QudadFlow integration fixture</title></head><body><main id="fixture"><h1>Hello world</h1><p id="first">Good morning <a href="#more">Read more</a>.</p><ul><li>Hello world</li></ul><div contenteditable="true"><p id="editor">PRIVATE EDITOR DRAFT</p></div><div style="opacity:0"><p>INVISIBLE TEXT</p></div><p style="display:none">HIDDEN TEXT</p><p translate="no">DO NOT TRANSLATE</p><p data-edge-wt-ignore>IGNORED TEXT</p></main></body></html>';
const server = http.createServer(async (req, res) => {
  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(fixture);
  }
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const url = new URL(req.url, 'http://localhost');
  const body = req.headers['content-type']?.includes('x-www-form-urlencoded') ? Object.fromEntries(new URLSearchParams(raw)) : JSON.parse(raw || '{}');
  requests.push({url, headers:req.headers, body});
  if (url.pathname === '/stall-headers') return;
  if (url.pathname === '/stall-body') { res.writeHead(200, {'Content-Type':'application/json'}); res.write('{'); return; }
  if (url.pathname === '/unauthorized') { res.writeHead(401); return res.end('{"error":{"message":"synthetic key rejected"}}'); }
  if (url.pathname === '/invalid') { res.writeHead(200); return res.end('{"unexpected":true}'); }
  const text = body.q?.[0] ?? body[0]?.Text ?? body.text ?? body.messages?.at(-1)?.content ?? body.prompt ?? '';
  if (replyMode === 'slow') await delay(200);
  let translated = translation(text);
  if (replyMode === 'no-markers') translated = translated.replace(/__EDGE_WT_\d+__/g, '');
  if (replyMode === 'html') translated = '<img src=x onerror="globalThis.injected=true">';
  const response = url.pathname.includes('google') ? {data:{translations:[{translatedText:translated}]}}
    : url.pathname.includes('microsoft') ? [{translations:[{text:translated}]}]
    : url.pathname.includes('deepl') ? {translations:[{text:translated}]}
    : url.pathname.includes('chat/completions') ? {choices:[{message:{content:translated}}]}
    : {data:{translation:translated}};
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(response));
});

async function check(name, fn) {
  const start = Date.now();
  try { await fn(); results.push({name, passed:true, milliseconds:Date.now()-start}); console.log(`PASS ${name}`); }
  catch (error) { results.push({name, passed:false, error:error.message, milliseconds:Date.now()-start}); console.log(`FAIL ${name}: ${error.message}`); }
}

function background(settings = {}, {permission = true, timeout = 800} = {}) {
  const listeners = [];
  const event = {addListener(){}};
  const context = vm.createContext({ URL, URLSearchParams, AbortController, console,
    setTimeout:(fn, ms)=>setTimeout(fn, ms === 45000 ? timeout : ms), clearTimeout, fetch,
    chrome:{
      runtime:{onInstalled:event,onStartup:event,onMessage:{addListener:fn=>listeners.push(fn)}},
      storage:{local:{get:(defaults,cb)=>cb({...defaults,...settings})}},
      permissions:{contains:(_p,cb)=>cb(permission)},
      contextMenus:{onClicked:event},commands:{onCommand:event}
    }
  });
  vm.runInContext(fs.readFileSync(path.join(root,'src/background.js'),'utf8'), context);
  return {context, send:message=>new Promise(resolve=>listeners[0](message,{},resolve))};
}

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const base = {apiKey:'SYNTHETIC-TEST-KEY',targetLanguage:'zh-CN',sourceLanguage:'auto'};
  let browser;
  let browserVersion;
  try {
    for (const [style, endpoint] of [['google-translate-v2','/google'],['microsoft-translator','/microsoft'],['deepl','/deepl'],['openai-compatible','/v1'],['custom-json','/custom']]) {
      await check(`${style}: HTTP request and response`, async()=>{
        const api = background({...base,apiStyle:style,endpoint:origin+endpoint,providerRegion:'eastus',responsePath:'data.translation'});
        const result = await api.send({type:'TRANSLATE_TEXT',text:'Hello world',targetLanguage:'ja'});
        assert.equal(result.ok,true,result.error);
        assert.equal(result.translation,'你好，世界');
        const r = requests.at(-1);
        if(style==='google-translate-v2') { assert.equal(r.url.searchParams.get('key'),base.apiKey); assert.equal(r.body.target,'ja'); assert.equal(r.body.source,undefined); }
        if(style==='microsoft-translator') { assert.equal(r.headers['ocp-apim-subscription-key'],base.apiKey); assert.equal(r.headers['ocp-apim-subscription-region'],'eastus'); assert.equal(r.url.searchParams.get('to'),'ja'); assert.equal(r.url.searchParams.get('api-version'),'3.0'); }
        if(style==='deepl') { assert.equal(r.headers.authorization,`DeepL-Auth-Key ${base.apiKey}`); assert.equal(r.body.target_lang,'JA'); assert.equal(r.body.source_lang,undefined); }
        if(style==='openai-compatible') { assert.equal(r.headers.authorization,`Bearer ${base.apiKey}`); assert.equal(r.url.pathname,'/v1/chat/completions'); assert.match(r.body.messages[0].content,/to ja/); }
        if(style==='custom-json') assert.equal(r.body.prompt,'Hello world');
      });
    }
    await check('DeepL: Chinese source uses ZH while target uses variant',async()=>{
      const api=background({...base,apiStyle:'deepl',endpoint:origin+'/deepl',sourceLanguage:'zh-CN'});
      const r=await api.send({type:'TRANSLATE_TEXT',text:'Hello world'});
      assert.equal(r.ok,true,r.error); assert.equal(requests.at(-1).body.source_lang,'ZH'); assert.equal(requests.at(-1).body.target_lang,'ZH-HANS');
    });
    await check('Custom template safely escapes quotes and line breaks',async()=>{
      const api=background({...base,apiStyle:'custom-json',endpoint:origin+'/custom',responsePath:'data.translation',customHeaders:'{"X-Test":"{{apiKey}}"}'});
      const input='"Hello world"\n\\ test';
      const r=await api.send({type:'TRANSLATE_TEXT',text:input}); assert.equal(r.ok,true,r.error); assert.equal(requests.at(-1).body.prompt,input); assert.equal(requests.at(-1).headers['x-test'],base.apiKey);
    });
    for (const [name, settings, message, options, match] of [
      ['Missing key',{apiKey:'',apiStyle:'openai-compatible'},{text:'Hello world'}, {}, /API Key/],
      ['Permission denied',{}, {text:'Hello world'}, {permission:false}, /尚未允许/],
      ['Empty input',{}, {text:' '}, {}, /没有可翻译/],
      ['Oversized input',{}, {text:'x'.repeat(12001)}, {}, /12000/],
      ['HTTP 401',{endpoint:origin+'/unauthorized'}, {text:'Hello world'}, {}, /401.*synthetic key rejected/],
      ['Missing response path',{endpoint:origin+'/invalid'}, {text:'Hello world'}, {}, /没有找到/],
      ['Invalid header object',{customHeaders:'[]'}, {text:'Hello world'}, {}, /JSON 对象/],
      ['Invalid template',{requestTemplate:'{bad'}, {text:'Hello world'}, {}, /模板不是有效/],
      ['Header timeout',{endpoint:origin+'/stall-headers'}, {text:'Hello world'}, {timeout:80}, /超时/],
      ['Body timeout',{endpoint:origin+'/stall-body'}, {text:'Hello world'}, {timeout:80}, /超时/]
    ]) await check(name,async()=>{
      const api=background({...base,apiStyle:'custom-json',endpoint:origin+'/custom',responsePath:'data.translation',...settings},options);
      let watchdog;
      const r=await Promise.race([api.send({type:'TRANSLATE_TEXT',...message}),new Promise(resolve=>{watchdog=setTimeout(()=>resolve({ok:true,error:'request hung beyond test deadline'}),1200);})]);
      clearTimeout(watchdog); assert.equal(r.ok,false,r.error); assert.match(r.error,match);
    });

    const extension = path.join(scratch,'extension');
    fs.mkdirSync(extension);
    for(const name of ['manifest.json','popup.html','popup.css','popup.js','options.html','options.css','options.js','privacy.html','src','assets','_locales']) fs.cpSync(path.join(root,name),path.join(extension,name),{recursive:true});
    const manifest=JSON.parse(fs.readFileSync(path.join(extension,'manifest.json'),'utf8'));
    // Local API + fixture only. Production manifest retains optional permissions.
    manifest.host_permissions=['http://127.0.0.1/*'];
    fs.writeFileSync(path.join(extension,'manifest.json'),JSON.stringify(manifest));
    browser=await chromium.launchPersistentContext(path.join(scratch,'profile'),{channel:'msedge',headless:true,viewport:{width:1440,height:1000},args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
    browserVersion=browser.browser().version();
    const worker=browser.serviceWorkers()[0] || await browser.waitForEvent('serviceworker',{timeout:15000});
    await check('Edge resolves localized manifest metadata and English product name',async()=>{
      const metadata=await worker.evaluate(()=>({manifest:chrome.runtime.getManifest(),name:chrome.i18n.getMessage('extensionName'),description:chrome.i18n.getMessage('extensionDescription')}));
      assert.equal(metadata.manifest.name,'QudadFlow Translator');
      assert.equal(metadata.name,metadata.manifest.name);
      assert.equal(metadata.manifest.description,metadata.description);
      assert.ok(['en','zh_CN'].some(locale=>JSON.parse(fs.readFileSync(path.join(root,'_locales',locale,'messages.json'),'utf8')).extensionDescription.message===metadata.description));
      assert.doesNotMatch(JSON.stringify(metadata.manifest),/__MSG_/);
    });
    const extensionOrigin=`chrome-extension://${worker.url().split('/')[2]}`;
    const options=await browser.newPage();
    await options.goto(extensionOrigin+'/options.html');
    await options.waitForFunction(()=>document.querySelector('#endpoint').value);
    await check('Provider switch resets endpoint and isolates credentials',async()=>{
      await options.locator('#apiKey').fill('PREVIOUS-PROVIDER-KEY');
      await options.locator('#apiStyle').selectOption('deepl');
      assert.equal(await options.locator('#endpoint').inputValue(),'https://api-free.deepl.com/v2/translate');
      assert.equal(await options.locator('#apiKey').inputValue(),'');
      await options.locator('#apiStyle').selectOption('openai-compatible');
      assert.equal(await options.locator('#apiKey').inputValue(),'PREVIOUS-PROVIDER-KEY');
    });
    const configure=async(extra={})=>{
      await worker.evaluate(async settings=>chrome.storage.local.set(settings),{...base,apiStyle:'custom-json',endpoint:origin+'/custom',customHeaders:'{}',requestTemplate:'{"prompt": {{text}}}',responsePath:'data.translation',...extra});
    };
    for (const [apiStyle, endpoint] of [['google-translate-v2','/google'],['microsoft-translator','/microsoft'],['deepl','/deepl'],['openai-compatible','/v1'],['custom-json','/custom']]) {
      await check(`Edge service worker: ${apiStyle}`,async()=>{
        await configure({apiStyle,endpoint:origin+endpoint});
        const r=await options.evaluate(()=>chrome.runtime.sendMessage({type:'TRANSLATE_TEXT',text:'Hello world'}));
        assert.equal(r.ok,true,r.error); assert.equal(r.translation,'你好，世界');
      });
    }
    await check('Context menus and command entries are registered',async()=>{
      const registered=await worker.evaluate(async()=>{
        const commands=await chrome.commands.getAll();
        const menus=[];
        for(const [id,title] of [['translate-selection','翻译选中文本'],['translate-immersive-page','沉浸式翻译当前网页']]) menus.push(await new Promise(resolve=>chrome.contextMenus.update(id,{title},()=>resolve({id,error:chrome.runtime.lastError?.message}))));
        return {commands,menus};
      });
      assert.ok(registered.commands.some(c=>c.name==='translate-selection'),JSON.stringify(registered));
      assert.ok(registered.commands.some(c=>c.name==='translate-immersive'),JSON.stringify(registered));
      assert.ok(registered.menus.every(m=>!m.error),JSON.stringify(registered.menus));
    });
    await configure();
    await options.reload();
    await options.waitForFunction(()=>document.querySelector('#apiStyle').value==='custom-json');
    await check('Options: reject arrays as custom headers',async()=>{
      await options.locator('#customHeaders').fill('[]');
      await options.locator('button[type=submit]').click();
      await delay(150);
      assert.match(await options.locator('#status').textContent(),/JSON 对象/);
      await options.locator('#customHeaders').fill('{}');
    });
    await check('Options: save and connection test via actual extension worker',async()=>{
      await options.locator('#customHeaders').fill('{}');
      await options.locator('#testApi').click();
      await options.waitForFunction(()=>document.querySelector('#status').textContent.includes('连接成功'));
    });
    await configure();
    const site=await browser.newPage();
    let tabId;
    async function resetSite(html) {
      replyMode='normal';
      await site.goto(origin+'/fixture');
      if(html) await site.locator('#fixture').evaluate((e,markup)=>e.innerHTML=markup,html);
      tabId=await worker.evaluate(async url=>(await chrome.tabs.query({url:url+'/*'})).find(tab=>tab.url.includes('/fixture')).id,origin);
      await worker.evaluate(async id=>chrome.scripting.executeScript({target:{tabId:id},files:['src/content.js']}),tabId);
    }
    const send=message=>worker.evaluate(({id,message})=>chrome.tabs.sendMessage(id,message),{id:tabId,message});
    const panel=()=>site.locator('#edge-web-translator-host');
    await check('Selection translation through content script and worker',async()=>{
      await resetSite();
      const r=await send({type:'TRANSLATE_SELECTION',selectionText:'Hello world'});
      assert.equal(r.ok,true,r.error); assert.equal(await panel().locator('.translation').textContent(),'你好，世界');
    });
    await check('Repeated injection keeps exactly one listener and panel',async()=>{
      await worker.evaluate(async id=>chrome.scripting.executeScript({target:{tabId:id},files:['src/content.js']}),tabId);
      const before=requests.length; await send({type:'TRANSLATE_SELECTION',selectionText:'Hello world'});
      assert.equal(requests.length-before,1); assert.equal(await panel().count(),1);
    });
    await check('API output renders as text, without HTML execution',async()=>{
      replyMode='html'; await send({type:'TRANSLATE_SELECTION',selectionText:'Hello world'});
      assert.equal(await panel().locator('img').count(),0); assert.match(await panel().locator('.translation').textContent(),/<img/); replyMode='normal';
    });
    await check('Clipboard failure reports failure',async()=>{
      await worker.evaluate(async id=>chrome.scripting.executeScript({target:{tabId:id},func:()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('synthetic clipboard denial');}}})}),tabId);
      await panel().locator('.copy').click();
      await delay(80); assert.match(await panel().locator('.status').textContent(),/失败|无法复制/);
    });
    await check('Immersive translation skips editors, invisible and opted out content',async()=>{
      await resetSite(); const r=await send({type:'TRANSLATE_IMMERSIVE'}); assert.equal(r.ok,true,r.error);
      assert.equal(r.translatedCount,3);
      assert.equal(await site.locator('#editor [data-edge-wt-immersive-translation]').count(),0);
    });
    await check('Nested excluded spans are omitted from both page modes',async()=>{
      await resetSite('<p>Hello world <span translate="no">PRIVATE OPT OUT</span><span data-edge-wt-ignore>PRIVATE IGNORE</span><span contenteditable>PRIVATE EDIT</span><span style="display:none">PRIVATE HIDDEN</span></p>');
      const before=requests.length;
      assert.equal((await send({type:'TRANSLATE_IMMERSIVE'})).ok,true);
      assert.equal((await send({type:'TRANSLATE_PAGE'})).ok,true);
      assert.doesNotMatch(requests.slice(before).map(r=>r.body.prompt).join('\n'),/PRIVATE/);
    });
    await check('Restore preserves original markup and link behavior',async()=>{
      await resetSite(); const original=await site.locator('#fixture').evaluate(e=>e.outerHTML);
      await site.locator('#first a').evaluate(e=>e.addEventListener('click',()=>e.dataset.clicked='yes'));
      await send({type:'TRANSLATE_IMMERSIVE'}); const r=await send({type:'RESTORE_IMMERSIVE'});
      assert.ok(r.count>=3); assert.equal(await site.locator('#fixture').evaluate(e=>e.outerHTML),original);
      await site.locator('#first a').click(); assert.equal(await site.locator('#first a').getAttribute('data-clicked'),'yes');
    });
    await check('Damaged batch markers trigger per-paragraph fallback',async()=>{
      await resetSite('<p>Hello world</p><p>Good morning</p>'); replyMode='no-markers';
      const before=requests.length; const r=await send({type:'TRANSLATE_IMMERSIVE'});
      assert.equal(r.translatedCount,2); assert.equal(requests.length-before,3); replyMode='normal';
    });
    await check('Restore during translation prevents late reinsertion',async()=>{
      await resetSite('<p>Hello world</p><p>Good morning</p>'); replyMode='slow';
      const before=requests.length; const pending=send({type:'TRANSLATE_IMMERSIVE'});
      while(requests.length===before) await delay(10);
      await send({type:'RESTORE_IMMERSIVE'}); const r=await pending;
      assert.equal(r.ok,false); assert.equal(await site.locator('[data-edge-wt-immersive-translation]').count(),0); replyMode='normal';
    });
    await check('Page translation excludes previously inserted translations',async()=>{
      await resetSite('<p>Hello world</p><p>Good morning</p>'); await send({type:'TRANSLATE_IMMERSIVE'});
      const before=requests.length; const r=await send({type:'TRANSLATE_PAGE'}); assert.equal(r.ok,true,r.error);
      const submitted=requests.slice(before).map(r=>r.body.prompt).join('\n'); assert.doesNotMatch(submitted,/你好，世界|早上好/);
    });
    await check('Closing panel cancels pending page result',async()=>{
      await resetSite('<p>Hello world</p>'); replyMode='slow'; const before=requests.length;
      const pending=send({type:'TRANSLATE_PAGE'}); while(requests.length===before) await delay(10);
      await panel().locator('.close').click(); await pending; assert.equal(await panel().count(),0); replyMode='normal';
    });
    await check('Newest selection result wins over older request',async()=>{
      await resetSite('<p>Hello world</p>'); replyMode='slow'; const before=requests.length;
      const older=send({type:'TRANSLATE_SELECTION',selectionText:'Hello world'}); while(requests.length===before) await delay(10);
      replyMode='normal'; await send({type:'TRANSLATE_SELECTION',selectionText:'Good morning'}); await older;
      assert.equal(await panel().locator('.translation').textContent(),'早上好');
    });
    await check('Page translation splits long text into bounded requests',async()=>{
      await resetSite('<p>'+('Hello world '.repeat(700))+'</p>'); const before=requests.length;
      const r=await send({type:'TRANSLATE_PAGE'}); assert.equal(r.ok,true,r.error);
      assert.ok(requests.length-before>1); assert.ok(requests.slice(before).every(r=>r.body.prompt.length<=2600));
    });
    await check('Long immersive paragraph is chunked and restored as one block',async()=>{
      await resetSite('<p>'+('Hello world '.repeat(1200))+'</p>'); const before=requests.length;
      const r=await send({type:'TRANSLATE_IMMERSIVE'}); assert.equal(r.ok,true,r.error); assert.equal(r.translatedCount,1);
      assert.ok(requests.length-before>1); assert.ok(requests.slice(before).every(r=>r.body.prompt.length<=2600));
      assert.equal((await send({type:'RESTORE_IMMERSIVE'})).count,1);
    });
    await check('Page size limit is visible to the user',async()=>{
      await resetSite('<p>'+('Hello world '.repeat(1200))+'</p>'); const before=requests.length;
      const r=await send({type:'TRANSLATE_PAGE'}); assert.equal(r.ok,true,r.error);
      assert.ok(requests.slice(before).map(r=>r.body.prompt).join('').length<=12000);
      assert.match(await panel().locator('.status').textContent(),/12000/);
    });
    await check('Popup buttons translate and restore the selected tab',async()=>{
      await resetSite('<p>Hello world</p><p>Good morning</p>');
      const popup=await browser.newPage(); await popup.goto(extensionOrigin+'/popup.html');
      await site.bringToFront(); await popup.reload();
      await popup.waitForFunction(()=>document.querySelector('#selection').textContent);
      await popup.locator('#translateImmersive').click();
      await popup.waitForFunction(()=>document.querySelector('#status').textContent.includes('2 个段落'));
      await popup.locator('#restoreImmersive').click();
      await popup.waitForFunction(()=>document.querySelector('#status').textContent.includes('已恢复 2'));
      await popup.close();
    });
    await check('Protected browser page rejects content injection',async()=>{
      const restricted=await browser.newPage(); await restricted.goto('edge://version');
      const restrictedId=await worker.evaluate(async()=> (await chrome.tabs.query({active:true,currentWindow:true}))[0].id);
      const result=await worker.evaluate(async id=>{try{await chrome.scripting.executeScript({target:{tabId:id},files:['src/content.js']});return 'unexpected success';}catch(e){return e.message;}},restrictedId);
      assert.match(result,/access|permission|Cannot|denied/i); await restricted.close();
    });
    await resetSite('<h1>QudadFlow Translator</h1><p>Hello world</p><p>Good morning <a href="#more">Read more</a>.</p>');
    await send({type:'TRANSLATE_IMMERSIVE'});
    await site.screenshot({path:path.join(path.dirname(reportPath),'qudadflow-functional-edge.png'),fullPage:true});
    await options.screenshot({path:path.join(path.dirname(reportPath),'qudadflow-functional-options.png'),fullPage:true});
  } finally {
    if(browser) await browser.close();
    server.closeAllConnections(); await new Promise(resolve=>server.close(resolve));
    const report={generatedAt:new Date().toISOString(),extensionVersion:JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8')).version,browser:browserVersion,scope:'Local synthetic HTTP API integration; test-only localhost host permission; original manifest side-load checked separately; provider billing/accounts not tested',passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results};
    fs.mkdirSync(path.dirname(reportPath),{recursive:true}); fs.writeFileSync(reportPath,JSON.stringify(report,null,2));
    // Only the newly created task-specific directory is removed.
    fs.rmSync(scratch,{recursive:true,force:true,maxRetries:3,retryDelay:200});
  }
  if(results.some(r=>!r.passed)) process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
