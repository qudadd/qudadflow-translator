import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessResearchCapture,researchReferences} from '../src/research-coverage.mjs';
const results=[];
function check(name,fn){try{fn();results.push({name,passed:true});console.log('PASS '+name);}catch(error){results.push({name,passed:false,error:error.stack});console.error('FAIL '+name+': '+error.message);}}
const assess=(text,tables=[],figures=[])=>assessResearchCapture({text,tables,figures}).issues;
check('No table count is not a failure when the paper has no table references',()=>assert.deepEqual(assess('A review with unnumbered narrative evidence.'),[]));
check('Numbered English and Chinese references identify only unmatched items',()=>{
  const issues=assess('See Tables 1 and 2. 图3解释结果，表2列出数据。',[{caption:'Table 1. Groups'}],[{caption:'Figure 3. Flow'}]);assert.deepEqual(issues.map(i=>i.label),['Table 2']);
});
check('Ranges are expanded conservatively and repeated references are deduplicated',()=>assert.deepEqual([...researchReferences('Figures 1–3; Fig. 2; Tables 1, 2 and 3; Table 1.')].map(([key])=>key),['figure:1','figure:2','figure:3','table:1','table:2','table:3']));
check('Image tables are offered for reading rather than falsely marked absent',()=>assert.equal(assess('Table 2 has the results.',[],[{caption:'Table 2. Image data'}])[0].reason,'image'));
check('Supplementary items are distinct from main-paper numbering',()=>assert.deepEqual(assess('Table 1; Supplementary Table 1; Table S2.',[{caption:'Table 1. Main data'}]).map(i=>[i.label,i.reason]),[['Table S1','supplement'],['Table S2','supplement']]));
check('Cross-references inside captions do not establish another item as extracted',()=>assert.deepEqual(assess('Figure 1 and Figure 2.',[],[{caption:'Figure 1. Comparison with Figure 2.'}]).map(i=>i.label),['Figure 2']));
check('Generated fallback labels do not hide a missing referenced figure',()=>assert.equal(assess('Figure 1.',[],[{caption:'图 1',captionInferred:true}])[0].reason,'unmatched'));
check('Panel references match the whole numbered figure without treating punctuation as text',()=>assert.deepEqual(assess('Fig. 2a and Fig. 2b.',[],[{caption:'Figure 2. Panels'}]),[]));
check('Truncated native tables stay flagged even if their number matches',()=>assert.equal(assess('Table 1.',[{caption:'Table 1. Data',truncated:true}])[0].reason,'truncated'));
check('Storage and structure limits remain visible without invented missing items',()=>assert.equal(assessResearchCapture({text:'narrative',truncated:true,figuresTruncated:true}).issues[0].reason,'limited'));
check('Ordinary vocabulary and large numbers do not invent table references',()=>assert.deepEqual(assess('Stable 2, Figurehead 1, configurable 3, Table 123456 and tables of results.'),[]));
const report={version:JSON.parse(fs.readFileSync(new URL('../manifest.json',import.meta.url))).version,scope:'Conservative local reference checks; no semantic-completeness or AI-accuracy claim.',passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:report.passed,failed:report.failed}));if(report.failed)process.exitCode=1;
