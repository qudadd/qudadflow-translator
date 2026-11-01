// Real interpreters, no CSV required. Acceptance covers executable style demos and visible labels.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {exampleSpec,panelExample} from './fixtures/figure-example.mjs';
import {figureCode,figureNotes} from '../src/figure-code.mjs';

if(process.argv.length!==3)throw new Error('Usage: node tools/figure-style-examples.mjs NEW_OUTPUT_DIRECTORY');
const out=path.resolve(process.argv[2]),results=[];
if(fs.existsSync(out)&&fs.readdirSync(out).length)throw new Error('Choose a new or empty output directory');
fs.mkdirSync(out,{recursive:true});
const examples=[['line',exampleSpec()],['bar',exampleSpec('bar')],['panels',panelExample()]];
for(const [name,spec]of examples){
  spec.title='Style demonstration: '+name;spec.data.status='missing';spec.data.source='No source observations supplied; style-only trial';
  for(const language of ['python','r']){
    const dir=path.join(out,name,language);fs.mkdirSync(dir,{recursive:true});
    const file='QudadFlow-figure.'+(language==='r'?'R':'py');
    fs.writeFileSync(path.join(dir,file),figureCode(spec,language));fs.writeFileSync(path.join(dir,'README.md'),figureNotes(spec,language));fs.writeFileSync(path.join(dir,'figure-spec.json'),JSON.stringify(spec,null,2));
    try{
      const run=spawnSync(language==='r'?(process.env.RSCRIPT_EXE||'Rscript'):(process.env.PYTHON_EXE||'python'),[file,'--style-demo'],{cwd:dir,encoding:'utf8',timeout:120000,windowsHide:true});
      fs.writeFileSync(path.join(dir,'execution.log'),String(run.stdout||'')+String(run.stderr||'')+String(run.error||''));assert.equal(run.status,0,run.stderr||run.error?.message);
      assert.equal(fs.existsSync(path.join(dir,spec.data.file)),false,'Style mode should need no CSV');
      for(const ext of ['png','pdf','svg'])assert.ok(fs.statSync(path.join(dir,'figure-style-demo.'+ext)).size>1000);
      const svg=fs.readFileSync(path.join(dir,'figure-style-demo.svg'),'utf8');assert.match(svg,/STYLE DEMO/);assert.match(svg,/OJ/);assert.match(svg,/VC/);assert.match(svg,/<text[ >]/);
      const audit=JSON.parse(fs.readFileSync(path.join(dir,'style-demo-audit.json'),'utf8'));assert.equal(audit.mode,'style-demo');assert.equal(audit.data.status,'synthetic');assert.equal(fs.existsSync(path.join(dir,'figure.png')),false);
      results.push({name:name+' '+language,passed:true});console.log('PASS '+name+' '+language+': runnable without CSV; editable exports, legend and demo label present');
    }catch(error){results.push({name:name+' '+language,passed:false,error:error.stack});console.error('FAIL '+name+' '+language+': '+error.message);}
  }
}
const report={scope:'Actual Python/R execution of style demonstrations without CSV. Checks visible labels, legends and exports; no numeric-recovery acceptance.',passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
fs.writeFileSync(path.join(out,'index.html'),'<!doctype html><meta charset="utf-8"><title>Style demonstrations</title><style>body{max-width:1400px;margin:32px auto;font:16px system-ui;background:#f4f6fa;color:#233752}section{display:grid;grid-template-columns:1fr 1fr;gap:20px}img{width:100%}figure{margin:0;background:white;padding:20px}a{color:#315bc7}</style><h1>Python / R 样式试跑</h1><p>无 CSV 即可运行；验收形式、风格、图例和可编辑导出。演示值不代表论文数据。</p>'+examples.map(([name])=>'<h2>'+name+'</h2><section>'+['python','r'].map(lang=>'<figure><figcaption>'+lang+'</figcaption><img src="'+name+'/'+lang+'/figure-style-demo.png"><a href="'+name+'/'+lang+'/QudadFlow-figure.'+(lang==='r'?'R':'py')+'">脚本</a></figure>').join('')+'</section>').join(''));
console.log(JSON.stringify({output:out,passed:report.passed,failed:report.failed}));if(report.failed)process.exitCode=1;
