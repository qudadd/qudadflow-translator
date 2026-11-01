// Real Python/R template execution. Never executes an AI response. No network or user profiles.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {figureCode,figureNotes} from '../src/figure-code.mjs';
import {exampleSpec,panelExample} from './fixtures/figure-example.mjs';
const out=path.resolve(process.argv[2]||path.join(os.tmpdir(),'qudadflow-figure-examples-'+Date.now()));
if(fs.existsSync(out)&&fs.readdirSync(out).length)throw new Error('Use a new or empty output directory to preserve earlier reports');
fs.mkdirSync(out,{recursive:true});
const results=[],python=process.env.PYTHON||'python',rscript=process.env.RSCRIPT||'Rscript';
const write=(name,value)=>fs.writeFileSync(path.join(out,name),value);
const run=(command,args,cwd=out)=>{const r=spawnSync(command,args,{cwd,encoding:'utf8',timeout:60000,windowsHide:true,maxBuffer:2*1024*1024});return {...r,log:(r.stdout||'')+(r.stderr||'')+(r.error?.message||'')};};
function check(name,fn){try{fn();results.push({name,passed:true});console.log('PASS '+name);}catch(error){results.push({name,passed:false,error:error.stack});console.error('FAIL '+name+': '+error.message);}}
function success(command,args,cwd){const r=run(command,args,cwd);assert.equal(r.status,0,r.log);return r;}
const exportR=String.raw`options(digits=17)
data <- datasets::ToothGrowth
raw <- data.frame(dose=data$dose,supp=as.character(data$supp),value=data$len)
summary <- do.call(rbind,lapply(c("OJ","VC"),function(s) do.call(rbind,lapply(c(.5,1,2),function(d) {
  values <- data$len[data$supp==s & data$dose==d]
  m <- mean(values); sd <- stats::sd(values)
  data.frame(dose=d,supp=s,value=m,lower=m-sd,upper=m+sd,n=length(values))
}))))
write.csv(raw,"raw.csv",row.names=FALSE,fileEncoding="UTF-8")
write.csv(summary,"summary.csv",row.names=FALSE,fileEncoding="UTF-8")
raw$lower <- "";raw$upper <- "";raw$n <- "";raw$kind <- "raw"
summary$kind <- "summary"
write.csv(rbind(raw,summary),"panels.csv",row.names=FALSE,fileEncoding="UTF-8")
cat(R.version.string,"\n",as.character(packageVersion("ggplot2")),"\n")
`;
write('export-data.R',exportR);
check('Export actual R ToothGrowth observations and documented mean +/- sample SD',()=>{const r=success(rscript,['export-data.R']);write('r-environment.txt',r.log);assert.equal(fs.readFileSync(path.join(out,'raw.csv'),'utf8').trim().split(/\r?\n/).length,61);});
const examples=[['line',exampleSpec()],['bar',exampleSpec('bar')],['panels',panelExample()]];
const audits={};
for(const [name,spec]of examples){
  for(const lang of ['python','r'])check(`Execute ${name} with ${lang}; export PNG/PDF/SVG and data audit`,()=>{
    const dir=path.join(out,name,lang);fs.mkdirSync(dir,{recursive:true});
    fs.copyFileSync(path.join(out,spec.data.file),path.join(dir,spec.data.file));
    const filename='QudadFlow-figure.'+(lang==='r'?'R':'py');
    fs.writeFileSync(path.join(dir,filename),figureCode(spec,lang));fs.writeFileSync(path.join(dir,'figure-spec.json'),JSON.stringify(spec,null,2));fs.writeFileSync(path.join(dir,'README.md'),figureNotes(spec,lang));
    const execution=success(lang==='r'?rscript:python,[filename],dir);fs.writeFileSync(path.join(dir,'execution.log'),execution.log);
    for(const ext of ['png','pdf','svg'])assert.ok(fs.statSync(path.join(dir,'figure.'+ext)).size>1000);
    const png=fs.readFileSync(path.join(dir,'figure.png'));assert.equal(png.readUInt32BE(16),spec.canvas.width*spec.canvas.dpi);assert.equal(png.readUInt32BE(20),spec.canvas.height*spec.canvas.dpi);
    assert.match(fs.readFileSync(path.join(dir,'figure.svg'),'utf8'),/<text[ >]/);
    audits[name]??={};audits[name][lang]=JSON.parse(fs.readFileSync(path.join(dir,'render-audit.json'),'utf8'));
  });
  check(`${name}: Python/R numeric values, groups, axes size and SD endpoints agree`,()=>{
    const pair=audits[name];assert.ok(pair?.python&&pair?.r,'Both runtime audits required');
    function compare(a,b){if(typeof a==='number'){assert.ok(Math.abs(a-b)<1e-11,`${a} != ${b}`);}else if(Array.isArray(a)){assert.ok(Array.isArray(b));assert.equal(a.length,b.length);a.forEach((v,i)=>compare(v,b[i]));}else if(a&&typeof a==='object'){assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort());for(const k of Object.keys(a))compare(a[k],b[k]);}else assert.equal(a,b);}
    compare(pair.python,pair.r);
    if(name==='panels'){assert.equal(pair.python.panels[0].rows,60);assert.equal(pair.python.panels[1].rows,6);}
  });
  if(name==='bar'||name==='panels')for(const lang of ['python','r'])check(`${name} ${lang}: exported SVG preserves specified category/log tick labels`,()=>{
    const svg=fs.readFileSync(path.join(out,name,lang,'figure.svg'),'utf8');
    const labels=[...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map(m=>m[1].replace(/<[^>]*>/g,'').trim());
    for(const tick of ['0.5','1','2'])assert.ok(labels.includes(tick),`Missing visible tick ${tick}`);
    if(lang==='python'){
      const xAxis=svg.match(/<g id="matplotlib.axis_1">([\s\S]*?)<g id="matplotlib.axis_2">/)?.[1];
      assert.ok(xAxis,'First rendered x axis is present');
      const xLabels=[...xAxis.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map(m=>m[1].replace(/<[^>]*>/g,'').trim());
      assert.deepEqual(xLabels,['0.5','1','2',spec.panels[0].x.label]);
    }
  });
  if(name==='bar')check('R SVG error bars cross the bar tops and remain visible inside the colored bars',()=>{
    const svg=fs.readFileSync(path.join(out,name,'r','figure.svg'),'utf8');
    const attr=(tag,key)=>tag.match(new RegExp('\\b'+key+"=['\"]([^'\"]*)['\"]"))?.[1];
    const bars=[...svg.matchAll(/<rect\b[^>]*>/g)].map(m=>m[0]).filter(tag=>spec.style.palette.some(c=>tag.includes('fill: '+c+';'))).map(tag=>({x:Number(attr(tag,'x')),y:Number(attr(tag,'y')),w:Number(attr(tag,'width')),h:Number(attr(tag,'height'))}));
    const vertical=[...svg.matchAll(/<polyline\b[^>]*>/g)].map(m=>m[0]).flatMap(tag=>{
      const points=attr(tag,'points')?.trim().split(/[ ,]+/).map(Number),style=attr(tag,'style')||'';
      return points?.length===4&&points[0]===points[2]&&!/stroke: (?!#000000\b|black\b)/.test(style)?[points]:[];
    });
    const crossed=bars.filter(b=>vertical.some(p=>p[0]>b.x&&p[0]<b.x+b.w&&Math.min(p[1],p[3])<b.y&&Math.max(p[1],p[3])>b.y&&Math.max(p[1],p[3])<b.y+b.h));
    assert.equal(crossed.length,6,'All six rendered SD intervals need visible lower and upper halves');
  });
}
for(const lang of ['python','r'])check(`${lang}: rerunning preserves all existing plot and audit bytes`,()=>{
  const dir=path.join(out,'line',lang),names=['figure.png','figure.pdf','figure.svg','render-audit.json'];
  const before=names.map(name=>fs.readFileSync(path.join(dir,name)));
  const result=run(lang==='r'?rscript:python,['QudadFlow-figure.'+(lang==='r'?'R':'py')],dir);
  assert.notEqual(result.status,0);assert.match(result.log,/Existing outputs/);
  names.forEach((name,i)=>assert.deepEqual(fs.readFileSync(path.join(dir,name)),before[i]));
});
check('Rendered means/SD endpoints independently match all 60 source observations',()=>{
  const raw=fs.readFileSync(path.join(out,'raw.csv'),'utf8').trim().split(/\r?\n/).slice(1).map(row=>{const [dose,supp,value]=row.replaceAll('"','').split(',');return {dose:Number(dose),supp,value:Number(value)};});
  for(const group of audits.line.python.panels[0].groups)for(let i=0;i<group.x.length;i++){
    const v=raw.filter(row=>row.supp===group.label&&row.dose===group.x[i]).map(row=>row.value);assert.equal(v.length,10);
    const mean=v.reduce((a,b)=>a+b,0)/v.length,sd=Math.sqrt(v.reduce((a,b)=>a+(b-mean)**2,0)/(v.length-1));
    assert.ok(Math.abs(mean-group.y[i])<1e-11);assert.ok(Math.abs(mean-sd-group.lower[i])<1e-11);assert.ok(Math.abs(mean+sd-group.upper[i])<1e-11);
  }
});
const source=()=>fs.readFileSync(path.join(out,'summary.csv'),'utf8');
const invalid=[
  ['missing-file',null,()=>{},/Missing.*summary.csv/],
  ['missing-columns','dose,value\n1,2\n',()=>{},/Missing columns/],
  ['header-only','dose,supp,value,lower,upper\n',()=>{},/no observations/],
  ['nonfinite','dose,supp,value,lower,upper\n0.5,OJ,NaN,0,1\n0.5,VC,1,0,2\n',()=>{},/finite numeric/],
  ['bad-interval','dose,supp,value,lower,upper\n0.5,OJ,2,3,4\n0.5,VC,2,1,3\n',()=>{},/endpoints/],
  ['duplicate-x','dose,supp,value,lower,upper\n0.5,OJ,2,1,3\n0.5,OJ,2,1,3\n0.5,VC,2,1,3\n',()=>{},/Duplicate x/],
  ['unknown-series','dose,supp,value,lower,upper\n0.5,OTHER,2,1,3\n',()=>{},/series values/],
  ['nonpositive-log','dose,supp,value,lower,upper\n0,OJ,2,1,3\n0.5,VC,2,1,3\n',s=>{s.panels[0].x.scale='log';},/must be positive/],
  ['missing-category',()=>source().trim().split(/\r?\n/).filter((_,i)=>i!==2).join('\n')+'\n',s=>{s.panels[0].type='bar';s.panels[0].categories=['0.5','1','2'];s.panels[0].x.limits=null;s.panels[0].x.ticks=null;},/Missing bar category/]
];
for(const [name,csv,change,pattern]of invalid)for(const lang of ['python','r'])check(`Reject ${name} in ${lang} before any plot export`,()=>{
  const spec=exampleSpec();change(spec);const dir=path.join(out,'invalid',name,lang);fs.mkdirSync(dir,{recursive:true});
  if(csv!==null)fs.writeFileSync(path.join(dir,spec.data.file),typeof csv==='function'?csv():csv);
  const file='QudadFlow-figure.'+(lang==='r'?'R':'py');fs.writeFileSync(path.join(dir,file),figureCode(spec,lang));
  const result=run(lang==='r'?rscript:python,[file],dir);fs.writeFileSync(path.join(dir,'rejection.log'),result.log);assert.notEqual(result.status,0);assert.match(result.log,pattern);assert.equal(fs.existsSync(path.join(dir,'figure.png')),false);
});
const report={scope:'Actual local Python/R execution of shared deterministic templates with R ToothGrowth data. No live AI or automatic image digitization/quality benchmark.',passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results};
write('report.json',JSON.stringify(report,null,2));
write('index.html','<!doctype html><meta charset="utf-8"><title>Python / R figure examples</title><style>body{font:16px Arial;max-width:1400px;margin:24px auto}section{display:grid;grid-template-columns:1fr 1fr;gap:16px}img{max-width:100%}figure{margin:0}</style><h1>Python / R figure examples</h1><p>R ToothGrowth data; same CSV and specification. Descriptive mean +/- sample SD, not CI. This tests code, data and layout; it does not benchmark live model recognition.</p>'+examples.map(([name])=>`<h2>${name}</h2><section>`+['python','r'].map(lang=>`<figure><figcaption>${lang}</figcaption><img src="${name}/${lang}/figure.png"></figure>`).join('')+'</section>').join(''));
console.log(JSON.stringify({output:out,passed:report.passed,failed:report.failed}));if(report.failed)process.exitCode=1;
