import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),results=[];
const samples=[['en','The research explains the relationship between measured variables.'],['fr','Cette recherche explique la relation entre les variables mesurées.'],['de','Diese Untersuchung erklärt den Zusammenhang zwischen gemessenen Variablen.'],['ja','この研究は測定された変数の関係を説明しています。'],['ko','이 연구는 측정된 변수 사이의 관계를 설명합니다.'],['ar','تشرح هذه الدراسة العلاقة بين المتغيرات التي تم قياسها.'],['he','מחקר זה מסביר את הקשר בין המשתנים שנמדדו.'],['ru','Это исследование объясняет связь между измеренными переменными.']];
function harness({delay=false,fallback=false,failLanguage=''}={}){
 const calls=[],progress=[];
 let active=0,maxActive=0;
 const context=vm.createContext({setTimeout,clearTimeout,AbortController,crypto:globalThis.crypto,chrome:{runtime:{onMessage:{addListener(){}},getURL:()=>''},i18n:{async detectLanguage(text){const match=samples.find(([,source])=>text.includes(source));return {isReliable:true,languages:[{language:match?.[0]||'en',percentage:100}]};}}}});
 vm.runInContext(fs.readFileSync(path.join(root,'src/machine-translation.js'),'utf8'),context);
 context.translateWithBrowserModel=async(text,source,target,controller,onProgress)=>{
  calls.push({text,source,target,provider:'local'});
  active++;maxActive=Math.max(maxActive,active);
  try{
   if(fallback)return null;
   if(delay)await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,source==='en'?35:5);controller.signal.addEventListener('abort',()=>{clearTimeout(timer);reject(Object.assign(new Error('cancelled'),{code:'CANCELLED'}));},{once:true});});
   if(source===failLanguage)throw new Error('Synthetic HTTP 401');
   const translated='译文['+source+']:'+text;onProgress?.(translated);return translated;
  }finally{active--;}
 };
 context.permissionsContains=async()=>true;
 context.translationError=(message,code)=>Object.assign(new Error(message),{code});
 context.translateMyMemory=async(settings,text)=>{calls.push({text,source:settings.sourceLanguage,target:settings.targetLanguage,provider:'fallback'});return '译文['+settings.sourceLanguage+']:'+text;};
 return {calls,progress,context,get maxActive(){return maxActive;},run:(text,sourceLanguage='auto',controller=new AbortController())=>context.translateAutomaticMachine({sourceLanguage,targetLanguage:'zh-CN'},text,controller,value=>progress.push(value),true)};
}
async function check(name,fn){try{await fn();results.push({name,passed:true});console.log('PASS '+name);}catch(error){results.push({name,passed:false,error:error.message});console.error('FAIL '+name+': '+error.message);}}
for(const [language,text] of samples)await check('individual auto detection: '+language,async()=>{const h=harness();await h.run(text);assert.equal(h.calls[0].source,language);});
const payload=samples.map(([,text],i)=>'__EDGE_WT_'+i+'__\n'+text).join('\n\n');
await check('mixed-language marked paragraphs each use their own detected source',async()=>{
 const h=harness();const output=await h.run(payload);assert.equal(h.calls.length,samples.length,'paragraphs were routed through a single source language');
 for(const [language,text] of samples){const call=h.calls.find(call=>call.text===text);assert.equal(call?.source,language,'wrong source for '+language);}
 assert.deepEqual([...output.matchAll(/__EDGE_WT_\d+__/g)].map(x=>x[0]),samples.map((_,i)=>'__EDGE_WT_'+i+'__'));
});
await check('a monolingual marked batch retains its single provider operation',async()=>{const h=harness();const text='__EDGE_WT_0__\n'+samples[0][1]+'\n\n__EDGE_WT_1__\n'+samples[0][1]+' Another sentence.';await h.run(text);assert.equal(h.calls.length,1);assert.equal(h.calls[0].text,text);});
await check('explicit source language is respected across a mixed batch',async()=>{const h=harness();await h.run(payload,'en');assert.equal(h.calls.length,1);assert.equal(h.calls[0].source,'en');});
await check('mixed-language fallback keeps detected pairs and marker order',async()=>{const h=harness({fallback:true});const output=await h.run(payload);for(const [source,text] of samples)assert.ok(h.calls.some(call=>call.provider==='fallback'&&call.source===source&&call.text===text),'missing fallback pair '+source);assert.equal((output.match(/__EDGE_WT_/g)||[]).length,samples.length);});
await check('progressive and final multilingual output retains paragraph order',async()=>{const h=harness({delay:true});const output=await h.run(payload);const markers=value=>[...value.matchAll(/__EDGE_WT_\d+__/g)].map(x=>x[0]);const expected=markers(payload);assert.deepEqual(markers(output),expected);for(const partial of h.progress)assert.deepEqual(markers(partial),expected.slice(0,markers(partial).length));assert.equal(h.progress.at(-1),output);});
await check('two parent requests retain the two-provider-operation limit',async()=>{const h=harness({delay:true});await Promise.all([h.run(payload),h.run(payload)]);assert.ok(h.maxActive<=2,'mixed-language children multiplied two parent requests into '+h.maxActive+' provider operations');assert.equal(h.calls.length,16);});
await check('cancelling a multilingual batch stops its language operations',async()=>{const h=harness({delay:true}),controller=new AbortController();const pending=h.run(payload,'auto',controller);setTimeout(()=>controller.abort(),2);await assert.rejects(pending,/cancel/i);assert.ok(h.calls.length<=2,'cancelled batch launched additional translations');});
await check('legacy browser language aliases use canonical provider tags',async()=>{const h=harness();for(const [legacy,canonical] of [['iw','he'],['in','id'],['ji','yi']]){h.context.chrome.i18n.detectLanguage=async()=>({isReliable:true,languages:[{language:legacy,percentage:100}]});await h.run('A sufficiently long generated test sentence for a legacy language identifier.');assert.equal(h.calls.at(-1).source,canonical);assert.equal(h.context.machineLanguageTag(legacy),canonical);}});
await check('provider failure stops remaining work and retains the original error',async()=>{const h=harness({delay:true,failLanguage:'fr'});await assert.rejects(h.run(payload),/HTTP 401/);assert.ok(h.calls.length<=2,'a failed batch continued translating subsequent languages');});
const report={generatedAt:new Date().toISOString(),scope:'Synthetic source detection and providers exercise actual machine-translation.js routing, markers, ordering and cancellation; no external service calls.',passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length,results};
if(process.argv[2]){fs.mkdirSync(path.dirname(path.resolve(process.argv[2])),{recursive:true});fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2));}console.log(JSON.stringify({passed:report.passed,failed:report.failed}));if(report.failed)process.exitCode=1;
