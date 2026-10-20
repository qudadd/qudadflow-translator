/* global chrome */

const DEFAULTS = {
  apiStyle: "openai-compatible",
  endpoint: "https://api.openai.com/v1/chat/completions",
  apiKey: "",
  model: "gpt-4o-mini",
  providerRegion: "",
  sourceLanguage: "auto",
  targetLanguage: "zh-CN",
  temperature: 0.2,
  requestTimeoutSeconds: 45,
  streamOpenAi: true,
  customHeaders: "{}",
  requestTemplate: `{
  "model": {{model}},
  "prompt": {{text}},
  "source_language": {{sourceLanguage}},
  "target_language": {{targetLanguage}}
}`,
  responsePath: "choices[0].message.content"
};

const $ = (id) => document.getElementById(id);

const PROVIDER_HINTS = {
  mymemory: "免 Key 基础试用：默认 English → 简体中文。需手动选择源语言；匿名额度通常为 5000 字符/天，服务商可能保留查询文字。",
  "openai-compatible": "支持 Chat Completions 和 Responses。请使用服务商实际提供的模型名称；翻译长网页时优先选择响应较快的模型。",
  "google-translate-v2": "机器翻译直连：填写 Google Cloud Translation v2 地址，API Key 会作为 key 参数发送。默认地址：https://translation.googleapis.com/language/translate/v2。",
  "microsoft-translator": "机器翻译直连：填写 Azure Translator 地址，默认地址：https://api.cognitive.microsofttranslator.com/translate；API Key 放入 Ocp-Apim-Subscription-Key。",
  deepl: "机器翻译直连：填写 DeepL 地址（免费版通常是 https://api-free.deepl.com/v2/translate，专业版使用 api.deepl.com）。",
  "custom-json": "自定义接口可配置请求体、请求头和响应路径；适合其他机器翻译服务或自建翻译网关。"
};

const ENDPOINT_HINTS = {
  mymemory: "使用 MyMemory 官方 HTTPS 查询接口，自动按单段、500 UTF-8 字节以内拆分；不调用上传翻译记忆的接口。",
  "openai-compatible": "可填 /v1/chat/completions 或 /v1/responses 完整地址；只填域名或 /v1 时使用 Chat Completions。",
  "google-translate-v2": "请填写 Google Cloud Translation v2 的 POST 地址；扩展会把 API Key 作为 key 参数加入请求。",
  "microsoft-translator": "请填写 Azure Translator 的 POST 地址；扩展会自动加入 api-version=3.0 和目标语言参数。",
  deepl: "请填写 DeepL 的 POST 地址；免费版通常是 api-free.deepl.com，专业版通常是 api.deepl.com。",
  "custom-json": "请填写自定义服务实际接收 POST 请求的地址。"
};

const DIRECT_STYLES = new Set(["mymemory", "google-translate-v2", "microsoft-translator", "deepl"]);
const PROVIDER_ENDPOINTS = {
  mymemory: "https://api.mymemory.translated.net/get",
  "openai-compatible": DEFAULTS.endpoint,
  "google-translate-v2": "https://translation.googleapis.com/language/translate/v2",
  "microsoft-translator": "https://api.cognitive.microsofttranslator.com/translate",
  deepl: "https://api-free.deepl.com/v2/translate",
  "custom-json": ""
};
const CONNECTION_FIELDS = ["endpoint", "apiKey", "model", "providerRegion", "customHeaders", "requestTemplate", "responsePath"];
const providerDrafts = new Map();
let renderedStyle;
let testing = false;
let savedProfiles = [], selectedProfileId = '', profileRevision = 0;
function lockEditor() {
  testing=true;const controls=[...document.querySelectorAll('input,select,textarea,button')],disabled=controls.map(control=>control.disabled);
  controls.forEach(control=>control.disabled=true);
  return ()=>{controls.forEach((control,index)=>control.disabled=disabled[index]);$('deleteProfile').disabled=!selectedProfileId;testing=false;};
}

function setStatus(message, error = false) {
  $("status").textContent = message || "";
  $("status").classList.toggle("error", error);
}

