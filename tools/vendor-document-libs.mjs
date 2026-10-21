// Reproducible, integrity-checked local dependencies. Nothing loads from a CDN at runtime.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const packages=[
  {name:'pdfjs-dist',version:'6.4.299',directory:'pdfjs',integrity:'sha512-AVl138zALtfaAPvADulE0PZThbYzCBS79nL4pOSL/6Sm/4AH5A21BD9VHt97OlCuzJuCpmeZtAtkinisF4Vb1g==',paths:['legacy/build/pdf.mjs','legacy/build/pdf.worker.mjs','web/pdf_viewer.css','cmaps','standard_fonts','wasm','LICENSE','README.md']},
  {name:'fflate',version:'0.8.3',directory:'fflate',integrity:'sha512-tbZNuJrLwGUp3zshBtdy4W+ORxZuIh8a5ilyIEQDC5rY1f3U20JMry0Ll3WBzU58EZKsEuJFXhb5gwv8CsPvgA==',paths:['umd/index.js','LICENSE']},
  {name:'docx-preview',version:'0.4.1',directory:'docx-preview',integrity:'sha512-Dv4g+LeE0swHpPvNC0lAT0YsR5Zq5pAxw7d3vHQ8EChBLgIrqqe9VPL5nVt2HBJap8bEZbXUI0TJob7kBeNU9w==',paths:[{source:'dist/docx-preview.min.js',destination:'docx-preview.min.js'},'LICENSE','README.md']},
  {name:'jszip',version:'3.10.2',directory:'jszip',integrity:'sha512-3l+rb15IOWtUhU0H5MFqES/T6Kh7abYwjosBey/vD6hDt8zoEffkSC5Ws5SGtgVw3gBx2NEbhTeSW1+kWkpyTQ==',paths:[{source:'dist/jszip.min.js',destination:'jszip.min.js'},{source:'LICENSE.markdown',destination:'LICENSE'},{source:'README.markdown',destination:'README.md'}]}
];
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'qudadflow-vendor-'));
try {
  for(const pkg of packages){
    const url=`https://registry.npmjs.org/${pkg.name}/-/${pkg.name}-${pkg.version}.tgz`;
    const response=await fetch(url,{signal:AbortSignal.timeout(60000)});
    if(!response.ok) throw new Error(`Download failed: ${pkg.name} ${response.status}`);
    const chunks=[];let length=0;
    for await(const chunk of response.body){length+=chunk.length;if(length>64*1024*1024)throw new Error('Archive too large');chunks.push(chunk);}
    const archive=Buffer.concat(chunks);
    if('sha512-'+crypto.createHash('sha512').update(archive).digest('base64')!==pkg.integrity)throw new Error('Integrity mismatch');
    const archivePath=path.join(temporary,pkg.name+'.tgz');fs.writeFileSync(archivePath,archive);
    const entries=execFileSync('tar',['-tf',archivePath],{encoding:'utf8',timeout:15000,maxBuffer:4*1024*1024}).trim().split(/\r?\n/);
    if(entries.some(entry=>!entry.startsWith('package/')||entry.split('/').includes('..')))throw new Error('Unsafe archive path');
    const unpack=path.join(temporary,pkg.name);fs.mkdirSync(unpack);
    const paths=pkg.paths.map(item=>typeof item==='string'?{source:item,destination:item}:item);
    execFileSync('tar',['-xf',archivePath,'-C',unpack,...paths.map(item=>'package/'+item.source)],{timeout:30000});
    const destination=path.join(root,'vendor',pkg.directory);fs.mkdirSync(destination,{recursive:true});
    for(const item of paths){const target=path.join(destination,item.destination);fs.mkdirSync(path.dirname(target),{recursive:true});fs.cpSync(path.join(unpack,'package',item.source),target,{recursive:true});}
    console.log(`Vendored ${pkg.name}@${pkg.version} (${length} archive bytes; integrity verified)`);
  }
  fs.writeFileSync(path.join(root,'vendor','dependencies.json'),JSON.stringify(packages,null,2)+'\n');
} finally {fs.rmSync(temporary,{recursive:true,force:true,maxRetries:3,retryDelay:200});}
