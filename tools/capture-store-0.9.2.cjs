// Public demo captures only: isolated browser, no accounts, no native credentials.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'branding/store-0.9.2/sources');
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'qudadflow-store-092-'));
let context;
(async()=>{try{
  fs.mkdirSync(output,{recursive:true});
  context=await chromium.launchPersistentContext(path.join(scratch,'profile'),{channel:'msedge',headless:true,viewport:{width:900,height:1100},args:['--disable-extensions-except='+root,'--load-extension='+root]});
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  const page=await context.newPage();
  await page.addInitScript(()=>{
    const native=window.chrome;
    const runtime=new Proxy(native.runtime,{get(target,key){
      if(key==='id')return 'nichpjndbjbcfkcbanfcfogpkdhblghh';
      if(key==='sendMessage')return message=>message.type==='CHATGPT_STATUS'?Promise.resolve({ok:false,code:'HOST_UNAVAILABLE',error:'连接程序未安装。请按下方说明准备。'}):target.sendMessage(message);
      return Reflect.get(target,key);
    }});
    Object.defineProperty(window,'chrome',{value:new Proxy(native,{get(target,key){return key==='runtime'?runtime:Reflect.get(target,key);}})});
  });
  await page.goto('chrome-extension://'+new URL(worker.url()).host+'/options.html');
  await page.waitForFunction(()=>document.body.dataset.ready==='true');
  await page.screenshot({path:path.join(output,'settings-default-0.9.2.png')});
  await page.locator('#apiStyle').selectOption('chatgpt-plan');
  await page.waitForFunction(()=>!document.querySelector('#chatgptSetup').hidden&&!document.querySelector('#chatgptInstall').disabled);
  await page.locator('#chatgptStoreSetup').screenshot({path:path.join(output,'settings-chatgpt-0.9.2.png')});
  await page.locator('#chatgptEligibilityNotice').screenshot({path:path.join(output,'chatgpt-eligibility-0.9.2.png')});
  console.log(JSON.stringify({version:'0.9.2',output,scope:'Isolated Edge; simulated store ID and missing host; no download or authorization attempted.'}));
}finally{
  await context?.close();
  if(!scratch.startsWith(path.resolve(os.tmpdir())+path.sep+'qudadflow-store-092-'))throw new Error('Unsafe cleanup');
  fs.rmSync(scratch,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}})().catch(error=>{console.error(error);process.exitCode=1;});