function permissionRequest(origins) {
  return new Promise((resolve) => {
    chrome.permissions.request({ origins }, (granted) => {
      // A permission request is allowed only from a user gesture. Treat a
      // browser-side rejection as a normal denial and keep the settings.
      resolve(Boolean(granted) && !chrome.runtime.lastError);
    });
  });
}

function permissionContains(origins) {
  return new Promise((resolve) => chrome.permissions.contains({ origins }, resolve));
}

function endpointPattern() {
  try {
    const url = new URL($("endpoint").value.trim());
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return `${url.protocol}//${url.host}/*`;
  } catch {
    return null;
  }
}

async function askForEndpointPermission(showMessage = true) {
  const pattern = endpointPattern();
  if (!pattern) {
    $("permissionStatus").textContent = "请输入有效的 http/https API 端点后再请求权限。";
    return false;
  }
  if (!showMessage) {
    const already = await permissionContains([pattern]);
    if (already) {
      $("permissionStatus").textContent = `已允许访问 ${pattern}`;
      return true;
    }
    $("permissionStatus").textContent = `尚未允许访问 ${pattern}；保存设置时可授权。`;
    return false;
  }
  // Call request() directly from the click/submit event. Waiting for a
  // permissions.contains() result first can consume the browser's transient
  // user activation and make an otherwise valid request fail.
  const granted = await permissionRequest([pattern]);
  $("permissionStatus").textContent = granted ? `已允许访问 ${pattern}` : `未允许访问 ${pattern}，翻译请求会被浏览器拦截。`;
  if (showMessage && !granted) setStatus("未获得 API 域名权限，设置仍会保存。", true);
  return granted;
}

function formValues() {
  return {
    apiStyle: $("apiStyle").value,
    endpoint: $("endpoint").value.trim(),
    apiKey: $("apiKey").value,
    model: $("model").value.trim(),
    providerRegion: $("providerRegion").value.trim(),
    sourceLanguage: $("sourceLanguage").value,
    targetLanguage: $("targetLanguage").value,
    temperature: $("temperature").value === "" ? "" : Number($("temperature").value),
    requestTimeoutSeconds: Number($("requestTimeoutSeconds").value),
    streamOpenAi: $("streamOpenAi").checked,
    customHeaders: $("customHeaders").value.trim() || "{}",
    requestTemplate: $("requestTemplate").value.trim(),
    responsePath: $("responsePath").value.trim()
  };
}

function templateForValidation(template) {
  return String(template).replace(/\{\{(text|model|sourceLanguage|targetLanguage|context|apiKey)\}\}/g, '"placeholder"');
}

function validate(values) {
  try {
    const url = new URL(values.endpoint);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("端点必须使用 http 或 https。");
  } catch {
    throw new Error("请输入有效的 API 端点。");
  }
  if (!values.model && values.apiStyle === "openai-compatible") throw new Error("请填写模型名称。");
  if (!values.apiKey && !['custom-json','mymemory'].includes(values.apiStyle)) throw new Error("请填写 API Key。");
  if(values.apiStyle==='mymemory' && values.sourceLanguage==='auto')throw new Error('MyMemory 试用需手动选择源语言。');
  if (!Number.isFinite(values.requestTimeoutSeconds) || values.requestTimeoutSeconds < 10 || values.requestTimeoutSeconds > 180) throw new Error("请求超时应为 10–180 秒。");
  let headers;
  try { headers = JSON.parse(values.customHeaders); } catch { throw new Error("自定义请求头必须是有效 JSON。"); }
  if (!headers || typeof headers !== "object" || Array.isArray(headers)) throw new Error("自定义请求头必须是 JSON 对象。");
  if (values.apiStyle === "custom-json") {
    try { JSON.parse(templateForValidation(values.requestTemplate)); } catch { throw new Error("自定义请求模板替换占位符后必须是有效 JSON。"); }
    if (!values.responsePath) throw new Error("请填写自定义接口的译文响应路径。");
  }
}

