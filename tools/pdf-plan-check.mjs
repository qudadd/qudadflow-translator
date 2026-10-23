import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {buildPdfFigurePlan} from '../src/pdf-figure-plan.mjs';
const results=[],version=JSON.parse(fs.readFileSync(new URL('../manifest.json',import.meta.url))).version;
const line=(text,top=80)=>({text,x:50,right:550,top,bottom:top+12,y:top+10,height:12});
const page=(number,lines=[],rasters=[],drawings=[])=>({page:number,width:600,height:800,lines,rasters,drawings,items:[],fallbackTables:[]});
const figure=()=>({x:50,y:80,width:480,height:500});
const legends=()=>page(2,[line('Figure legends',50),line('Figure 1. First evidence',100),line('Figure 2. Second evidence',150)]);
const assigned=plan=>plan.flatMap(p=>p.regions.filter(r=>r.detachedLegend));
function check(name,fn){try{fn();results.push({name,passed:true});console.log('PASS '+name);}catch(error){results.push({name,passed:false,error:error.stack});console.error('FAIL '+name+': '+error.message);}}
check('Explicit separated legends map a complete ordered run to named figures while excluding legends-only pages',()=>{
 const plan=buildPdfFigurePlan([page(1),legends(),page(3,[],[figure()]),page(4,[],[figure()])]);assert.deepEqual(assigned(plan).map(r=>r.identity),['figure:1','figure:2']);assert.equal(plan[1].regions.length,0);assert.match(plan[2].regions[0].caption,/第 2 页/);
});
check('Missing or extra figure pages do not cause guessed identifiers',()=>{
 for(const count of [1,3])assert.equal(assigned(buildPdfFigurePlan([page(1),legends(),...Array.from({length:count},(_,i)=>page(i+3,[],[figure()]))])).length,0);
});
check('A body reference without an explicit legend heading cannot name anonymous graphics',()=>{
 const list=legends();list.lines.shift();assert.equal(assigned(buildPdfFigurePlan([page(1),list,page(3,[],[figure()]),page(4,[],[figure()])])).length,0);
});
check('Gaps and prose pages prevent ambiguous legend ordering',()=>{
 const body=page(4,[line('A long substantive paragraph '.repeat(8),100)], [figure()]);assert.equal(assigned(buildPdfFigurePlan([page(1),legends(),page(3,[],[figure()]),body,page(5,[],[figure()])])).length,0);
});
check('Journal banners and isolated small graphics are excluded from detached figure candidates',()=>{
 const banner={x:50,y:0,width:480,height:30};assert.equal(assigned(buildPdfFigurePlan([page(1),legends(),page(3,[],[banner]),page(4,[],[{x:20,y:80,width:25,height:25}])])).length,0);
});
check('Vector-only figure pages qualify alongside raster figures without extracting decorative paths',()=>{
 const drawings=Array.from({length:12},(_,i)=>({x:70+i%3*90,y:100+Math.floor(i/3)*70,width:70,height:50}));const plan=buildPdfFigurePlan([page(1),legends(),page(3,[],[],drawings),page(4,[],[figure()])]);assert.equal(assigned(plan).length,2);assert.ok(plan[2].regions[0].width>200);
});
check('Already associated inline figures prevent a second detached mapping of the same identities',()=>{
 const inline=page(1,[line('Figure 1. Already present',600)],[{x:50,y:200,width:480,height:380}]);assert.equal(assigned(buildPdfFigurePlan([inline,legends(),page(3,[],[figure()]),page(4,[],[figure()])])).length,0);
});
const report={version,scope:'Generated PDF layout metadata; no files, API or browser profile accessed.',passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results};
const output=path.resolve(process.argv[2]||'pdf-plan-results.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,failed:report.failed}));if(report.failed)process.exitCode=1;
