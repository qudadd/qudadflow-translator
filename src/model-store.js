/* Catalogs are scoped to a connection digest, never shared across API credentials. */
const QFModels = (() => {
  // Shared by all reading views: one request for each active connection.
  const discoveries = new Map();
  function announce() { chrome.runtime.sendMessage({type:'MODEL_CATALOG_STATUS'}).catch(()=>{}); }
  async function key(values) {
    const data=[values.apiStyle,String(values.endpoint||'').trim(),values.apiKey,values.customHeaders||'{}'];
    if(String(values.customHeaders||'').includes('{{model}}'))data.push(values.model);
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(data)))),b=>b.toString(16).padStart(2,'0')).join('');
  }
  function serial(action){const operation=profileQueue.then(action);profileQueue=operation.catch(()=>{});return operation;}
  async function remember(values,result,signal,{activeOnly=false}={}) {
    const connection=await key(values);
    return serial(async()=>{
      if(signal.aborted)throw translationError('已取消读取模型。','CANCELLED');
      if(activeOnly&&await key(await storageGet(DEFAULTS))!==connection)throw translationError('API 连接已改变，请读取当前连接的模型。','CONNECTION_CHANGED');
      const {modelCatalogs=[]}=await storageGet({modelCatalogs:[]});
      const modalities=items=>items.filter(value=>['text','image','audio','video','file'].includes(value));
      const entry={connection,fetchedAt:Date.now(),truncated:result.truncated,models:result.models.map(({id,inputModalities,outputModalities})=>({id,inputModalities:modalities(inputModalities),outputModalities:modalities(outputModalities)}))};
      const catalogs=[entry,...(Array.isArray(modelCatalogs)?modelCatalogs:[]).filter(c=>c.connection!==connection)].slice(0,20);
      while(catalogs.length>1&&new TextEncoder().encode(JSON.stringify(catalogs)).length>2*1024*1024)catalogs.pop();
      if(signal.aborted)throw translationError('已取消读取模型。','CANCELLED');
      await chrome.storage.local.set({modelCatalogs:catalogs});
      if(!discoveries.get(connection)?.loading)discoveries.delete(connection);
    });
  }
  async function state() {
    const values=await storageGet({...DEFAULTS,savedProfiles:[],activeProfileId:'',modelCatalogs:[]}),connection=await key(values);
    const catalog=Array.isArray(values.modelCatalogs)?values.modelCatalogs.find(c=>c.connection===connection):null;
    const discovery=discoveries.get(connection);
    return {ok:true,connection,apiStyle:values.apiStyle,model:values.model,apiName:values.savedProfiles?.find(p=>p.id===values.activeProfileId)?.name||'当前 API',models:catalog?.models||[],fetchedAt:catalog?.fetchedAt||0,truncated:Boolean(catalog?.truncated),canDiscover:values.apiStyle==='openai-compatible'&&Boolean(values.endpoint?.trim()&&values.apiKey?.trim()),discovering:Boolean(discovery?.loading),discoveryAttempted:Boolean(discovery),discoveryError:discovery?.error||'',discoveryCode:discovery?.code||''};
  }
  function discover(message) {
    // Do not hold the configuration queue while the network is pending.
    return serial(async()=>{
      const values=await storageGet({...DEFAULTS,modelCatalogs:[]}),connection=await key(values);
      if(connection!==message.connection)throw new Error('API 连接已改变，请读取当前连接的模型。');
      const previous=discoveries.get(connection);
      if(previous?.loading)return {request:previous.promise};
      if(!message.force&&(previous||values.modelCatalogs?.some(c=>c.connection===connection)))return {response:await state()};
      const job={loading:true,error:'',code:'',controller:new AbortController()};
      discoveries.set(connection,job);
      for(const [old,entry] of discoveries){if(discoveries.size<=20)break;if(old!==connection&&!entry.loading)discoveries.delete(old);}
      job.promise=(async()=>{
        try{
          // Credentials always come from saved active settings, never a reading-page message.
          const result=await QFModelCatalog.fetchModels(values,job.controller);
          await remember(values,result,job.controller.signal,{activeOnly:true});
        }catch(error){job.error=QFModelCatalog.errorText(error,values);job.code=error.code||'MODEL_LIST_FAILED';}
        finally{job.loading=false;announce();}
        return state();
      })();
      announce();
      return {request:job.promise};
    }).then(result=>result.request||result.response);
  }
  function cancel(message){discoveries.get(message.connection)?.controller.abort();return {ok:true};}
  async function connectionChanged(){
    const connection=await key(await storageGet(DEFAULTS));
    for(const [candidate,job] of discoveries)if(candidate!==connection&&job.loading)job.controller.abort();
  }
  function select(message) {
    return serial(async()=>{
      const values=await storageGet({...DEFAULTS,savedProfiles:[],activeProfileId:'',profileRevision:0,modelCatalogs:[]});
      const connection=await key(values);
      if(connection!==message.connection)throw new Error('API 连接已改变，请重新选择模型。');
      if(values.apiStyle!=='openai-compatible')throw new Error('当前接口不支持模型切换，请在设置中选择 AI API。');
      const catalog=values.modelCatalogs?.find(c=>c.connection===connection);
      if(!catalog?.models.some(m=>m.id===message.model))throw new Error('该模型不在当前 API 已读取的列表中，请刷新上游模型。');
      if(message.model===values.model)return {ok:true};
      const profiles=values.savedProfiles.map(p=>p.id===values.activeProfileId?{...p,values:{...p.values,model:message.model},updatedAt:Date.now()}:p);
      await chrome.storage.local.set({model:message.model,savedProfiles:profiles,profileRevision:values.profileRevision+1});
      return {ok:true};
    });
  }
  async function active(message) {
    if(message.profileId)throw new Error('API 仅能在设置中切换，请重新打开新版阅读器。');
    return storageGet(DEFAULTS);
  }
  return {key,remember,state,select,active,discover,cancel,connectionChanged};
})();