function renderApiStyle() {
  const style = $("apiStyle").value;
  $("customSection").classList.toggle("visible", style === "custom-json");
  $("modelWrap").classList.toggle("field-hidden", DIRECT_STYLES.has(style));
  $("regionWrap").classList.toggle("visible", style === "microsoft-translator");
  $("streamWrap").classList.toggle("field-hidden", style !== "openai-compatible");
  $("apiKeyWrap").classList.toggle("field-hidden",style==='mymemory');
  $("customHeadersWrap").classList.toggle("field-hidden",style==='mymemory');
  $("sourceLanguage").querySelector('option[value="auto"]').disabled=style==='mymemory';
  $("providerHint").textContent = PROVIDER_HINTS[style] || PROVIDER_HINTS["openai-compatible"];
  $("endpointHint").textContent = ENDPOINT_HINTS[style] || ENDPOINT_HINTS["openai-compatible"];
  $("apiKeyHint").textContent = style === "google-translate-v2"
    ? "Google API Key 会作为 key 参数发送；请限制该 Key 的 API 和来源范围。"
    : style === "microsoft-translator"
      ? "Azure Key 会放入 Ocp-Apim-Subscription-Key 请求头。"
      : style === "deepl"
        ? "DeepL Key 会放入 Authorization 请求头，使用 DeepL-Auth-Key 鉴权格式。"
        : "扩展只会按接口类型把密钥发送到指定端点，不会上传到本项目服务器。";
  $("endpoint").placeholder = PROVIDER_ENDPOINTS[style] || "https://your-translation-service.example/v1/translate";
}

function switchProvider() {
  const style = $("apiStyle").value;
  if (renderedStyle) providerDrafts.set(renderedStyle, formValues());
  const draft = providerDrafts.get(style) || { ...DEFAULTS, endpoint: PROVIDER_ENDPOINTS[style] || "", apiKey: "" };
  for (const key of CONNECTION_FIELDS) $(key).value = draft[key] ?? "";
  if(style==='mymemory' && $('sourceLanguage').value==='auto')$('sourceLanguage').value='en';
  renderedStyle = style;
  renderApiStyle();
  setStatus("已切换接口；请检查连接信息并保存设置。");
  askForEndpointPermission(false);
}

function showValues(values) {
  $('apiKey').type='password';$('toggleKey').textContent='显示';
  providerDrafts.clear();
  for (const [key, value] of Object.entries(values)) {
    const element = $(key);
    if (element?.type === "checkbox") element.checked = value;
    else if (element) element.value = value;
  }
  renderedStyle=values.apiStyle;renderApiStyle();
}
async function profileMessage(message) {
  const result=await chrome.runtime.sendMessage(message);
  if(!result?.ok)throw new Error(result?.error||'无法保存配置方案。');return result;
}
async function loadProfiles() {
  const list=await profileMessage({type:'PROFILE_LIST'});profileRevision=list.revision;
  const stored=await chrome.storage.local.get({savedProfiles:[]});savedProfiles=stored.savedProfiles;
  $('savedProfile').replaceChildren(new Option('新建方案',''),...list.profiles.map(profile=>new Option(profile.name+(profile.id===list.activeProfileId?'（当前使用）':''),profile.id)));
  selectedProfileId=list.activeProfileId;$('savedProfile').value=selectedProfileId;
  $('profileName').value=savedProfiles.find(profile=>profile.id===selectedProfileId)?.name||'';
  $('deleteProfile').disabled=!selectedProfileId;
}
async function saveProfile(values,asNew=false) {
  const name=$('profileName').value.trim()||$('apiStyle').selectedOptions[0].textContent;
  await profileMessage({type:'PROFILE_SAVE',revision:profileRevision,profileId:asNew?'':selectedProfileId,name,values});
  await loadProfiles();
}
async function load() {
  await loadProfiles();
  const values = await chrome.storage.local.get(DEFAULTS);
  showValues(values);
  await askForEndpointPermission(false);
  document.body.dataset.ready='true';
}

