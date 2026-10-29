// Smoke-test the installed Windows launcher and binary framing, without logging account data.
const {spawn}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const root=fs.realpathSync(process.env.QF_BRIDGE_TEST_ROOT||path.join(process.env.USERPROFILE,'.qudadflow/Bridge'));
const origin=JSON.parse(fs.readFileSync(path.join(root,'host-config.json'))).allowedOrigins[0];
const child=spawn(path.join(root,process.argv.includes('--node')?'node.exe':'QudadFlowBridge.exe'),process.argv.includes('--node')?[path.join(root,'main.mjs'),origin]:[origin],{windowsHide:true,stdio:['pipe','pipe','pipe']});
let bytes=Buffer.alloc(0),received=false;const timer=setTimeout(()=>{child.kill();console.error('Launcher response timeout');process.exitCode=1;},10000);
child.stderr.on('data',chunk=>process.stderr.write(chunk));
child.on('error',e=>{console.error(e.message);process.exitCode=1;});
child.stdout.on('data',chunk=>{bytes=Buffer.concat([bytes,chunk]);if(bytes.length<4)return;const n=bytes.readUInt32LE();if(n>900000)throw new Error('Invalid native response size');if(bytes.length<4+n)return;const reply=JSON.parse(bytes.subarray(4,4+n));received=true;console.log(JSON.stringify({id:reply.id,ok:reply.ok,accountCount:reply.result?.accounts?.length,error:reply.error,code:reply.code}));child.stdin.end();});
child.on('close',code=>{clearTimeout(timer);console.log(JSON.stringify({launcherExit:code,received}));if(!received||code)process.exitCode=1;});
const body=Buffer.from(JSON.stringify({id:'smoke',method:'status'})),prefix=Buffer.alloc(4);prefix.writeUInt32LE(body.length);child.stdin.write(Buffer.concat([prefix,body]));
