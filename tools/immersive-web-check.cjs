/* Broad webpage regressions. Providers and credentials are synthetic; public DOM
 * snapshots, screenshots and browser profiles stay outside the source repository. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const reportPath = path.resolve(process.argv[2] || 'immersive-web-results.json');
const corpusDir = process.argv[3] && path.resolve(process.argv[3]);
const browserChannel = process.env.QF_WEB_BROWSER || 'msedge';
const domOnly = process.env.QF_WEB_DOM_ONLY === '1';
const widths = (process.env.QF_WEB_WIDTHS || '390,768,1440').split(',').map(Number);
const corpusWidths = (process.env.QF_WEB_CORPUS_WIDTHS || '390,1440').split(',').map(Number);
assert.ok([...widths,...corpusWidths].every(width=>Number.isInteger(width)&&width>=280&&width<=3840));
const expansion = Number(process.env.QF_WEB_EXPANSION || 1);
assert.ok(Number.isFinite(expansion)&&expansion>=1&&expansion<=4);
let replayingCorpus = false;
let responseDelay = 0;
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'qf-web-'));
const results = [], requests = [], measurements = [];
const selector = '[data-edge-wt-immersive-translation="1"]';
const tick = ms => new Promise(resolve => setTimeout(resolve, ms));
const translate = text => String(text).split(/(__EDGE_WT_\d+__)/).map(part => {
  if(/^__EDGE_WT_\d+__$/.test(part))return part;
  if(replayingCorpus && expansion>1 && part.trim()){
    const length=Math.ceil(part.trim().length*expansion),unit='模拟扩展译文，用于检查布局。';
    return unit.repeat(Math.ceil(length/unit.length)).slice(0,length);
  }
  return part.replace(/Good morning flexible footer sentence\./g,'这是一条用于验证页脚链接不应扩展页面宽度的长译文。').replace(/Alice Format, Bob Format/g,'艾丽斯\n鲍勃').replace(/Hello world/g, '你好，世界').replace(/Good morning/g, '早上好');
}).join('');
let context, sequence = 0;
const server = http.createServer(async (req, res) => {
  if (req.method === 'GET') {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.setHeader('content-security-policy', "script-src 'none'; object-src 'none'; frame-src 'self'");
    return res.end('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:16px/1.5 system-ui;margin:24px;color:#222}*{box-sizing:border-box}main{max-width:1100px}p{margin:16px 0}</style></head><body><main id="fixture"></main></body></html>');
  }
  try {
    let raw = ''; for await (const part of req) raw += part;
    const body = JSON.parse(raw), text = String(body.prompt || '');
    requests.push(text);
    if(responseDelay)await tick(responseDelay);
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({data:{translation:translate(text)}}));
  } catch (error) { res.statusCode = 500; res.end(error.message); }
});
async function check(name, fn) {
  if(process.env.QF_WEB_CASE && !new RegExp(process.env.QF_WEB_CASE,'i').test(name))return;
  const started = Date.now();
  try { await fn(); results.push({name, passed:true, durationMs:Date.now()-started}); console.log('PASS '+name); }
  catch (error) { results.push({name, passed:false, error:error.stack, durationMs:Date.now()-started}); console.error('FAIL '+name+': '+error.message); }
}
async function until(fn, timeout = 4500) {
  const deadline = Date.now()+timeout;
  while (!await fn()) { assert.ok(Date.now()<deadline, 'dynamic update did not settle'); await tick(60); }
}
function sameMarkup(actual, expected) {
  if(actual===expected)return;
  let offset=0;while(actual[offset]===expected[offset]&&offset<Math.min(actual.length,expected.length))offset++;
  assert.fail('Source markup changed at '+offset+': '+JSON.stringify({actual:actual.slice(Math.max(0,offset-70),offset+130),expected:expected.slice(Math.max(0,offset-70),offset+130)}));
}
const fixtures = [
  {name:'paper authors: inline publisher list stays in its original rows',html:'<style>.c-article-author-list{padding:0;margin:0;list-style:none}.c-article-author-list li{display:inline}.c-article-author-list li:not(:last-child)::after{content:", "}</style><section id="a"><ul id="names" class="c-article-author-list" data-test="authors-list"><li><a data-test="author-name" href="#alice">Alice Smith</a><sup><a href="#aff1">AFFILIATION_SENTINEL</a></sup></li><li><a data-test="author-name" href="#bob">Bob Jones</a><sup>*</sup></li><li><a data-test="author-name" href="#chen">Chen Wang</a></li><li><a data-test="author-name" href="#dina">Dina García</a></li></ul></section><p id="b">Hello world clinical evidence.</p>',targets:['a','b'],authors:'names',authorNames:['Alice Smith','Bob Jones','Chen Wang','Dina García'],forbidden:/AFFILIATION_SENTINEL/},
  {name:'paper authors: PubMed inline items retain affiliation links',html:'<section id="a"><div id="names" class="authors-list"><span class="authors-list-item"><a class="full-name" href="#one">Chaofan Li</a><sup><a href="#aff1">1</a><a href="#equal">EQUAL_SENTINEL</a></sup>, </span><span class="authors-list-item"><a class="full-name" href="#two">Fan Song</a><sup>2</sup>, </span><span class="authors-list-item"><a class="full-name" href="#three">Chaohua Wang</a><sup>*</sup></span></div></section><p id="b">Good morning research methods.</p>',targets:['a','b'],authors:'names',authorNames:['Chaofan Li','Fan Song','Chaohua Wang'],forbidden:/EQUAL_SENTINEL/},
  {name:'paper authors: flex wrapping retains names and ORCID controls',html:'<style>.author-group{display:flex;flex-wrap:wrap;gap:8px}.person{display:inline-flex;align-items:baseline;gap:2px}</style><section id="a"><div id="names" class="author-group"><span class="person"><a class="author-name" href="#one">Alice Smith</a><sup>1</sup><a href="https://orcid.org/0000-0001-0000-0001">ORCID_SENTINEL</a></span><span class="person"><a class="author-name" href="#two">Bob Jones</a><sup>*</sup></span><span class="person"><a class="author-name" href="#three">Chen Wang</a></span></div></section>',targets:['a'],authors:'names',authorNames:['Alice Smith','Bob Jones','Chen Wang'],forbidden:/ORCID_SENTINEL/},
  {name:'paper authors: schema names retain Unicode and duplicate surnames',html:'<section id="a"><div id="names"><span itemprop="author" itemscope itemtype="https://schema.org/Person"><span itemprop="name">Élodie Müller</span><sup>1</sup></span>, <span itemprop="author" itemscope><span itemprop="name">李明</span><sup>2</sup></span>, <span itemprop="author" itemscope><span itemprop="name">Élodie Müller</span><sup>*</sup></span></div></section>',targets:['a'],authors:'names',authorNames:['Élodie Müller','李明','Élodie Müller']},
  {name:'paper authors: simple named list retains a single translation',html:'<style>.author-list{display:flex;flex-wrap:wrap;gap:12px;padding:0;list-style:none}</style><section id="a"><ul id="names" class="author-list"><li>Alice Smith<sup>1</sup></li><li>Bob Jones<sup>2</sup></li><li>Chen Wang<sup>*</sup></li></ul></section><p id="b">Good morning institutional information.</p>',targets:['a','b'],authors:'names',authorNames:['Alice Smith','Bob Jones','Chen Wang']},
  {name:'paper authors: Wiley list keeps mail links and natural wrapping',html:'<style>.loa__authors{list-style:none;padding:0}.loa__authors li{display:inline-block;margin-right:8px}</style><section id="a"><ul id="names" class="loa__authors"><li><a class="author-name" href="#one">Alice Smith</a><sup>1</sup><a href="mailto:synthetic@example.invalid">CONTACT_SENTINEL</a></li><li><a class="author-name" href="#two">Bob Jones</a><sup>*</sup></li><li><a class="author-name" href="#three">Chen Wang</a></li></ul></section>',targets:['a'],authors:'names',authorNames:['Alice Smith','Bob Jones','Chen Wang'],forbidden:/CONTACT_SENTINEL/},
  {name:'paper authors: plain byline and affiliation remain separate paragraphs',html:'<section id="a"><p id="names" class="article-authors">Alice Smith, Bob Jones &amp; Chen Wang</p></section><p id="b" class="affiliation">Hello world Department of Clinical Research.</p><section class="author-contributions"><h2 id="c">Good morning author contributions.</h2><p id="d">Hello world the first author designed the study.</p></section>',targets:['a','b','c','d'],authors:'names',authorNames:['Alice Smith, Bob Jones & Chen Wang']},
  {name:'paper authors: paragraph-wrapped and split schema names stay complete',html:'<section id="a"><ul id="names" class="author-list"><li><p><a class="author-name" href="#one"><span itemprop="givenName">Alice</span><span itemprop="familyName">Smith</span></a></p><sup>1</sup></li><li><p><a class="author-name" href="#two">Bob Jones</a></p><sup>*</sup></li></ul></section>',targets:['a'],authors:'names',authorNames:['Alice Smith','Bob Jones']},
  {name:'paper authors: upstream line breaks do not stack one name per row',html:'<section id="a"><div id="names" class="author-list"><a class="author-name" href="#one">Alice Format</a>, <a class="author-name" href="#two">Bob Format</a></div></section>',targets:['a'],authors:'names',authorNames:['Alice Format','Bob Format'],authorOutput:['艾丽斯','鲍勃']},
  {name:'paper authors: row metadata controls retain source widths',html:'<section id="a"><div id="metaRow" style="display:flex;gap:12px;align-items:start"><ul id="names" class="author-list" style="list-style:none;padding:0;margin:0"><li style="display:inline"><a class="author-name" href="#one">Alice Smith</a>, </li><li style="display:inline"><a class="author-name" href="#two">Bob Jones</a></li></ul><button>Show author details</button></div></section>',targets:['a'],authors:'names',authorNames:['Alice Smith','Bob Jones'],authorAnchor:'metaRow'},
  {name:'paper authors: Chinese majority does not hide a foreign contributor',html:'<section id="a"><div id="names" class="authors-list"><span class="full-name">李明</span>、<span class="full-name">王芳</span>、<span class="full-name">张强</span>、<span class="full-name">刘敏</span>、<span class="full-name">陈静</span>、<span class="full-name">赵雷</span>、<span class="full-name">周华</span>、<span class="full-name">Alice Wu</span></div></section>',targets:['a'],authors:'names',authorNames:['李明','王芳','张强','刘敏','陈静','赵雷','周华','Alice Wu']},
  {name:'paper with abstract, citations and figure captions', html:'<article><h1 id="a">Hello world research paper</h1><section><h2 id="b">Good morning abstract</h2><p id="c">Hello world evidence <sup><a href="#ref">1</a></sup> with <em>clinical</em> findings.</p><figure><figcaption id="d">Good morning figure explanation.</figcaption></figure></section></article>', targets:['a','b','c','d']},
  {name:'news cards and multi-column article', html:'<style>.cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.story{columns:2}img{max-width:100%}</style><div class="cards"><article><h2 id="a">Hello world news headline</h2><p id="b">Good morning card summary.</p></article><article><h2 id="c">Hello world other headline</h2></article></div><div class="story"><p id="d">Good morning article across columns.</p></div>',targets:['a','b','c','d']},
  {name:'community nested comments',html:'<ol><li><p id="a">Hello world original comment.</p><ol><li><p id="b">Good morning nested reply.</p></li></ol></li></ol>',targets:['a','b']},
  {name:'responsive data table with captions',html:'<div style="overflow:auto"><table><caption id="a">Hello world table caption</caption><thead><tr><th id="b" scope="col">Good morning outcome</th></tr></thead><tbody><tr><td id="c">Hello world cell</td></tr></tbody></table></div>',targets:['a','b','c']},
  {name:'heading and paragraph with break opportunities',html:'<h2 id="a">Hello world <wbr>heading</h2><p id="b">Good morning first line<br>Second line with <em>emphasis</em>.</p>',targets:['a','b']},
  {name:'dark article and long URLs',html:'<style>body{background:#151b24;color:#eee}a{color:#b8d8ff}</style><p id="a">Hello world <a href="#doc">document reference</a> and a long note.</p>',targets:['a']},
  {name:'code blocks stay original',html:'<p id="a">Hello world documentation.</p><pre><code>CODE_SENTINEL function example() { return "a string"; }</code></pre>',targets:['a'],forbidden:/CODE_SENTINEL/},
  {name:'inline code and keyboard labels stay original',html:'<p id="a">Hello world use <code>INLINE_CODE_SENTINEL</code> with <kbd>KEY_SENTINEL</kbd> and <samp>OUTPUT_SENTINEL</samp>.</p>',targets:['a'],forbidden:/INLINE_CODE_SENTINEL|KEY_SENTINEL|OUTPUT_SENTINEL/},
  {name:'native and rendered formulas stay original',html:'<p id="a">Hello world equation <math><mtext>MATH_SENTINEL</mtext></math> in a paper.</p><div class="katex"><span>KATEX_SENTINEL</span></div><mjx-container>MATHJAX_SENTINEL</mjx-container>',targets:['a'],forbidden:/MATH_SENTINEL|KATEX_SENTINEL|MATHJAX_SENTINEL/},
  {name:'syntax editors and interactive widgets stay original',html:'<p id="a">Hello world editor documentation.</p><div class="monaco-editor"><div>MONACO_SENTINEL</div></div><div class="cm-editor"><div>CM_SENTINEL</div></div><div role="textbox"><p>TEXTBOX_SENTINEL</p></div><div role="button">BUTTON_SENTINEL</div>',targets:['a'],forbidden:/MONACO_SENTINEL|CM_SENTINEL|TEXTBOX_SENTINEL|BUTTON_SENTINEL/},
  {name:'hidden, inert and decorative content stays local',html:'<p id="a">Hello world visible paragraph.</p><div inert><p>INERT_SENTINEL</p></div><div aria-hidden="true">DECORATIVE_SENTINEL</div><p hidden>HIDDEN_SENTINEL</p><div style="display:none">DISPLAY_SENTINEL</div>',targets:['a'],forbidden:/INERT_SENTINEL|DECORATIVE_SENTINEL|HIDDEN_SENTINEL|DISPLAY_SENTINEL/},
  {name:'editable fields and translation opt-outs stay local',html:'<p id="a">Hello world public text.</p><form><textarea>TEXTAREA_SENTINEL</textarea><input value="INPUT_SENTINEL"></form><div contenteditable><p>EDIT_SENTINEL</p></div><p translate="no">NO_SENTINEL</p><p class="notranslate">CLASS_SENTINEL</p>',targets:['a'],forbidden:/TEXTAREA_SENTINEL|INPUT_SENTINEL|EDIT_SENTINEL|NO_SENTINEL|CLASS_SENTINEL/},
  {name:'translations inherit inline link alignment and direction',html:'<p id="a" dir="rtl" style="text-align:right">Hello world <a href="#b">linked content</a> in a right aligned paragraph.</p>',targets:['a']},
  {name:'flex card with linked title remains a vertical pair',html:'<style>.row{display:flex;gap:12px}.tile{flex:1;min-width:0}.tile a{display:block}</style><div class="row"><article class="tile"><a id="a" href="#a">Hello world title</a></article><article class="tile"><a id="b" href="#b">Good morning title</a></article></div>',targets:['a','b'],outsideLink:false},
  {name:'pinned semantic navigation keeps source geometry',html:'<header id="pinned" style="position:fixed;top:0;left:0;right:0;height:64px;display:flex;align-items:center"><nav><ul><li><a href="#a">PINNED_NAV_SENTINEL</a></li></ul></nav></header><nav id="sticky" style="position:sticky;top:64px;height:40px"><a href="#a">STICKY_NAV_SENTINEL</a></nav><article><header><h2 id="a">Hello world ordinary article header.</h2></header><nav><ul><li id="b">Good morning static article navigation.</li></ul></nav></article>',targets:['a','b'],forbidden:/PINNED_NAV_SENTINEL|STICKY_NAV_SENTINEL/,stable:['pinned','sticky']},
  {name:'whitespace-separated emphasis remains a single paragraph',html:'<p id="a">Hello world <b>first</b> and <i>second</i> <a href="#a">linked phrase</a>.</p>',targets:['a']},
  {name:'ellipsis prose exposes its complete translation',html:'<p id="a" style="width:220px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Hello world clipped headline with a long explanation and original linked context.</p>',targets:['a'],unclipped:true},
  {name:'two-line clamped prose exposes its complete translation',html:'<p id="a" style="display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;width:230px;max-width:100%">Hello world long abstract with enough original context to fill multiple lines and demonstrate a two-line card summary in a responsive reading view.</p>',targets:['a'],unclipped:true},
  {name:'fixed-height clipped paragraph exposes its translation',html:'<p id="a" style="height:28px;overflow:hidden;width:240px;max-width:100%">Hello world original paragraph with several words.</p>',targets:['a'],unclipped:true},
  {name:'clipped ancestor card exposes its translated paragraph',html:'<article style="height:60px;overflow:hidden;width:240px;max-width:100%"><p id="a">Hello world original paragraph inside a clipped card.</p></article>',targets:['a'],unclipped:true},
  {name:'flex title with ellipsis exposes its translation',html:'<div style="display:flex;gap:12px"><h3 id="a" style="min-width:0;max-width:210px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">Hello world long flexible article title with extra context.</h3><span translate="no">Icon</span></div>',targets:['a'],unclipped:true},
  {name:'ruby pronunciation annotations stay original',html:'<p id="a">Hello world <ruby>漢字<rt>RUBY_SENTINEL</rt><rp>RUBY_PAREN_SENTINEL</rp></ruby> pronunciation example.</p>',targets:['a'],forbidden:/RUBY_SENTINEL|RUBY_PAREN_SENTINEL/},
  {name:'pre-wrapped prose keeps its line breaks',html:'<p id="a" style="white-space:pre-wrap">Hello world research note.\nGood morning second line.</p>',targets:['a']},
  {name:'nested opt-outs and private controls stay local',html:'<article><p id="a">Hello world public evidence <span class="notranslate"><em>NESTED_PRIVATE_SENTINEL</em></span>.</p><div contenteditable="true"><div contenteditable="false">INHERITED_PRIVATE_SENTINEL</div></div><select><option>OPTION_PRIVATE_SENTINEL</option></select></article>',targets:['a'],forbidden:/NESTED_PRIVATE_SENTINEL|INHERITED_PRIVATE_SENTINEL|OPTION_PRIVATE_SENTINEL/},
  {name:'visible ARIA false content participates',html:'<article aria-hidden="false"><p id="a">Hello world visible accessible evidence.</p></article>',targets:['a']},
  {name:'open native dialog retains bilingual paragraphs',html:'<dialog open style="position:relative;width:250px;max-width:100%;margin:0"><p id="a">Hello world dialog documentation.</p></dialog>',targets:['a']},
  {name:'scrollable prose retains a paired translation',html:'<article style="height:90px;overflow:auto;max-width:250px"><p id="a">Hello world scrollable paper section with extended evidence and a linked description.</p></article>',targets:['a']},
  {name:'Arabic RTL prose retains source text and paired translation',html:'<article lang="ar" dir="rtl"><p id="a">الانحدار الخطي نموذج إحصائي يصف العلاقة بين المتغيرات في الدراسة. Hello world.</p></article>',targets:['a']},
  {name:'Hebrew RTL prose retains source text and paired translation',html:'<article lang="he" dir="rtl"><p id="a">רגרסיה ליניארית מתארת את הקשר בין המשתנים במחקר. Hello world.</p></article>',targets:['a']},
  {name:'Japanese kana prose participates',html:'<p id="a" lang="ja">線形回帰は変数の関係を表す統計モデルです。Hello world.</p>',targets:['a']},
  {name:'Korean prose participates',html:'<p id="a" lang="ko">선형 회귀는 변수 사이의 관계를 설명하는 통계 모형입니다. Hello world.</p>',targets:['a']},
  {name:'Cyrillic prose participates',html:'<p id="a" lang="ru">Линейная регрессия описывает связь между переменными в исследовании. Hello world.</p>',targets:['a']},
  {name:'traditional Chinese participates for a simplified target',html:'<p id="a" lang="zh-Hant">這個研究圖表顯示了數據與變量之間的關係，提供專業學習的證據。</p>',targets:['a']},
  {name:'direction changes inside a linked citation stay paired',html:'<p id="a" dir="rtl">Hello world <bdi dir="ltr">Method A, 2026</bdi> <a href="#source" dir="ltr">Good morning reference.</a></p>',targets:['a']},
  {name:'table spans and native footnotes remain intact',html:'<table style="width:100%;table-layout:fixed"><caption id="a">Hello world baseline</caption><tbody><tr><th id="b" colspan="2">Good morning group</th></tr><tr><td id="c" rowspan="2">Hello world factor</td><td id="d">Good morning result<sup><a href="#note">1</a></sup></td></tr><tr><td id="e">Hello world followup</td></tr></tbody></table>',targets:['a','b','c','d','e']},
  {name:'long unbroken identifiers cannot expand a card',html:'<p id="a" style="max-width:230px;overflow-wrap:anywhere">Hello world '+('identifier'.repeat(40))+'.</p>',targets:['a']},
  {name:'visually hidden legacy clip labels stay local',html:'<p id="a">Hello world visible diagram description.</p><span style="position:absolute;clip:rect(0,0,0,0);width:1px;height:1px;overflow:hidden">LEGACY_CLIPPED_SENTINEL</span>',targets:['a'],forbidden:/LEGACY_CLIPPED_SENTINEL/},
  {name:'visually hidden clip-path labels stay local',html:'<p id="a">Hello world visible figure description.</p><div style="position:absolute;clip-path:inset(50%);white-space:nowrap;overflow:hidden">PATH_CLIPPED_SENTINEL</div>',targets:['a'],forbidden:/PATH_CLIPPED_SENTINEL/},
  {name:'unshrinkable flex footer ancestors stay within their container',html:'<ul style="display:flex;flex-wrap:wrap;gap:10px;list-style:none;padding:0;width:200px;max-width:100%"><li style="flex-shrink:0"><div id="a">Good morning flexible footer sentence.</div></li><li style="flex-shrink:0" translate="no">Help</li></ul>',targets:['a'],documentBound:true}
];
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:'+server.address().port;
  fs.mkdirSync(path.dirname(reportPath), {recursive:true});
  try {
    const extension = path.join(scratch, 'extension'); fs.mkdirSync(extension);
    for (const file of ['manifest.json','offscreen-translation.html','popup.html','popup.css','popup.js','options.html','options.css','options.js','privacy.html','src','assets','_locales']) fs.cpSync(path.join(root,file),path.join(extension,file),{recursive:true});
    const manifest = JSON.parse(fs.readFileSync(path.join(extension,'manifest.json'),'utf8'));
    manifest.host_permissions = ['http://127.0.0.1/*','https://api.mymemory.translated.net/*'];
    fs.writeFileSync(path.join(extension,'manifest.json'),JSON.stringify(manifest));
    context = await chromium.launchPersistentContext(path.join(scratch,'profile'),{channel:browserChannel,headless:true,viewport:{width:1440,height:900},args:domOnly?[]:['--disable-extensions-except='+extension,'--load-extension='+extension]});
    const worker = domOnly ? null : context.serviceWorkers()[0] || await context.waitForEvent('serviceworker',{timeout:15000});
    if(worker)await worker.evaluate(values => chrome.storage.local.set(values), {apiStyle:'custom-json',endpoint:origin+'/translate',apiKey:'',model:'',sourceLanguage:'en',targetLanguage:'zh-CN',requestTemplate:'{"prompt": {{text}}}',responsePath:'data.translation'});
    async function open(html, width = 1440) {
      const page = await context.newPage(); page.setDefaultTimeout(6000);
      await page.setViewportSize({width,height:900}); await page.goto(origin+'/fixture/'+(++sequence));
      await page.locator('#fixture').evaluate((el,value) => el.innerHTML = value, html);
      if(domOnly){
        await page.exposeFunction('__qfSyntheticTranslation',async message=>{requests.push(message.text);if(responseDelay)await tick(responseDelay);return {ok:true,translation:translate(message.text)};});
        await page.evaluate(()=>{
          const listeners=[],cancelled=new Set();window.__qfListeners=listeners;window.chrome ||= {};
          window.chrome.runtime={lastError:undefined,onMessage:{addListener:listener=>listeners.push(listener)},sendMessage(message,callback){
            if(message.type==='GET_SELECTION_ENABLED')return callback({enabled:false});
            if(message.type==='CANCEL_TRANSLATION'){cancelled.add(message.requestId);return callback({ok:true});}
            if(message.type==='TRANSLATE_TEXT')window.__qfSyntheticTranslation(message).then(response=>callback(cancelled.has(message.requestId)?{ok:false,code:'CANCELLED',error:'Synthetic cancellation'}:response));
          }};
          window.chrome.storage={local:{get:async defaults=>({...defaults,targetLanguage:'zh-CN',immersiveTranslationColor:''})},onChanged:{addListener(){}}};
        });
        await page.evaluate('(() => {\n'+fs.readFileSync(path.join(root,'src/content.js'),'utf8')+'\n})()');
        return {page,send:message=>page.evaluate(message=>new Promise(resolve=>{const timeout=setTimeout(()=>resolve({ok:false,error:'Synthetic bridge timed out'}),20000);for(const listener of window.__qfListeners)listener(message,{},response=>{clearTimeout(timeout);resolve(response);});}),message)};
      }
      const tabId = await worker.evaluate(async url => (await chrome.tabs.query({})).find(tab => tab.url===url)?.id,page.url());
      await worker.evaluate(id => chrome.scripting.executeScript({target:{tabId:id},files:['src/content.js']}),tabId);
      return {page,send:message=>worker.evaluate(({id,message})=>chrome.tabs.sendMessage(id,message),{id:tabId,message})};
    }
    for (const width of widths) for (const fixture of fixtures) await check(`${width}px: ${fixture.name}`,async () => {
      const {page,send} = await open(fixture.html.replace(/SENTINEL/g,'SENTINEL_'+width),width), before = requests.length;
      try {
        const original = await page.locator('#fixture').innerHTML(),originalWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
        const stable = await page.evaluate(ids=>ids.map(id=>{const el=document.getElementById(id);return {id,html:el.innerHTML,box:el.getBoundingClientRect().toJSON()};}),fixture.stable||[]);
        const authorBefore=fixture.authors?await page.locator('#'+fixture.authors).evaluate(el=>({html:el.innerHTML,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})):null;
        await page.locator('#fixture').evaluate(el => { window.sourceNodes = []; const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT); while(walker.nextNode())window.sourceNodes.push(walker.currentNode); });
        const response = await send({type:'TRANSLATE_IMMERSIVE'}); assert.equal(response.ok,true,response.error);
        if(fixture.forbidden)assert.doesNotMatch(requests.slice(before).join('\n'),fixture.forbidden,'protected content sent to provider');
        if(fixture.authors){
          const state=await page.locator('#'+fixture.authors).evaluate((el,{s,anchor})=>{const next=(anchor?document.getElementById(anchor):el).nextElementSibling;return {html:el.innerHTML,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,internal:el.querySelectorAll(s).length,paired:next?.matches(s),output:next?.textContent};},{s:selector,anchor:fixture.authorAnchor});
          assert.equal(state.html,authorBefore.html,'author names, controls or affiliation markup changed');assert.equal(state.internal,0,'author list received per-person block translations');assert.equal(state.paired,true,'author list lacks one following translation');assert.ok(Math.abs(state.height-authorBefore.height)<1,'author rows became taller');assert.ok(Math.abs(state.width-authorBefore.width)<1,'author list width changed');
          const submitted=requests.map(text=>text.replace(/__EDGE_WT_\d+__/g,'').trim());assert.ok(submitted.some(text=>fixture.authorNames.every(name=>text.includes(name))),'authors were not grouped together, including cached requests');
          for(const name of fixture.authorOutput||fixture.authorNames)assert.ok(state.output.includes(name),'translated author missing: '+name);
          assert.doesNotMatch(state.output,/[\r\n]/,'author translation retained a forced line break');
          await page.screenshot({path:path.join(path.dirname(reportPath),'authors-'+width+'-'+fixtures.indexOf(fixture)+'.png'),caret:'initial'});
        }
        for (const id of fixture.targets) {
          const state = await page.locator('#'+id).evaluate((el,selector) => {
            const translations=[...el.querySelectorAll(selector)], box=el.getBoundingClientRect();
            const clipped=translations.some(node=>{
              const rect=node.getBoundingClientRect();
              for(let parent=node.parentElement;parent&&parent!==document.body;parent=parent.parentElement){
                const style=getComputedStyle(parent),bounds=parent.getBoundingClientRect();
                if(['hidden','clip'].includes(style.overflowY)&&rect.bottom>bounds.bottom+2)return true;
                if(['hidden','clip'].includes(style.overflowX)&&(rect.right>bounds.right+2||rect.left<bounds.left-2))return true;
              }return false;
            });
            return {count:translations.length,visible:translations.every(node=>{const r=node.getBoundingClientRect();return r.width>0&&r.height>0;}),clipped,overflow:translations.some(node=>node.getBoundingClientRect().right>Math.max(innerWidth,box.right)+2),markers:translations.some(node=>/__EDGE_WT_/.test(node.textContent)),linked:translations.some(node=>node.closest('a'))};
          },selector);
          assert.equal(state.count,1,id+' missing or duplicate translation'); assert.ok(state.visible,id+' invisible translation'); assert.ok(!state.overflow,id+' overflow'); assert.ok(!state.markers,'batch marker leaked');
          if(fixture.unclipped)assert.ok(!state.clipped,id+' translation is clipped by its source layout');
          if(fixture.outsideLink!==false)assert.ok(!state.linked,'translation hijacks source link');
        }
        if(fixture.documentBound)assert.ok(await page.evaluate(limit=>document.documentElement.scrollWidth<=Math.max(limit,innerWidth)+1,originalWidth),'a flex ancestor expanded the page');
        for(const beforeBox of stable){const afterBox=await page.locator('#'+beforeBox.id).evaluate(el=>({html:el.innerHTML,box:el.getBoundingClientRect().toJSON()}));assert.equal(afterBox.html,beforeBox.html,'pinned navigation markup changed');assert.deepEqual(afterBox.box,beforeBox.box,'pinned navigation geometry changed');}
        await send({type:'RESTORE_IMMERSIVE'}); sameMarkup(await page.locator('#fixture').innerHTML(),original);
        assert.ok(await page.locator('#fixture').evaluate(el=>window.sourceNodes.every(node=>el.contains(node))),'source Text node identity lost');
      } catch(error) {await page.screenshot({path:path.join(path.dirname(reportPath),`failure-${width}-${fixture.name.replace(/[^a-z0-9]+/gi,'-')}.png`)}).catch(()=>{});throw error;}
      finally {await page.close();}
    });
    await check('paper authors: expansion, reordering and relocation retain one paired list',async()=>{
      const {page,send}=await open('<div id="first"><ul id="authors" class="author-list"><li id="mara"><a class="author-name" href="#mara">Mara Vale</a><sup>1</sup></li><li id="owen"><a class="author-name" href="#owen">Owen Reed</a><sup>*</sup></li><li id="lina" hidden><a class="author-name" href="#lina">Lina Chen</a></li></ul></div><div id="second"></div>');
      const authorOutput='[data-edge-wt-author-translation]';
      try{
        await page.locator('#mara a').evaluate(el=>{window.originalAuthorLink=el;window.authorClicks=0;el.addEventListener('click',event=>{event.preventDefault();window.authorClicks++;});});
        await send({type:'TRANSLATE_IMMERSIVE'});assert.equal(await page.locator(authorOutput).textContent(),'Mara Vale, Owen Reed');
        await page.locator('#lina').evaluate(el=>el.hidden=false);
        await until(()=>page.locator(authorOutput).textContent().then(text=>text==='Mara Vale, Owen Reed, Lina Chen'));
        await page.locator('#authors').evaluate(el=>el.append(document.getElementById('mara')));
        await until(()=>page.locator(authorOutput).textContent().then(text=>text==='Owen Reed, Lina Chen, Mara Vale'));
        await page.locator('#second').evaluate(el=>el.append(document.getElementById('authors')));
        await until(()=>page.locator('#second '+authorOutput).count().then(n=>n===1));
        assert.equal(await page.locator('#first '+authorOutput).count(),0);assert.equal(await page.locator(authorOutput).count(),1);
        const expected=await page.locator('#authors').innerHTML();
        await page.locator('#mara a').click();assert.equal(await page.evaluate(()=>window.authorClicks),1);
        await send({type:'RESTORE_IMMERSIVE'});assert.equal(await page.locator(authorOutput).count(),0);sameMarkup(await page.locator('#authors').innerHTML(),expected);
        assert.ok(await page.evaluate(()=>document.querySelector('#mara a')===window.originalAuthorLink));
      }finally{await page.close();}
    });
    await check('paper authors: affiliations and contributions translate separately from names',async()=>{
      const html='<section><div id="authors" class="author-group"><span><a class="author-name" href="#a">Mara Vale</a><sup><a href="#aff">AFFILIATION_SENTINEL</a></sup></span>, <span><a class="author-name" href="#b">Owen Reed</a><a href="https://orcid.org/0000-0001-0000-0001">ORCID_SENTINEL</a></span><p id="aff" class="affiliation">Hello world Department of Medical Research.</p></div><section class="author-contributions"><p id="contribution">Good morning the first author designed the study.</p></section></section>';
      const {page,send}=await open(html),n=requests.length;
      try{
        const original=await page.locator('#fixture').innerHTML();await send({type:'TRANSLATE_IMMERSIVE'});
        assert.equal(await page.locator('[data-edge-wt-author-translation]').textContent(),'Mara Vale, Owen Reed');
        assert.equal(await page.locator('#aff '+selector).textContent(),'你好，世界 Department of Medical Research.');
        assert.equal(await page.locator('#contribution '+selector).textContent(),'早上好 the first author designed the study.');
        assert.equal(await page.locator('.author-name '+selector+',sup '+selector+',a[href*="orcid.org"] '+selector).count(),0);
        assert.doesNotMatch(requests.slice(n).join('\n'),/AFFILIATION_SENTINEL|ORCID_SENTINEL/);
        await send({type:'RESTORE_IMMERSIVE'});sameMarkup(await page.locator('#fixture').innerHTML(),original);
      }finally{await page.close();}
    });
    await check('paper authors: changed names during a request cannot leave obsolete output',async()=>{
      const {page,send}=await open('<div id="authors" class="authors-list"><span><a class="full-name" href="#one">Ingrid Lake</a></span>, <span><a class="full-name" href="#two">Noah Rivers</a></span></div>'),n=requests.length;
      try{
        responseDelay=650;const pending=send({type:'TRANSLATE_IMMERSIVE'});await until(()=>Promise.resolve(requests.length>n));
        await page.locator('#authors').evaluate(el=>el.insertAdjacentHTML('beforeend',', <span><a class="full-name" href="#three">Mina Grove</a></span>'));
        await pending;await until(()=>page.locator('[data-edge-wt-author-translation]').textContent().then(text=>text==='Ingrid Lake, Noah Rivers, Mina Grove'));
        assert.equal(await page.locator('[data-edge-wt-author-translation]').count(),1);assert.equal(await page.locator('#authors '+selector).count(),0);
        await send({type:'RESTORE_IMMERSIVE'});await tick(700);assert.equal(await page.locator(selector).count(),0);
      }finally{responseDelay=0;await page.close();}
    });
    await check('paper authors: target-language names stay original while affiliations translate',async()=>{
      const {page,send}=await open('<div class="authors-list"><span><a class="full-name" href="#one">李明</a></span>、<span><a class="full-name" href="#two">王芳</a></span></div><p id="affiliation" class="affiliation">Hello world University Research Department.</p>');
      try{
        await send({type:'TRANSLATE_IMMERSIVE'});assert.equal(await page.locator('[data-edge-wt-author-translation]').count(),0);
        assert.equal(await page.locator('#affiliation '+selector).textContent(),'你好，世界 University Research Department.');await send({type:'RESTORE_IMMERSIVE'});
      }finally{await page.close();}
    });
    await check('paper authors: a long consortium remains one paragraph through chunking',async()=>{
      const names=Array.from({length:240},(_,i)=>'Researcher Member'+i),{page,send}=await open('<div id="authors" class="author-list"></div>'),n=requests.length;
      try{
        await page.locator('#authors').evaluate((el,names)=>{for(const name of names){const span=document.createElement('span');span.className='author-name';span.textContent=name;el.append(span,document.createTextNode(', '));}},names);
        const original=await page.locator('#authors').innerHTML();await send({type:'TRANSLATE_IMMERSIVE'});
        assert.equal(await page.locator('[data-edge-wt-author-translation]').count(),1);assert.equal(await page.locator('[data-edge-wt-author-translation]').textContent(),names.join(', '));
        assert.ok(requests.length-n>1,'long consortium did not exercise request chunking');assert.ok(requests.slice(n).every(text=>text.length<=1800));
        sameMarkup(await page.locator('#authors').innerHTML(),original);await send({type:'RESTORE_IMMERSIVE'});assert.equal(await page.locator(selector).count(),0);
      }finally{await page.close();}
    });
    for (const kind of ['direct shadow text','slotted component','hidden shadow host']) await check(kind,async()=>{
      const {page,send}=await open('<div id="component"></div>'); const n=requests.length;
      try {
        await page.locator('#component').evaluate((host,kind)=>{
          const shadow=host.attachShadow({mode:'open'});
          if(kind==='slotted component'){host.innerHTML='<p id="light">Hello world slotted paragraph.</p>';shadow.innerHTML='<article><slot></slot><p id="inside">Good morning shadow body.</p></article>';}
          else if(kind==='hidden shadow host'){host.style.display='none';shadow.innerHTML='<p>SHADOW_PRIVATE_SENTINEL</p>';document.querySelector('#fixture').insertAdjacentHTML('beforeend','<p>Hello world public paragraph.</p>');}
          else shadow.textContent='Hello world bare shadow text.';
        },kind);
        const original=await page.locator('#component').evaluate(host=>({html:host.innerHTML,shadow:host.shadowRoot.innerHTML}));
        const response=await send({type:'TRANSLATE_IMMERSIVE'});assert.equal(response.ok,true,response.error);
        const counts=await page.locator('#component').evaluate((host,s)=>({light:host.querySelectorAll(s).length,shadow:host.shadowRoot.querySelectorAll(s).length}),selector);
        if(kind==='direct shadow text')assert.equal(counts.shadow,1,'bare shadow-root text not translated');
        if(kind==='slotted component'){assert.equal(counts.light,1);assert.equal(counts.shadow,1);}
        if(kind==='hidden shadow host')assert.doesNotMatch(requests.slice(n).join('\n'),/SHADOW_PRIVATE_SENTINEL/);
        await send({type:'RESTORE_IMMERSIVE'});assert.deepEqual(await page.locator('#component').evaluate(host=>({html:host.innerHTML,shadow:host.shadowRoot.innerHTML})),original);
      }finally{await page.close();}
    });
    await check('dynamic reveal and recycled comment nodes do not keep stale translations',async()=>{
      const {page,send}=await open('<p id="recycled">Hello world initial comment.</p><details id="detail"><summary>Details</summary><p id="revealed">Good morning revealed text.</p></details>');
      try{
        await send({type:'TRANSLATE_IMMERSIVE'});
        await page.locator('#recycled').evaluate(el=>el.firstChild.textContent='Good morning replaced comment.');
        await page.locator('#detail').evaluate(el=>el.open=true);
        await until(()=>page.evaluate(s=>document.querySelector('#recycled '+s)?.textContent==='早上好 replaced comment.'&&document.querySelector('#revealed '+s),selector));
        assert.equal(await page.locator('#recycled '+selector).count(),1);
        await send({type:'RESTORE_IMMERSIVE'});
      }finally{await page.close();}
    });
    await check('existing source Text nodes moved between cards update their pairing',async()=>{
      const {page,send}=await open('<p id="left">Hello world left.</p><p id="right">Good morning right.</p>');
      try{
        await send({type:'TRANSLATE_IMMERSIVE'});
        await page.evaluate(()=>document.querySelector('#right').insertBefore(document.querySelector('#left').firstChild,document.querySelector('#right').firstChild));
        await until(()=>page.evaluate(s=>!document.querySelector('#left '+s)&&document.querySelector('#right '+s)?.textContent==='你好，世界 left.早上好 right.',selector));
        assert.equal(await page.locator('#right '+selector).count(),1);await send({type:'RESTORE_IMMERSIVE'});
      }finally{await page.close();}
    });
    await check('reordered inline source nodes refresh sentence order',async()=>{
      const {page,send}=await open('<p id="reorder"><span id="one">Hello world first. </span><span id="two">Good morning second.</span></p>');
      try{
        await send({type:'TRANSLATE_IMMERSIVE'});await page.evaluate(()=>document.querySelector('#two').before(document.querySelector('#one')));
        await page.evaluate(()=>document.querySelector('#one').before(document.querySelector('#two')));
        await until(()=>page.evaluate(s=>document.querySelector('#reorder '+s)?.textContent==='早上好 second.你好，世界 first.',selector));
        assert.equal(await page.locator('#reorder '+selector).count(),1);await send({type:'RESTORE_IMMERSIVE'});
      }finally{await page.close();}
    });
    await check('appending an inline phrase refreshes the entire original sentence',async()=>{
      const {page,send}=await open('<p id="append">Hello world original.</p>');
      try{
        await send({type:'TRANSLATE_IMMERSIVE'});await page.locator('#append').evaluate(el=>el.insertAdjacentHTML('afterbegin','<strong>Good morning addition. </strong>'));
        await until(()=>page.evaluate(s=>document.querySelector('#append '+s)?.textContent==='早上好 addition. 你好，世界 original.',selector));
        assert.equal(await page.locator('#append '+selector).count(),1);await send({type:'RESTORE_IMMERSIVE'});
      }finally{await page.close();}
    });
    await check('dynamic code/editor/aria-hidden changes remove obsolete translations',async()=>{
      const {page,send}=await open('<div id="mutable">Hello world becomes protected.</div>');
      try{
        await send({type:'TRANSLATE_IMMERSIVE'});await page.locator('#mutable').evaluate(el=>el.setAttribute('aria-hidden','true'));
        await until(()=>page.locator('#mutable '+selector).count().then(n=>n===0));
        const n=requests.length;await page.locator('#mutable').evaluate(el=>el.firstChild.textContent='HIDDEN_LATER_SENTINEL');await tick(450);assert.equal(requests.length,n);
        await page.locator('#mutable').evaluate(el=>el.removeAttribute('aria-hidden'));await until(()=>page.locator('#mutable '+selector).count().then(n=>n===1));
        await page.locator('#mutable').evaluate(el=>el.className='cm-editor');await until(()=>page.locator('#mutable '+selector).count().then(n=>n===0));
        await send({type:'RESTORE_IMMERSIVE'});
      }finally{await page.close();}
    });
    await check('navigation changing between flow and pinned refreshes eligibility',async()=>{
      const {page,send}=await open('<nav id="changingNav"><ul><li>Hello world responsive navigation.</li></ul></nav><p>Hello world article below navigation.</p>');
      try{
        await send({type:'TRANSLATE_IMMERSIVE'});assert.equal(await page.locator('#changingNav '+selector).count(),1);
        await page.locator('#changingNav').evaluate(el=>el.style.position='fixed');
        await until(()=>page.locator('#changingNav '+selector).count().then(n=>n===0));
        await page.locator('#changingNav').evaluate(el=>el.removeAttribute('style'));
        await until(()=>page.locator('#changingNav '+selector).count().then(n=>n===1));
        await send({type:'RESTORE_IMMERSIVE'});
        assert.equal(await page.locator('#changingNav').innerHTML(),'<ul><li>Hello world responsive navigation.</li></ul>');
      }finally{await page.close();}
    });
    for(const width of [...new Set([280,320,...widths])])await check(`${width}px: completed status minimizes, expands and retains live supplementation`,async()=>{
      const {page,send}=await open('<p>Hello world status test.</p>',width);
      try{
        await send({type:'TRANSLATE_IMMERSIVE'});
        const panel=page.locator('#edge-web-translator-host').locator('.panel');
        assert.ok(await panel.evaluate(el=>el.classList.contains('minimized')));
        assert.ok(await panel.evaluate(el=>el.getBoundingClientRect().height<70));
        assert.ok(await panel.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1;}),'status control exceeds viewport');
        await panel.locator('.minimize').click();assert.equal(await panel.locator('.minimize').getAttribute('aria-expanded'),'true');
        assert.ok(await panel.locator('.status').isVisible());
        await page.locator('#fixture').evaluate(el=>el.insertAdjacentHTML('beforeend','<p id="afterExpand">Good morning after expanding status.</p>'));
        await until(()=>page.locator('#afterExpand '+selector).count().then(n=>n===1));
        assert.ok(await panel.locator('.status').isVisible(),'manual expansion must survive supplementation');
        await panel.locator('.minimize').click();assert.equal(await panel.locator('.minimize').getAttribute('aria-expanded'),'false');
        await panel.locator('.restore').click();assert.equal(await page.locator(selector).count(),0);
      }finally{await page.close();}
    });
    await check('long paragraphs send complete sentences instead of cutting normal words',async()=>{
      const sentences=Array.from({length:24},(_,i)=>'Hello world sentence '+i+' discusses the evidence and keeps the original conclusion with its supporting context.');
      const text=sentences.join(' '),{page,send}=await open('<p id="long"></p>'),n=requests.length;
      try{
        await page.locator('#long').evaluate((el,text)=>el.textContent=text,text);
        const response=await send({type:'TRANSLATE_IMMERSIVE'});assert.equal(response.ok,true,response.error);
        const submitted=requests.slice(n);assert.ok(submitted.length>1);assert.ok(submitted.every(part=>part.length<=1800&&part.trim().endsWith('.')),'a sentence was split despite an available sentence boundary');
        assert.equal(submitted.join(' ').replace(/\s+/g,' ').trim(),text);
        await send({type:'RESTORE_IMMERSIVE'});
      }finally{await page.close();}
    });
    await check('long paragraph chunk boundaries preserve Unicode surrogate pairs',async()=>{
      const text='Hello world '.padEnd(1799,'x')+'🙂 finishes this Unicode example.',{page,send}=await open('<p id="unicode"></p>'),n=requests.length;
      try{
        await page.locator('#unicode').evaluate((el,text)=>el.textContent=text,text);
        const response=await send({type:'TRANSLATE_IMMERSIVE'});assert.equal(response.ok,true,response.error);
        assert.ok(requests.slice(n).every(part=>part.isWellFormed()),'a non-BMP character was split between requests');
        assert.equal(requests.slice(n).join(''),'Hello world '.padEnd(1799,'x')+'🙂 finishes this Unicode example.');
        await send({type:'RESTORE_IMMERSIVE'});
      }finally{await page.close();}
    });
    await check('long single sentences split at word boundaries without losing words',async()=>{
      const text='Hello world '+Array.from({length:470},(_,i)=>'context'+i).join(' ')+'.',{page,send}=await open('<p id="words"></p>'),n=requests.length;
      try{
        await page.locator('#words').evaluate((el,text)=>el.textContent=text,text);assert.equal((await send({type:'TRANSLATE_IMMERSIVE'})).ok,true);
        const parts=requests.slice(n);assert.ok(parts.length>1);assert.ok(parts.slice(0,-1).every(part=>/context\d+$/.test(part.trim())),'request cut through a word');
        assert.equal(parts.join(' ').replace(/\s+/g,' ').trim(),text);await send({type:'RESTORE_IMMERSIVE'});
      }finally{await page.close();}
    });
    await check('Chinese punctuation provides sentence boundaries without ASCII spaces',async()=>{
      const text=Array.from({length:32},(_,i)=>'这是第'+i+'段研究背景，介绍相关方法和证据。'.repeat(5)).join(''),{page,send}=await open('<p id="chinese"></p>'),n=requests.length;
      try{
        await page.locator('#chinese').evaluate((el,text)=>el.textContent=text,text);assert.equal((await send({type:'TRANSLATE_IMMERSIVE',targetLanguage:'en'})).ok,true);
        const parts=requests.slice(n);assert.ok(parts.length>1);assert.ok(parts.every(part=>part.endsWith('。')),'Chinese sentence was cut');assert.equal(parts.join(''),text);
        await send({type:'RESTORE_IMMERSIVE'});
      }finally{await page.close();}
    });
    await check('source phrase appended during an in-flight request cannot insert stale output',async()=>{
      const {page,send}=await open('<p id="pending">Hello world original pending sentence.</p>'),before=requests.length;
      try{
        responseDelay=850;
        const pending=send({type:'TRANSLATE_IMMERSIVE'});
        await until(()=>Promise.resolve(requests.length>before));
        await page.locator('#pending').evaluate(el=>el.insertAdjacentHTML('afterbegin','<em>Good morning new phrase. </em>'));
        await pending;
        await until(()=>page.locator('#pending '+selector).allTextContents().then(texts=>texts.length===1&&texts[0]==='早上好 new phrase. 你好，世界 original pending sentence.'),7000);
        await send({type:'RESTORE_IMMERSIVE'});assert.equal(await page.locator(selector).count(),0,'orphaned in-flight translation survives restore');
      }finally{responseDelay=0;await page.close();}
    });
    await check('deleted translation is reconstructed once without orphan nodes',async()=>{
      const {page,send}=await open('<p id="deleted">Hello world reconstructed output.</p>');
      try{
        await send({type:'TRANSLATE_IMMERSIVE'});await page.locator('#deleted '+selector).evaluate(el=>el.remove());
        await until(()=>page.locator('#deleted '+selector).count().then(n=>n===1));
        await tick(350);assert.equal(await page.locator('#deleted '+selector).count(),1);
        await send({type:'RESTORE_IMMERSIVE'});assert.equal(await page.locator(selector).count(),0);
      }finally{await page.close();}
    });
    await check('recycled clipped cards restore attributes after source removal and repeated runs',async()=>{
      const {page,send}=await open('<article id="clipped" style="height:42px;overflow:hidden"><p id="changing">Hello world clipped source.</p></article>');
      try{
        const original=await page.locator('#fixture').innerHTML();
        for(let run=0;run<3;run++){
          await send({type:'TRANSLATE_IMMERSIVE'});assert.ok(await page.locator('[data-edge-wt-unclipped]').count()>0);
          await page.locator('#changing').evaluate(el=>el.setAttribute('translate','no'));
          await until(()=>page.locator(selector).count().then(n=>n===0));
          assert.equal(await page.locator('[data-edge-wt-unclipped]').count(),0,'unused layout override remains');
          await page.locator('#changing').evaluate(el=>el.removeAttribute('translate'));
          await until(()=>page.locator(selector).count().then(n=>n===1));
          await send({type:'RESTORE_IMMERSIVE'});sameMarkup(await page.locator('#fixture').innerHTML(),original);
        }
      }finally{await page.close();}
    });
    await check('shared clipped ancestor stays expanded until its last translation is removed',async()=>{
      const {page,send}=await open('<article id="shared" style="height:45px;overflow:hidden"><p id="first">Hello world first clipped paragraph.</p><p id="last">Good morning last clipped paragraph.</p></article>');
      try{
        const original=await page.locator('#fixture').innerHTML();await send({type:'TRANSLATE_IMMERSIVE'});
        await page.locator('#first').evaluate(el=>el.setAttribute('translate','no'));
        await until(()=>page.locator('#first '+selector).count().then(n=>n===0));
        assert.equal(await page.locator('#shared').getAttribute('data-edge-wt-unclipped'),'1');
        assert.equal(await page.locator('#last '+selector).count(),1);
        await page.locator('#first').evaluate(el=>el.removeAttribute('translate'));
        await until(()=>page.locator('#first '+selector).count().then(n=>n===1));
        await send({type:'RESTORE_IMMERSIVE'});sameMarkup(await page.locator('#fixture').innerHTML(),original);
      }finally{await page.close();}
    });
    await check('native scroll containers keep their height and scrolling',async()=>{
      const {page,send}=await open('<article id="scrollbox" style="height:70px;overflow:auto"><p>Hello world first scrollable paragraph.</p><p>Good morning second scrollable paragraph.</p></article>');
      try{
        await send({type:'TRANSLATE_IMMERSIVE'});
        const state=await page.locator('#scrollbox').evaluate(el=>({height:el.getBoundingClientRect().height,overflow:getComputedStyle(el).overflowY,expanded:el.hasAttribute('data-edge-wt-unclipped')}));
        assert.equal(state.height,70);assert.equal(state.overflow,'auto');assert.equal(state.expanded,false);
        await send({type:'RESTORE_IMMERSIVE'});
      }finally{await page.close();}
    });
    await check('author style edits made while translated survive restoration',async()=>{
      const {page,send}=await open('<p id="author" style="height:26px;overflow:hidden">Hello world author-managed layout.</p>');
      try{
        await send({type:'TRANSLATE_IMMERSIVE'});await page.locator('#author').evaluate(el=>{el.style.color='rgb(10, 20, 30)';el.style.height='90px';});
        await tick(400);await send({type:'RESTORE_IMMERSIVE'});
        const state=await page.locator('#author').evaluate(el=>({color:el.style.color,height:el.style.height,expanded:el.hasAttribute('data-edge-wt-unclipped')}));
        assert.deepEqual(state,{color:'rgb(10, 20, 30)',height:'90px',expanded:false});
      }finally{await page.close();}
    });
    await check('rapid virtual list recycling keeps final sentences paired and bounds extra traffic',async()=>{
      const {page,send}=await open('<div id="virtual">'+Array.from({length:24},(_,i)=>'<p id="row'+i+'">Hello world row '+i+'.</p>').join('')+'</div>');
      try{
        await send({type:'TRANSLATE_IMMERSIVE'});const before=requests.length;
        for(let iteration=0;iteration<6;iteration++)await page.locator('#virtual').evaluate((el,n)=>{for(const p of el.querySelectorAll('p'))p.firstChild.textContent='Good morning final '+n+' '+p.id+'.';},iteration);
        await until(()=>page.locator('#virtual').evaluate((el,s)=>[...el.querySelectorAll('p')].every(p=>p.querySelectorAll(s).length===1&&p.querySelector(s).textContent==='早上好 final 5 '+p.id+'.'),selector),7000);
        assert.ok(requests.length-before<=10,'rapid mutations caused unbounded repeated requests');
        await send({type:'RESTORE_IMMERSIVE'});assert.equal(await page.locator(selector).count(),0);
      }finally{await page.close();}
    });
    await check('cross-origin frames and closed shadow content are not sent to the provider',async()=>{
      const {page,send}=await open('<p>Hello world public main frame.</p><div id="closed"></div><iframe id="cross"></iframe>'),before=requests.length;
      try{
        await page.locator('#closed').evaluate(host=>host.attachShadow({mode:'closed'}).innerHTML='<p>CLOSED_SHADOW_SENTINEL</p>');
        await page.locator('#cross').evaluate(frame=>new Promise(resolve=>{frame.addEventListener('load',resolve,{once:true});frame.sandbox='';frame.srcdoc='<p>CROSS_FRAME_SENTINEL</p>';}));
        await send({type:'TRANSLATE_IMMERSIVE'});assert.doesNotMatch(requests.slice(before).join('\n'),/CLOSED_SHADOW_SENTINEL|CROSS_FRAME_SENTINEL/);
        await send({type:'RESTORE_IMMERSIVE'});
      }finally{await page.close();}
    });
    await check('target Chinese paragraphs are skipped while foreign clauses remain eligible',async()=>{
      const {page,send}=await open('<p id="skip">这个研究解释了变量之间的关系，帮助我们理解统计结果。</p><p id="foreign">这个研究包含 The regression model explains the relationship between observed variables.</p>'),before=requests.length;
      try{
        await send({type:'TRANSLATE_IMMERSIVE'});assert.equal(await page.locator('#skip '+selector).count(),0);assert.equal(await page.locator('#foreign '+selector).count(),1);
        assert.doesNotMatch(requests.slice(before).join('\n'),/帮助我们理解统计结果/);await send({type:'RESTORE_IMMERSIVE'});
      }finally{await page.close();}
    });
    await check('large mixed document completes and restores over one thousand paragraphs',async()=>{
      const html=Array.from({length:1100},(_,i)=>'<p id="stress'+i+'">Hello world evidence '+i+' <code>PROTECTED_STRESS_'+i+'</code> with a linked <a href="#reference">Good morning reference</a>.</p>').join('');
      const {page,send}=await open(html,768),before=requests.length;
      try{
        const original=await page.locator('#fixture').innerHTML();const started=Date.now();
        const result=await send({type:'TRANSLATE_IMMERSIVE'});assert.equal(result.ok,true,result.error);assert.equal(result.translatedCount,1100);
        assert.equal(await page.locator(selector).count(),1100);assert.doesNotMatch(requests.slice(before).join('\n'),/PROTECTED_STRESS_/);
        await send({type:'RESTORE_IMMERSIVE'});sameMarkup(await page.locator('#fixture').innerHTML(),original);
        measurements.push({id:'mixed-document-stress',paragraphs:1100,elapsedMs:Date.now()-started,requests:requests.length-before});
      }finally{await page.close();}
    });
    replayingCorpus = true;
    if(corpusDir && fs.existsSync(path.join(corpusDir,'index.json')))for(const entry of JSON.parse(fs.readFileSync(path.join(corpusDir,'index.json'),'utf8')))for(const width of corpusWidths)await check(`${width}px public snapshot: ${entry.id}`,async()=>{
      const {page,send}=await open('',width);
      try{
        let html=fs.readFileSync(path.join(corpusDir,entry.id+'.html'),'utf8');
        // Do not execute captured website scripts. Use live stylesheet URLs only.
        html=html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'').replace(/<base\b[^>]*>/gi,'').replace(/<head\b([^>]*)>/i,`<head$1><base href="${entry.url.replace(/"/g,'&quot;')}">`);
        await page.setContent(html,{waitUntil:'load',timeout:25000});
        await page.evaluate(()=>document.fonts.ready);
        const original=await page.locator('body').innerHTML(),n=requests.length,started=Date.now();
        const originalWidth=await page.evaluate(()=>{
          window.originalBoxes=new Map([...document.body.querySelectorAll('*')].map(el=>[el,el.getBoundingClientRect().toJSON()]));
          window.originalAuthors=[...document.querySelectorAll('.c-article-author-list,.authors-list')].filter(el=>el.getBoundingClientRect().height>0).map(el=>{const box=el.getBoundingClientRect();return {el,html:el.innerHTML,width:box.width,height:box.height,names:[...el.querySelectorAll('[data-test="author-name"],.full-name')].map(name=>{const rect=name.getBoundingClientRect();return {el:name,x:rect.left-box.left,y:rect.top-box.top,width:rect.width,height:rect.height,visible:rect.width>0&&rect.height>0};})};});
          return document.documentElement.scrollWidth;
        });
        const response=await send({type:'TRANSLATE_IMMERSIVE'});assert.equal(response.ok,true,response.error);
        const stats=await page.evaluate(s=>{
          const all=[...document.querySelectorAll(s)];return{translations:all.length,codeTranslations:document.querySelectorAll('pre '+s+',code '+s+',math '+s+',.katex '+s+',mjx-container '+s).length,markers:all.some(el=>/__EDGE_WT_/.test(el.textContent)),scrollWidth:document.documentElement.scrollWidth,overflow:document.documentElement.scrollWidth>innerWidth+2,authorGroups:(window.originalAuthors||[]).map(({el,html,width,height,names})=>{const box=el.getBoundingClientRect();return {unchanged:el.innerHTML===html,heightDelta:box.height-height,widthDelta:box.width-width,internal:el.querySelectorAll(s).length,nameLayoutChanged:names.some(before=>{const r=before.el.getBoundingClientRect(),visible=r.width>0&&r.height>0;return visible!==before.visible||visible&&(Math.abs(r.left-box.left-before.x)>1||Math.abs(r.top-box.top-before.y)>1||Math.abs(r.width-before.width)>1||Math.abs(r.height-before.height)>1);})};}),authorTranslations:document.querySelectorAll('[data-edge-wt-author-translation]').length};
        },selector);
        assert.ok(stats.translations>3,'snapshot lacks translated article content');assert.equal(stats.codeTranslations,0,'code or math received translation children');assert.equal(stats.markers,false);
        assert.ok(stats.scrollWidth<=Math.max(originalWidth,width)+2,'translation increased horizontal page overflow');
        for(const authors of stats.authorGroups){assert.equal(authors.unchanged,true,'publisher author markup changed');assert.equal(authors.internal,0,'publisher authors received per-person translation blocks');assert.ok(Math.abs(authors.heightDelta)<1&&!authors.nameLayoutChanged,'publisher author name layout changed: '+JSON.stringify(authors));}
        // Playwright's default caret hiding leaves empty style attributes on
        // inputs; do not confuse screenshot instrumentation with product edits.
        await page.screenshot({path:path.join(path.dirname(reportPath),`public-${entry.id}-${width}.png`),caret:'initial'});
        measurements.push({id:entry.id,width,url:entry.url,elapsedMs:Date.now()-started,requests:requests.length-n,originalScrollWidth:originalWidth,...stats});
        await send({type:'RESTORE_IMMERSIVE'});
        sameMarkup(await page.locator('body').innerHTML(),original);
      }catch(error){
        const textOverflow=await page.evaluate(()=>{
          const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),items=[];
          while(walker.nextNode()){
            const node=walker.currentNode;if(!node.parentElement.closest('[data-edge-wt-immersive-translation]'))continue;
            const range=document.createRange();range.selectNodeContents(node);const rect=range.getBoundingClientRect();
            if(rect.right<=innerWidth+2)continue;
            items.push({text:node.textContent.slice(0,70),rect:rect.toJSON(),ancestors:Array.from((function*(el){for(let i=0;el&&i<5;i++,el=el.parentElement)yield el;})(node.parentElement)).map(el=>({tag:el.tagName,classes:el.className,style:['display','whiteSpace','overflowWrap','wordBreak','position','width','overflowX'].map(key=>[key,getComputedStyle(el)[key]]),rect:el.getBoundingClientRect().toJSON()}))});
            if(items.length>=8)break;
          }
          return items;
        });
        fs.writeFileSync(path.join(path.dirname(reportPath),`text-overflow-${entry.id}-${width}.json`),JSON.stringify(textOverflow,null,2));
        const diagnostic=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,changed:[...document.body.querySelectorAll('*')].map(el=>({el,before:window.originalBoxes?.get(el),after:el.getBoundingClientRect().toJSON()})).filter(({before,after})=>before&&after.right>innerWidth+2&&after.right>before.right+2).slice(0,30).map(({el,before,after})=>({tag:el.tagName,classes:el.className,text:el.textContent.slice(0,120),before,after})),outputOverflow:[...document.querySelectorAll('[data-edge-wt-immersive-translation]')].filter(el=>el.getBoundingClientRect().right>innerWidth+2).slice(0,12).map(el=>({text:el.textContent.slice(0,80),box:el.getBoundingClientRect().toJSON(),ancestors:Array.from((function*(start){for(let item=start;item&&item!==document.body;item=item.parentElement)yield item;})(el.parentElement)).slice(0,6).map(item=>({tag:item.tagName,classes:item.className,box:item.getBoundingClientRect().toJSON(),style:['display','width','height','whiteSpace','minWidth','maxWidth','overflowX','overflowY','flexShrink'].map(key=>[key,getComputedStyle(item)[key]])}))}))}));
        fs.writeFileSync(path.join(path.dirname(reportPath),`diagnostic-${entry.id}-${width}.json`),JSON.stringify(diagnostic,null,2));
        await page.screenshot({path:path.join(path.dirname(reportPath),`diagnostic-${entry.id}-${width}.png`),caret:'initial'}).catch(()=>{});throw error;
      }finally{await page.close();}
    });
  } catch(error){results.push({name:'suite setup',passed:false,error:error.stack});console.error(error);}
  finally{
    await context?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.rmSync(scratch,{recursive:true,force:true,maxRetries:5,retryDelay:200});
    const report={generatedAt:new Date().toISOString(),scope:domOnly?'Actual content.js in an isolated browser with a synthetic runtime bridge; DOM/layout compatibility only, not extension packaging or background integration.':'Isolated browser MV3 extension with synthetic local translation provider; public DOM snapshots are layout tests, not live model quality measurements.',browserChannel,domOnly,widths,corpusWidths,expansion,version:JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8')).version,passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length,measurements,results};
    fs.writeFileSync(reportPath,JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failed:report.failed}));if(report.failed)process.exitCode=1;
  }
})();
