import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// One inventory for staging, dependency validation and archive auditing. Tests,
// documents and artwork never become part of the installed extension.
const runtimeRoots=[
  'manifest.json','popup.html','popup.css','popup.js','options.html','options.css','options.js',
  'offscreen-translation.html',
  'privacy.html','reader.html','reader.css','reader.js','research.html','research.css','research.js',
  'THIRD_PARTY_NOTICES.md','src','vendor','_locales',
  'assets/icon16.png','assets/icon32.png','assets/icon48.png','assets/icon128.png'
];
const sourceRoots=[...runtimeRoots,'branding','docs','tools','native-host','README.md','README.zh-CN.md','.gitignore','package.ps1'];

export function safePackagePath(name) {
  return !name.includes('\\')&&!name.startsWith('/')&&!name.includes(':')&&
    !name.split('/').some(part=>!part||part==='.'||part==='..')&&
    !/(^|\/)(\.git|\.env[^/]*|node_modules|\.package-staging-[^/]*|package-audit-[^/]*)(\/|$)/i.test(name)&&
    !/(^|\/)[^/]*profile[^/]*\//i.test(name)&&
    !/(^|\/)(accounts\.dpapi(?:\..*)?|host-config\.json|com\.qudadflow\.chatgpt\.json|node\.exe|QudadFlowBridge(?:\.Debug)?\.exe)$/i.test(name);
}

function inventory(root,roots) {
  const files=[];
  function visit(name) {
    if(!safePackagePath(name))throw new Error('Unexpected package path: '+name);
    const absolute=path.join(root,name),stat=fs.lstatSync(absolute);
    if(stat.isSymbolicLink())throw new Error('Package sources cannot be symbolic links: '+name);
    if(stat.isDirectory())for(const child of fs.readdirSync(absolute))visit(name+'/'+child);
    else if(stat.isFile())files.push(name);
    else throw new Error('Unsupported package source: '+name);
  }
  for(const name of roots)visit(name);
  files.sort();
  if(new Set(files.map(name=>name.toLowerCase())).size!==files.length)throw new Error('Duplicate package paths');
  return files;
}
export const runtimeFiles=root=>inventory(root,runtimeRoots);
export const sourceFiles=root=>inventory(root,sourceRoots);

// Inspect literal script/style imports, classic workers and extension resource
// URLs. This is a conservative dependency check, not a JavaScript interpreter.
export function localReferences(name,source) {
  const refs=[];
  const add=(value,fromRoot=false)=>{
    if(/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value))throw new Error(`${name} has a non-local resource: ${value}`);
    const clean=value.split(/[?#]/)[0];if(!clean)return;
    const resolved=path.posix.normalize(path.posix.join(fromRoot||clean.startsWith('/')?'':path.posix.dirname(name),clean.replace(/^\//,'')));
    const directory=resolved.endsWith('/'),file=resolved.replace(/\/$/,'');
    if(!safePackagePath(file))throw new Error(`${name} references an unsafe resource: ${value}`);
    refs.push(directory?file+'/':file);
  };
  if(name.endsWith('.html')){
    for(const match of source.matchAll(/<(?:script|link)[^>]+(?:src|href)=["']([^"']+)["']/gi))add(match[1]);
  }else if(/\.(?:js|mjs)$/.test(name)){
    for(const match of source.matchAll(/(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]/g))add(match[1]);
    for(const call of source.matchAll(/\bimportScripts\(([^)]+)\)/g))for(const match of call[1].matchAll(/['"]([^'"]+)['"]/g))add(match[1]);
    for(const match of source.matchAll(/\bchrome\.runtime\.getURL\(\s*['"]([^'"]+)['"]/g))add(match[1],true);
  }else if(name.endsWith('.css')){
    for(const match of source.matchAll(/url\(\s*['"]?([^\s'"()]+)['"]?\s*\)/gi))if(!match[1].startsWith('data:'))add(match[1]);
    for(const match of source.matchAll(/@import\s*['"]([^'"]+)['"]/gi))add(match[1]);
  }
  return [...new Set(refs)];
}

export function checkLocalReferences(names,read) {
  const available=new Set(names);
  for(const name of names){
    if(name.startsWith('vendor/')||!/\.(?:html|js|mjs|css)$/.test(name))continue;
    for(const ref of localReferences(name,read(name))) {
      const found=ref.endsWith('/')?names.some(file=>file.startsWith(ref)):available.has(ref);
      if(!found)throw new Error(`${name} references missing runtime resource: ${ref}`);
    }
  }
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const root=path.resolve(process.argv[2]||path.join(path.dirname(fileURLToPath(import.meta.url)),'..'));
  console.log(JSON.stringify({runtime:runtimeFiles(root),source:sourceFiles(root)}));
}
