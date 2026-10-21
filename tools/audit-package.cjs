/* Verify release ZIPs against the reviewed working files, without installing them. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {unzipSync}=require('../vendor/fflate/umd/index.js');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||path.join(root,'../../outputs'));
const version=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'))).version;
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex'),reports=[];
for(const source of [false,true]){
  const file=`qudadflow-translator-${source?'source-':''}v${version}.zip`,bytes=fs.readFileSync(path.join(out,file)),entries=unzipSync(bytes),names=Object.keys(entries);
  for(const name of names){
    assert.ok(!name.includes('\\')&&!name.startsWith('/')&&!name.split('/').includes('..'),'Unsafe ZIP path');
    assert.ok(!/(^|\/)(\.git|\.env[^/]*|node_modules|package-audit-[^/]*)($|\/)/i.test(name)&&!/(^|\/)[^/]*profile[^/]*\//i.test(name),'Unexpected private/development data');
    assert.equal(digest(entries[name]),digest(fs.readFileSync(path.join(root,name))),`Archive differs from working file: ${name}`);
    if(!source)assert.ok(!/^(tools|docs|branding)\//.test(name),'Development file in runtime');
  }
  const manifest=JSON.parse(Buffer.from(entries['manifest.json']).toString());assert.equal(manifest.version,version);assert.equal(manifest.manifest_version,3);assert.ok(!manifest.host_permissions?.length);
  const required=['popup.html','options.html','reader.html','research.html',manifest.background.service_worker,'src/content.js','src/research-capture.js'];
  for(const name of required)assert.ok(entries[name],`Missing runtime entry: ${name}`);
  for(const [name,data] of Object.entries(entries)){
    if(!/\.(html|js|mjs)$/.test(name)||name.startsWith('vendor/')||source&&/^(docs|tools)\//.test(name))continue;
    const text=Buffer.from(data).toString();const refs=[];
    if(name.endsWith('.html'))for(const match of text.matchAll(/<(?:script|link)[^>]+(?:src|href)=["']([^"']+)["']/gi))refs.push(match[1]);
    else{
      for(const match of text.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)['"](\.[^'"]+)['"]/g))refs.push(match[1]);
      for(const call of text.matchAll(/importScripts\(([^)]+)\)/g))for(const match of call[1].matchAll(/['"]([^'"]+)['"]/g))refs.push(match[1]);
    }
    for(const ref of refs){if(/^(https?:|data:|#)/.test(ref))continue;const local=path.posix.normalize(path.posix.join(path.posix.dirname(name),ref));assert.ok(entries[local],`${name} references missing ${local}`);}
  }
  reports.push({file,bytes:bytes.length,entries:names.length,sha256:digest(bytes),workingFileComparison:'passed',localReferences:'passed',version});
}
assert.ok(fs.readFileSync(path.join(root,'privacy.html')).equals(fs.readFileSync(path.join(root,'docs/privacy.html'))),'Privacy policies differ');
fs.writeFileSync(path.join(out,`qudadflow-package-validation-v${version}.json`),JSON.stringify({packages:reports,runtimePolicyEqualsHostedSource:true},null,2));
fs.writeFileSync(path.join(out,`SHA256SUMS-v${version}.txt`),reports.map(r=>`${r.sha256}  ${r.file}`).join('\n')+'\n');
console.log(JSON.stringify(reports,null,2));
