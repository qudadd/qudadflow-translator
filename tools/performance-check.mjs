// Repeatable local performance scenarios. Provider latency is simulated, not a live-service benchmark.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {webcrypto} from 'node:crypto';
import {performance} from 'node:perf_hooks';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const baseline=process.argv.includes('--baseline');
const reportPath=process.argv[2];
const source=file=>baseline?execFileSync('git',['show','v0.9.1:'+file],{cwd:root,encoding:'utf8'}):fs.readFileSync(path.join(root,file),'utf8');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const results=[],measurements={};
async function check(name,run){try{await run();results.push({name,passed:true});console.log('PASS '+name);}catch(error){results.push({name,passed:false,error:error.stack});console.error('FAIL '+name+': '+error.message);}}

function harness(extra={}){
  const settings={apiStyle:'openai-compatible',endpoint:'https://provider.invalid/v1',apiKey:'SYNTHETIC',model:'model-a',...extra};
  const counts={storage:0,fetch:0,injections:0,tabQueries:0,aborted:0};
  const listeners=[],events=()=>({addListener(){}}),changes=[];
  let running=0,mode='normal',allowed=true;
  const waiters=[];
  const context=vm.createContext({URL,URLSearchParams,AbortController,TextDecoder,TextEncoder,Response,crypto:webcrypto,console,setTimeout,clearTimeout,
    setInterval:(...args)=>setInterval(...args).unref(),clearInterval,
    QFModels:{connectionChanged:async()=>{}},
    fetch:async(_url,options)=>{
      counts.fetch++;
      if(running>=2)await new Promise(resolve=>waiters.push(resolve));
      running++;
      try{
        await new Promise((resolve,reject)=>{const signal=options.signal,timer=setTimeout(done,40);function done(){signal?.removeEventListener('abort',abort);resolve();}function abort(){clearTimeout(timer);signal?.removeEventListener('abort',abort);counts.aborted++;reject(new DOMException('Cancelled','AbortError'));}signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();});
        if(mode==='failure')return new Response('{}',{status:503});
        return new Response(JSON.stringify(options.method==='GET'?{responseStatus:200,responseData:{translatedText:'模拟译文'}}:{choices:[{message:{content:'模拟译文'}}]}),{headers:{'content-type':'application/json'}});
      }finally{running--;waiters.shift()?.();}
    },
    chrome:{runtime:{onInstalled:events(),onStartup:events(),onMessage:{addListener:fn=>listeners.push(fn)}},
      storage:{local:{get:(defaults,cb)=>{counts.storage++;const snapshot={...defaults,...settings};setTimeout(()=>cb(snapshot),8);}},onChanged:{addListener:fn=>changes.push(fn)}},
      permissions:{contains:(_p,cb)=>cb(allowed),getAll:async()=>({origins:['https://*/*']}),onAdded:events(),onRemoved:events()},
      scripting:{getRegisteredContentScripts:async()=>[{id:'qf-immersive-shortcut',matches:['https://*/*'],js:['src/immersive-shortcut.js'],runAt:'document_start',allFrames:true,persistAcrossSessions:true}],updateContentScripts:async()=>{},executeScript:async()=>{counts.injections++;}},
      tabs:{onRemoved:events(),onUpdated:events(),query:async()=>{counts.tabQueries++;return Array.from({length:50},(_,id)=>({id,url:'https://example.invalid/'}));},sendMessage:async()=>({ok:true})},
      contextMenus:{onClicked:events()},commands:{onCommand:events()}}
  });
  vm.runInContext(source('src/background.js'),context);
  vm.runInContext(source('src/my-memory.js'),context);
  return {context,counts,run:(request,controller,progress,metadata)=>context.translateText(request,controller,progress,metadata),
    configure:value=>{const diff={};for(const [key,newValue]of Object.entries(value)){diff[key]={oldValue:settings[key],newValue};settings[key]=newValue;}changes.forEach(fn=>fn(diff,'local'));},
    mode:value=>{mode=value;},permission:value=>{allowed=value;}};
}

