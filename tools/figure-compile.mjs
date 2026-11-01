// Regenerate both scripts after editing a downloaded specification. No model or code execution.
import fs from 'node:fs';
import path from 'node:path';
import {figureCode,figureNotes} from '../src/figure-code.mjs';
const {validate,csvHeader}=globalThis.QFFigureSpec;
if(process.argv.length!==4)throw new Error('Usage: node tools/figure-compile.mjs figure-spec.json NEW_OUTPUT_DIRECTORY');
const spec=validate(JSON.parse(fs.readFileSync(process.argv[2],'utf8').replace(/^\uFEFF/,''))),out=path.resolve(process.argv[3]);
// Compile both before writing anything; unsupported geometry cannot leave a partial bundle.
const code={python:figureCode(spec,'python'),r:figureCode(spec,'r')};
if(fs.existsSync(out)&&fs.readdirSync(out).length)throw new Error('Choose a new or empty output directory; existing files are preserved');
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'figure-spec.json'),JSON.stringify(spec,null,2));
fs.writeFileSync(path.join(out,spec.data.file),csvHeader(spec));
for(const language of ['python','r']){
  fs.writeFileSync(path.join(out,'QudadFlow-figure.'+(language==='r'?'R':'py')),code[language]);
  fs.writeFileSync(path.join(out,'README-'+language+'.md'),figureNotes(spec,language));
}
console.log('Generated both scripts and a header-only CSV. Supply documented data before running: '+out);