$("settingsForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (testing) return;
  let unlock;
  try {
    const values = formValues();
    validate(values);
    const permissionPromise = askForEndpointPermission();
    unlock=lockEditor();
    await saveProfile(values);
    const granted = await permissionPromise;
    setStatus(granted ? "设置已保存。" : "设置已保存，但尚未授予 API 域名权限。", !granted);
  } catch (error) {
    setStatus(error.message, true);
  } finally {unlock?.();}
});

$('savedProfile').addEventListener('change',()=>{
  selectedProfileId=$('savedProfile').value;const profile=savedProfiles.find(profile=>profile.id===selectedProfileId);
  if(profile){showValues(profile.values);$('profileName').value=profile.name;}else{$('profileName').value='';}
  $('deleteProfile').disabled=!profile;setStatus('方案已载入编辑器。编辑后点击“保存设置”应用，或另存为新方案。');askForEndpointPermission(false);
});
$('saveAsProfile').addEventListener('click',async()=>{
  if(testing)return;let unlock;try{const values=formValues();validate(values);const permission=askForEndpointPermission();unlock=lockEditor();await saveProfile(values,true);const granted=await permission;setStatus(granted?'新方案已保存并启用。':'新方案已保存，请允许 API 域名访问。',!granted);}catch(error){setStatus(error.message,true);}finally{unlock?.();}
});
$('deleteProfile').addEventListener('click',async()=>{
  if(testing||!selectedProfileId)return;
  if(!confirm('删除这个本地配置方案？若它正在使用，将同时清空当前连接中的密钥。'))return;
  const unlock=lockEditor();try{await profileMessage({type:'PROFILE_DELETE',profileId:selectedProfileId,revision:profileRevision});await load();setStatus('配置方案已删除。');}catch(error){setStatus(error.message,true);}finally{unlock();}
});
$('useTrial').addEventListener('click',async()=>{
  if(testing)return;
  const permission=permissionRequest(['https://api.mymemory.translated.net/*']),unlock=lockEditor();
  try{await profileMessage({type:'PROFILE_TRIAL'});await load();const granted=await permission;setStatus(granted?'MyMemory 基础试用已启用：English → 简体中文。可测试连接或返回网页翻译。':'基础试用已保存；请允许 MyMemory 域名访问。',!granted);}catch(error){setStatus(error.message,true);}finally{unlock();}
});

$("requestPermission").addEventListener("click", () => askForEndpointPermission());
$("apiStyle").addEventListener("change", switchProvider);
$("endpoint").addEventListener("change", () => askForEndpointPermission(false));
$("toggleKey").addEventListener("click", () => {
  const input = $("apiKey");
  input.type = input.type === "password" ? "text" : "password";
  $("toggleKey").textContent = input.type === "password" ? "显示" : "隐藏";
});
$("testApi").addEventListener("click", async () => {
  if (testing) return;
  testing = true;
  const controls = [...document.querySelectorAll("input,select,textarea,button")];
  const wasDisabled = controls.map((element) => element.disabled);
  let timer;
  try {
    const values = formValues();
    validate(values);
    const permissionPromise = askForEndpointPermission();
    controls.forEach((element) => { element.disabled = true; });
    await saveProfile(values);
    const granted = await permissionPromise;
    if (!granted) return;
    const started = Date.now();
    const render = () => setStatus(`正在测试 API…已等待 ${Math.floor((Date.now() - started) / 1000)} 秒（超时 ${values.requestTimeoutSeconds} 秒）。`);
    render();
    timer = setInterval(render, 1000);
    const response = await chrome.runtime.sendMessage({ type: "TRANSLATE_TEST" });
    if (!response?.ok) throw new Error(`${response?.code ? `[${response.code}] ` : ""}${response?.error || "API 测试失败。"}`);
    setStatus(`连接成功（${((response.elapsedMs || Date.now() - started) / 1000).toFixed(1)} 秒）：${response.translation}`);
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    clearInterval(timer);
    controls.forEach((element, index) => { element.disabled = wasDisabled[index]; });
    $('deleteProfile').disabled=!selectedProfileId;
    testing = false;
  }
});

load().catch((error) => setStatus(`读取设置失败：${error.message}`, true));
