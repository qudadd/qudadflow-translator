/* Runs in the extension worker. Serialized writes prevent two settings tabs losing saved profiles. */
const PROFILE_FIELDS = Object.keys(DEFAULTS);
let profileQueue = Promise.resolve();
function profileValues(input) {
  return Object.fromEntries(PROFILE_FIELDS.map(key => [key, input[key] ?? DEFAULTS[key]]));
}
function trialValues() {
  return {...DEFAULTS, apiStyle:'mymemory', endpoint:'https://api.mymemory.translated.net/get', apiKey:'', model:'', providerRegion:'', customHeaders:'{}', sourceLanguage:'en', targetLanguage:'zh-CN'};
}
function profileSummaries(state) {
  return {ok:true, revision:state.profileRevision, activeProfileId:state.activeProfileId, profiles:state.savedProfiles.map(({id,name,values,updatedAt})=>({id,name,apiStyle:values.apiStyle,updatedAt}))};
}
async function profileAction(message) {
  const state=await storageGet({...DEFAULTS,savedProfiles:[],activeProfileId:'',profileRevision:0});
  if(!Array.isArray(state.savedProfiles))throw new Error('保存的方案结构异常，请先检查扩展存储。');
  // Preserve an existing configured connection on the first visit, before any quick-trial switch.
  if(!state.savedProfiles.length && (state.apiKey || state.apiStyle==='custom-json'&&state.endpoint || state.apiStyle==='mymemory')) {
    const id=crypto.randomUUID();state.savedProfiles=[{id,name:'My saved configuration',values:profileValues(state),updatedAt:Date.now()}];state.activeProfileId=id;state.profileRevision+=1;
    await chrome.storage.local.set({savedProfiles:state.savedProfiles,activeProfileId:id,profileRevision:state.profileRevision});
  }
  if(message.type==='PROFILE_LIST')return profileSummaries(state);
  if(message.revision!==undefined && message.revision!==state.profileRevision)throw new Error('配置方案已在其他窗口更新，请刷新设置页后重试。');
  let values;
  if(message.type==='PROFILE_SAVE' || message.type==='PROFILE_TRIAL') {
    values=message.type==='PROFILE_TRIAL'?trialValues():profileValues(message.values||{});
    if(JSON.stringify(values).length>80000)throw new Error('配置内容过大。');
    let index=state.savedProfiles.findIndex(profile=>profile.id===message.profileId);
    if(message.type==='PROFILE_TRIAL')index=state.savedProfiles.findIndex(profile=>JSON.stringify(profileValues(profile.values))===JSON.stringify(profileValues(values)));
    const name=String(message.type==='PROFILE_TRIAL'?'Quick Trial · MyMemory':message.name||'').trim().slice(0,60);
    if(!name)throw new Error('请填写方案名称。');
    if(message.profileId && index<0)throw new Error('该方案已被删除，请刷新后重试。');
    if(index<0 && state.savedProfiles.length>=20)throw new Error('最多保存 20 个配置方案，请先删除不再需要的方案。');
    const profile={id:index<0?crypto.randomUUID():state.savedProfiles[index].id,name,values,updatedAt:Date.now()};
    if(index<0)state.savedProfiles.push(profile);else state.savedProfiles[index]=profile;
    state.activeProfileId=profile.id;
  } else if(message.type==='PROFILE_APPLY') {
    const profile=state.savedProfiles.find(profile=>profile.id===message.profileId);
    if(!profile)throw new Error('未找到该配置方案。');values=profile.values;state.activeProfileId=profile.id;
  } else if(message.type==='PROFILE_DELETE') {
    const index=state.savedProfiles.findIndex(profile=>profile.id===message.profileId);
    if(index<0)throw new Error('未找到该配置方案。');state.savedProfiles.splice(index,1);
    if(state.activeProfileId===message.profileId){state.activeProfileId='';values={...DEFAULTS};}
  } else throw new Error('未知配置操作。');
  state.profileRevision+=1;
  await chrome.storage.local.set({...values,savedProfiles:state.savedProfiles,activeProfileId:state.activeProfileId,profileRevision:state.profileRevision});
  return profileSummaries(state);
}
function queuedProfileAction(message) {
  const operation=profileQueue.then(()=>profileAction(message));profileQueue=operation.catch(()=>{});return operation;
}