await check('Worker wake does not inject scripts into every open tab',async()=>{
  const h=harness();await delay(20);measurements.workerWake={tabs:50,injections:h.counts.injections,tabQueries:h.counts.tabQueries};
  if(!baseline){assert.equal(h.counts.injections,0);assert.equal(h.counts.tabQueries,0);}
});
await check('Eight identical requests share settings and one upstream operation',async()=>{
  const h=harness(),started=performance.now();
  const values=await Promise.all(Array.from({length:8},()=>h.run({text:'Repeated sentence.'})));
  assert.ok(values.every(value=>value==='模拟译文'));
  measurements.duplicateBurst={requests:8,upstreamCalls:h.counts.fetch,storageReads:h.counts.storage,elapsedMs:Math.round(performance.now()-started)};
  if(!baseline){assert.equal(h.counts.fetch,1);assert.equal(h.counts.storage,1);}
});
await check('Different target languages retain their own bounded cache entries',async()=>{
  const h=harness();for(const targetLanguage of ['zh-CN','ja','zh-CN'])await h.run({text:'Cache this passage.',targetLanguage});
  measurements.alternatingLanguages={upstreamCalls:h.counts.fetch,storageReads:h.counts.storage};
  if(!baseline)assert.equal(h.counts.fetch,2);
});
await check('Overlapping MyMemory segments share requests across page and document contexts',async()=>{
  const h=harness({apiStyle:'mymemory',endpoint:'https://api.mymemory.translated.net/get',sourceLanguage:'en'});
  await Promise.all(['web page','document'].map(context=>h.run({text:'A shared paragraph.',context})));
  measurements.machineOverlap={upstreamCalls:h.counts.fetch};if(!baseline)assert.equal(h.counts.fetch,1);
});
await check('Cancelling one subscriber preserves the other result',async()=>{
  const h=harness(),one=new AbortController(),two=new AbortController();
  const first=h.run({text:'Cancel one.'},one).then(()=>null,error=>error.code);
  const second=h.run({text:'Cancel one.'},two);await delay(20);one.abort();
  assert.equal(await first,'CANCELLED');assert.equal(await second,'模拟译文');
  if(!baseline){assert.equal(h.counts.fetch,1);assert.equal(h.counts.aborted,0);}
});
await check('Cancelling all subscribers aborts upstream and leaves no reusable partial result',async()=>{
  const h=harness(),one=new AbortController(),two=new AbortController();
  const requests=[h.run({text:'Cancel all.'},one),h.run({text:'Cancel all.'},two)].map(p=>p.catch(error=>error.code));
  await delay(20);one.abort();two.abort();assert.deepEqual(await Promise.all(requests),['CANCELLED','CANCELLED']);
  await delay(5);assert.equal(await h.run({text:'Cancel all.'}),'模拟译文');
  if(!baseline)assert.equal(h.counts.fetch,2);
});
await check('Connection tests bypass cache and duplicate sharing',async()=>{
  const h=harness();await Promise.all(Array.from({length:2},()=>h.run({text:'Live test.',skipCache:true})));assert.equal(h.counts.fetch,2);
});
await check('Failed requests are never cached',async()=>{
  const h=harness();h.mode('failure');await assert.rejects(h.run({text:'Recover.'}));h.mode('normal');assert.equal(await h.run({text:'Recover.'}),'模拟译文');assert.equal(h.counts.fetch,2);
});
await check('Settings changes invalidate saved snapshots and translation results',async()=>{
  const h=harness();await h.run({text:'Settings.'});h.configure({apiKey:'SYNTHETIC-OTHER',model:'model-b'});await h.run({text:'Settings.'});assert.equal(h.counts.fetch,2);assert.equal(h.counts.storage,2);
});
await check('Permission checks still apply to a cached translation',async()=>{
  const h=harness();await h.run({text:'Permission.'});h.permission(false);await assert.rejects(h.run({text:'Permission.'}),{code:'PERMISSION_REQUIRED'});assert.equal(h.counts.fetch,1);
});

await check('Unavailable local language pairs do not suppress other ready pairs',async()=>{
  if(baseline)return;
  const h=harness();let contexts=0,creates=0,requests=0;
  h.context.chrome.runtime.getURL=page=>'chrome-extension://synthetic/'+page;
  h.context.chrome.runtime.getContexts=async()=>{contexts++;await delay(5);return [];};
  h.context.chrome.offscreen={createDocument:async()=>{creates++;}};
  h.context.chrome.runtime.sendMessage=async message=>{requests++;return message.pair.targetLanguage==='ja'?{status:'ok',translation:'日本語'}:{status:'unavailable'};};
  vm.runInContext(source('src/machine-translation.js'),h.context);
  await Promise.all(Array.from({length:4},()=>h.context.ensureBrowserTranslationDocument()));
  assert.equal(contexts,1);assert.equal(creates,1);
  const chunks=[{text:'Hello',translate:true}],call=targetLanguage=>h.context.requestBrowserTranslator(chunks,{sourceLanguage:'en',targetLanguage},new AbortController(),()=>{});
  assert.equal(await call('zh'),null);assert.equal(await call('zh'),null);assert.equal(await call('ja'),'日本語');assert.equal(requests,2);assert.equal(contexts,1);
});

const report={scope:'Synthetic local provider: 40 ms response delay, two upstream slots, 8 ms storage delay. Counts are deterministic; timings do not represent live-provider speed.',baseline,version:JSON.parse(source('manifest.json')).version,measurements,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results};
if(reportPath&&!reportPath.startsWith('--')){fs.mkdirSync(path.dirname(path.resolve(reportPath)),{recursive:true});fs.writeFileSync(reportPath,JSON.stringify(report,null,2));}
console.log(JSON.stringify({measurements,passed:report.passed,failed:report.failed}));
if(report.failed)process.exitCode=1;
