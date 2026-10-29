/* global chrome */

const DEFAULTS = {
  apiStyle: "auto-machine",
  endpoint: "https://api.mymemory.translated.net/get",
  apiKey: "",
  mymemoryEmail: "",
  chatgptAccount: "",
  model: "",
  providerRegion: "",
  sourceLanguage: "auto",
  targetLanguage: "zh-CN",
  temperature: 0.2,
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
  'auto-machine': '默认免 Key：优先使用浏览器已支持的本地翻译；不可用时使用 MyMemory。自动检测源语言，短文本无法确定时按 English 处理。MyMemory 匿名额度可能按出口 IP 共享。',
  'chatgpt-plan':'获得官方计划授权后，所选用户使用自己的额度，不共用管理员账号或 API Key。Team / Business 成员额度能否用于此开源接入尚无官方确认；组织策略拒绝时请保留 Request ID，由管理员向 OpenAI 核查。目前开源文档明确列出符合资格的 Plus / Pro。默认机器翻译无需安装或登录。',
  mymemory: "免 Key 基础试用：默认 English → 简体中文。需手动选择源语言；匿名额度通常为 5000 字符/天，填写自己的有效邮箱可按服务商说明提高至 50000 字符/天。",
  "openai-compatible": "支持 Chat Completions 和 Responses。请使用服务商实际提供的模型名称；翻译长网页时优先选择响应较快的模型。",
  "google-translate-v2": "机器翻译直连：填写 Google Cloud Translation v2 地址，API Key 会作为 key 参数发送。默认地址：https://translation.googleapis.com/language/translate/v2。",
  "microsoft-translator": "机器翻译直连：填写 Azure Translator 地址，默认地址：https://api.cognitive.microsofttranslator.com/translate；API Key 放入 Ocp-Apim-Subscription-Key。",
  deepl: "机器翻译直连：填写 DeepL 地址（免费版通常是 https://api-free.deepl.com/v2/translate，专业版使用 api.deepl.com）。",
  "custom-json": "自定义接口可配置请求体、请求头和响应路径；适合其他机器翻译服务或自建翻译网关。"
};

const ENDPOINT_HINTS = {
  'auto-machine': '本地翻译不可用时，固定使用 MyMemory 官方 HTTPS 查询接口。',
  mymemory: "使用 MyMemory 官方 HTTPS 查询接口，自动按单段、500 UTF-8 字节以内拆分；不调用上传翻译记忆的接口。",
  "openai-compatible": "可填 /v1/chat/completions 或 /v1/responses 完整地址；只填域名或 /v1 时使用 Chat Completions。",
  "google-translate-v2": "请填写 Google Cloud Translation v2 的 POST 地址；扩展会把 API Key 作为 key 参数加入请求。",
  "microsoft-translator": "请填写 Azure Translator 的 POST 地址；扩展会自动加入 api-version=3.0 和目标语言参数。",
  deepl: "请填写 DeepL 的 POST 地址；免费版通常是 api-free.deepl.com，专业版通常是 api.deepl.com。",
  "custom-json": "请填写自定义服务实际接收 POST 请求的地址。"
};

const DIRECT_STYLES = new Set(["auto-machine", "mymemory", "google-translate-v2", "microsoft-translator", "deepl"]);
const PROVIDER_ENDPOINTS = {
  'auto-machine': 'https://api.mymemory.translated.net/get',
  'chatgpt-plan':'https://api.openai.com/v1/responses',
  mymemory: "https://api.mymemory.translated.net/get",
  "openai-compatible": "https://api.openai.com/v1/chat/completions",
  "google-translate-v2": "https://translation.googleapis.com/language/translate/v2",
  "microsoft-translator": "https://api.cognitive.microsofttranslator.com/translate",
  deepl: "https://api-free.deepl.com/v2/translate",
  "custom-json": ""
};
const CONNECTION_FIELDS = ["chatgptAccount", "endpoint", "apiKey", "mymemoryEmail", "model", "providerRegion", "customHeaders", "requestTemplate", "responsePath"];
const providerDrafts = new Map();
let renderedStyle;
let testing = false;
let testRequestId = '', testCancelled = false;
let savedProfiles = [], selectedProfileId = '', profileRevision = 0;
let savedEditorState = '', draftTestState = '', draftTestResult = '';
let modelList = [], modelConnection = '', modelRequestId = '';
let localModelController;
const MODEL_CONNECTION_FIELDS = ['apiStyle', 'endpoint', 'apiKey', 'customHeaders', 'chatgptAccount'];
// Reading appearance is global, independent of connection profiles and API validation.
let colorWrite = Promise.resolve(), colorEdit = 0, savedImmersiveColor = '';
function normalizeImmersiveColor(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : '';
}
function showImmersiveColor(value) {
  const color = normalizeImmersiveColor(value);
  $('immersiveColorPicker').value = color || '#315bc7';
  $('immersiveColorHex').value = color.toUpperCase();
  $('immersiveColorPreviewLight').style.color = color || '#315bc7';
  $('immersiveColorPreviewDark').style.color = color || '#9abaff';
  $('immersiveColorHex').removeAttribute('aria-invalid');
}
function colorStatus(text, error = false) {
  $('immersiveColorStatus').textContent = text;
  $('immersiveColorStatus').classList.toggle('error', error);
}
async function saveImmersiveColor(value) {
  const edit = ++colorEdit, color = normalizeImmersiveColor(value);
  showImmersiveColor(color);
  colorStatus('正在保存译文颜色…');
  // Preserve the latest choice even when several native picker events arrive in succession.
  colorWrite = colorWrite.catch(() => {}).then(() => chrome.storage.local.set({ immersiveTranslationColor: color }));
  try {
    await colorWrite;
    savedImmersiveColor = color;
    if (edit === colorEdit) colorStatus(color ? `已保存 ${color.toUpperCase()}，已应用到沉浸式译文。` : '已恢复默认颜色，随浅色、深色模式适配。');
  } catch {
    if (edit === colorEdit) {
      showImmersiveColor(savedImmersiveColor);
      colorStatus('颜色保存失败，请重试。', true);
    }
  }
}
$('immersiveColorPicker').addEventListener('input', event => saveImmersiveColor(event.target.value));
function applyImmersiveHex() {
  const value = $('immersiveColorHex').value.trim();
  if (value && !normalizeImmersiveColor(value)) {
    $('immersiveColorHex').setAttribute('aria-invalid', 'true');
    colorStatus('请输入完整的 HEX 色值，例如 #315BC7。', true);
    return;
  }
  saveImmersiveColor(value);
}
$('immersiveColorHex').addEventListener('change', applyImmersiveHex);
$('immersiveColorHex').addEventListener('keydown', event => {
  if (event.key === 'Enter') { event.preventDefault(); applyImmersiveHex(); }
});
$('resetImmersiveColor').addEventListener('click', () => saveImmersiveColor(''));
let shortcutWrite = Promise.resolve(), shortcutEdit = 0, savedImmersiveShortcut = QFImmersiveShortcut.DEFAULT, recordingShortcut = false;
function shortcutStatus(text, error = false) {
  $('immersiveShortcutStatus').textContent = text;
  $('immersiveShortcutStatus').classList.toggle('error', error);
  if (error) $('immersiveShortcut').setAttribute('aria-invalid', 'true');
  else $('immersiveShortcut').removeAttribute('aria-invalid');
}
function showImmersiveShortcut(value) {
  $('immersiveShortcut').value = value;
  $('immersiveShortcut').placeholder = value ? '例如 Shift+A 或 Ctrl+Shift+Y' : '已停用；输入组合键可重新启用';
  $('disableImmersiveShortcut').disabled = !value;
}
function stopShortcutRecording() {
  recordingShortcut = false;
  $('immersiveShortcut').readOnly = false;
  $('recordImmersiveShortcut').setAttribute('aria-pressed', 'false');
  $('recordImmersiveShortcut').textContent = '录制快捷键';
}
async function saveImmersiveShortcut(value) {
  const shortcut = QFImmersiveShortcut.parse(value);
  if (shortcut === null) { shortcutStatus('组合键无效。请使用 Shift、Ctrl、Alt 或 Meta 加一个按键，例如 Shift+A；F1–F12 也可单独使用。', true); return; }
  const edit = ++shortcutEdit;
  stopShortcutRecording();
  showImmersiveShortcut(shortcut);
  shortcutStatus('正在保存快捷键…');
  shortcutWrite = shortcutWrite.catch(() => {}).then(() => chrome.storage.local.set({ immersiveShortcut: shortcut, immersiveShortcutVersion: QFImmersiveShortcut.VERSION }));
  try {
    await shortcutWrite;
    savedImmersiveShortcut = shortcut;
    if (edit === shortcutEdit) shortcutStatus(shortcut ? `已保存 ${shortcut}，已应用到授权网页。` : '网页快捷键已停用，浏览器全选保持可用。');
  } catch {
    if (edit === shortcutEdit) { showImmersiveShortcut(savedImmersiveShortcut); shortcutStatus('快捷键保存失败，请重试。', true); }
  }
}
function applyShortcutInput() {
  const value = $('immersiveShortcut').value.trim();
  if (!value) { shortcutStatus('请输入组合键；如需关闭，请点击“停用”。', true); return; }
  saveImmersiveShortcut(value);
}
$('recordImmersiveShortcut').addEventListener('click', () => {
  if (recordingShortcut) { stopShortcutRecording(); showImmersiveShortcut(savedImmersiveShortcut); shortcutStatus('已取消录制，保留原快捷键。'); return; }
  recordingShortcut = true;
  $('recordImmersiveShortcut').setAttribute('aria-pressed', 'true');
  $('recordImmersiveShortcut').textContent = '取消录制';
  $('immersiveShortcut').readOnly = true;
  $('immersiveShortcut').focus();
  shortcutStatus('正在录制：请按组合键，例如 Shift+A。Esc 或 Tab 取消。');
});
$('immersiveShortcut').addEventListener('input', () => shortcutStatus('尚未保存。按 Enter 或点击“保存快捷键”应用。'));
$('immersiveShortcut').addEventListener('keydown', event => {
  if (!recordingShortcut) {
    if (event.key === 'Enter') { event.preventDefault(); applyShortcutInput(); }
    else if (event.key === 'Escape') { showImmersiveShortcut(savedImmersiveShortcut); shortcutStatus('已还原当前快捷键。'); }
    return;
  }
  if (event.key === 'Tab' || event.key === 'Escape') {
    if (event.key === 'Escape') event.preventDefault();
    stopShortcutRecording(); showImmersiveShortcut(savedImmersiveShortcut); shortcutStatus('已取消录制，保留原快捷键。'); return;
  }
  event.preventDefault(); event.stopPropagation();
  if (event.repeat || event.isComposing || ['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return;
  const shortcut = QFImmersiveShortcut.fromEvent(event);
  if (shortcut) saveImmersiveShortcut(shortcut);
  else shortcutStatus('无法录制此按键。请加上 Shift、Ctrl、Alt 或 Meta，或使用 F1–F12。Esc 取消。', true);
});
$('immersiveShortcut').addEventListener('blur', event => {
  // Let the recording button's click cancel the current recording once.
  if (event.relatedTarget === $('recordImmersiveShortcut')) return;
  if (recordingShortcut) { stopShortcutRecording(); showImmersiveShortcut(savedImmersiveShortcut); shortcutStatus('已取消录制，保留原快捷键。'); }
});
$('applyImmersiveShortcut').addEventListener('click', applyShortcutInput);
$('resetImmersiveShortcut').addEventListener('click', () => saveImmersiveShortcut(QFImmersiveShortcut.DEFAULT));
$('disableImmersiveShortcut').addEventListener('click', () => saveImmersiveShortcut(''));

function editorState() {
  return JSON.stringify({ values: formValues(), name: $('profileName').value, profileId: selectedProfileId });
}

function connectionState() {
  const values = formValues();
  return JSON.stringify(MODEL_CONNECTION_FIELDS.map(key => values[key]));
}

function updateSaveState() {
  const dirty = savedEditorState && editorState() !== savedEditorState;
  $('saveState').textContent = dirty ? '有未保存的更改' : selectedProfileId ? '当前配置已保存' : '新建配置 · 保存后应用';
  $('saveState').classList.toggle('dirty', Boolean(dirty));
}

function updateVerification() {
  const matches = draftTestState && draftTestState === JSON.stringify(formValues());
  $('modelVerification').textContent = matches ? draftTestResult : '尚未测试当前配置。测试连接发送固定短文本，不验证图片能力。';
  $('modelVerification').classList.toggle('verified', Boolean(matches));
}

function syncModelControls() {
  $('fetchModels').disabled = testing || Boolean(modelRequestId);
  $('cancelModels').hidden = !modelRequestId;
  $('cancelModels').disabled = testing;
  $('applyModel').disabled = testing || !modelList.some(model => model.id === $('modelCandidates').value);
}

function stopModelRequest() {
  if (modelRequestId) chrome.runtime.sendMessage({ type: 'CANCEL_MODELS', requestId: modelRequestId }).catch(() => {});
  modelRequestId = '';
  syncModelControls();
}

function resetModelList() {
  stopModelRequest();
  modelList = []; modelConnection = '';
  $('modelBrowser').hidden = true;
  $('modelCandidates').replaceChildren();
  $('modelSearch').value = '';
  $('modelFilter').value = 'all';
  $('modelStatus').textContent = '读取后在本地保存此 API 的模型列表，供所有翻译页切换；不自动更改当前模型。';
  $('modelStatus').classList.remove('error');
  showModelDetail();
}

function modelDetailRows(model) {
  const modalities = values => values.length ? values.join('、') + '（上游声明）' : '未知 · 上游未提供';
  return [
    ['模型 ID', model.id],
    ...(model.name && model.name !== model.id ? [['名称', model.name]] : []),
    ['提供方', model.owner || '未知 · 上游未提供'],
    ['输入能力', modalities(model.inputModalities)],
    ['输出能力', modalities(model.outputModalities)],
    ['上下文上限', model.contextWindow ? model.contextWindow.toLocaleString() + ' tokens（上游声明）' : '未知 · 上游未提供'],
    ['最大输出', model.maxOutput ? model.maxOutput.toLocaleString() + ' tokens（上游声明）' : '未知 · 上游未提供'],
    ['接口类型', model.endpoints.length ? model.endpoints.join('、') + '（上游声明）' : '未知 · 需测试当前端点'],
    ['速度 / 价格', '未提供 · 请查服务商说明，测试仅显示本次耗时'],
    ...(model.shutdownDate ? [['计划停用', model.shutdownDate + '（上游声明）']] : []),
    ...(model.description ? [['说明', model.description]] : [])
  ];
}

function showModelDetail() {
  const model = modelList.find(item => item.id === $('modelCandidates').value);
  $('modelDetailEmpty').hidden = Boolean(model);
  $('modelMetadata').hidden = !model;
  $('modelMetadata').replaceChildren();
  if (model) for (const [label, value] of modelDetailRows(model)) {
    const term = document.createElement('dt'), detail = document.createElement('dd');
    term.textContent = label; detail.textContent = value;
    $('modelMetadata').append(term, detail);
  }
  syncModelControls();
}

function renderModelList() {
  const previous = $('modelCandidates').value;
  const query = $('modelSearch').value.trim().toLocaleLowerCase();
  const filter = $('modelFilter').value;
  const visible = modelList.filter(model => {
    if (query && ![model.id, model.name, model.owner].join(' ').toLocaleLowerCase().includes(query)) return false;
    if (filter === 'vision') return model.inputModalities.includes('image');
    if (filter === 'text') return model.inputModalities.includes('text') && (!model.outputModalities.length || model.outputModalities.includes('text'));
    if (filter === 'unknown') return !model.inputModalities.length || !model.outputModalities.length;
    return true;
  });
  $('modelCandidates').replaceChildren(...visible.map(model => new Option($('apiStyle').value==='chatgpt-plan'?(model.name||model.id):model.id, model.id)));
  // Keep an existing or manually selected model visible, but never choose a new one for the user.
  const selected=visible.findIndex(model=>model.id===previous),current=visible.findIndex(model=>model.id===$('model').value.trim());
  $('modelCandidates').selectedIndex = selected>=0?selected:current>=0?current:-1;
  $('modelCount').textContent = `${visible.length} / ${modelList.length} 个模型${!visible.length ? ' · 无匹配结果，可调整筛选' : $('modelCandidates').selectedIndex>=0 ? ' · 已预览所选模型；点击其他项切换，确认后点“填入此模型”' : ' · 请选择模型并点击“填入此模型”'}`;
  showModelDetail();
}

function lockEditor() {
  testing=true;const controls=[...document.querySelectorAll('input,select,textarea,button')],disabled=controls.map(control=>control.disabled);
  controls.forEach(control=>control.disabled=true);
  return ()=>{controls.forEach((control,index)=>control.disabled=disabled[index]);$('deleteProfile').disabled=!selectedProfileId;testing=false;syncModelControls();};
}

function setStatus(message, error = false) {
  $("status").textContent = message || "";
  $("status").classList.toggle("error", error);
}

function connectionError(response, fallback) {
  const code = response?.code || '';
  const requestId = /^[a-zA-Z0-9_.-]{1,160}$/.test(response?.upstreamRequestId || '') ? response.upstreamRequestId : '';
  let guidance = '';
  if ($('apiStyle').value === 'chatgpt-plan') {
    if (code === '3p_delegated_access_policy_denied') guidance = '官方组织策略拒绝；若管理台未列出 QudadFlow，请停止重复授权，由管理员凭请求 ID 向 OpenAI 核查。';
    if (code === 'subscription_sharing_user_not_eligible') guidance = '所选账号或工作区的个人额度无法用于此接入；请勿重复授权，默认机器翻译仍可免配置使用。';
    if (guidance) $('chatgptWorkspaceHelp').open = true;
  }
  return new Error(`${code ? `[${code}] ` : ''}${response?.error || fallback}${requestId ? ` 请求 ID：${requestId}。` : ''}${guidance ? ` ${guidance}` : ''}`);
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

const ALL_WEBSITES=['https://*/*','http://*/*'];
let websitePermissionBusy=false;
async function refreshWebsitePermission(){
  const granted=await permissionContains(ALL_WEBSITES);
  $('websitePermissionStatus').textContent=granted?'已持久授权所有 HTTP/HTTPS 网站，可减少重复确认。':'当前按站点授权，已授予的权限会由浏览器保留。';
  $('grantAllWebsites').hidden=granted;
  $('revokeAllWebsites').hidden=!granted;
}
$('grantAllWebsites').onclick=async()=>{
  if(websitePermissionBusy)return;
  websitePermissionBusy=true;
  try{
    // Keep the browser permission dialog attached to this explicit click.
    const pending=permissionRequest(ALL_WEBSITES);
    $('websitePermissionStatus').textContent='等待浏览器确认网站授权…';
    const granted=await pending;await refreshWebsitePermission();
    if(!granted)$('websitePermissionStatus').textContent='未授予全部网站权限，继续使用按站点授权。';
    await askForEndpointPermission(false);
  }catch{ $('websitePermissionStatus').textContent='网站授权未完成，可重试或继续按站点授权。'; }
  finally{websitePermissionBusy=false;}
};
$('revokeAllWebsites').onclick=async()=>{
  if(websitePermissionBusy)return;
  websitePermissionBusy=true;
  try{
    const permissions=await chrome.permissions.getAll();
    const origins=(permissions.origins||[]).filter(origin=>(/^(?:https?|\*):\/\//.test(origin)||origin==='<all_urls>')&&origin!=='https://api.mymemory.translated.net/*');
    if(origins.length&&!await chrome.permissions.remove({origins}))throw new Error('网站授权未能清除，请在浏览器扩展详情中管理网站访问权限。');
    await refreshWebsitePermission();await askForEndpointPermission(false);
  }catch(error){$('websitePermissionStatus').textContent=error.message;}
  finally{websitePermissionBusy=false;}
};
for(const event of [chrome.permissions.onAdded,chrome.permissions.onRemoved])event?.addListener(()=>{refreshWebsitePermission().catch(()=>{});});
refreshWebsitePermission().catch(()=>{$('websitePermissionStatus').textContent='无法读取网站权限，请在浏览器扩展详情中检查。';});

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
  if($('apiStyle').value==='chatgpt-plan'){$('permissionStatus').textContent='ChatGPT 通过本机连接程序访问官方服务。网页读取权限仍按需授予。';return true;}
  if($('apiStyle').value==='auto-machine' || $('apiStyle').value==='mymemory' && $('endpoint').value.trim()==='https://api.mymemory.translated.net/get') {
    const granted=await permissionContains(['https://api.mymemory.translated.net/*']);
    $('permissionStatus').textContent=granted?'已允许访问 MyMemory 免费翻译接口；浏览器本地翻译不使用网络接口。':'MyMemory 域名权限不可用，请检查扩展安装权限。';
    return granted;
  }
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
    chatgptAccount: $("chatgptAccount").value,
    endpoint: $("endpoint").value.trim(),
    apiKey: $("apiKey").value,
    mymemoryEmail: $("mymemoryEmail").value.trim(),
    model: $("model").value.trim(),
    providerRegion: $("providerRegion").value.trim(),
    sourceLanguage: $("sourceLanguage").value,
    targetLanguage: $("targetLanguage").value,
    temperature: $("temperature").value === "" ? "" : Number($("temperature").value),
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
  if(values.apiStyle==='chatgpt-plan') {if(!values.chatgptAccount)throw new Error('请登录并选择 ChatGPT 账号。');if(!values.model)throw new Error('请读取并选择模型。');return;}
  if (['auto-machine','mymemory'].includes(values.apiStyle) && values.mymemoryEmail && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.mymemoryEmail) || values.mymemoryEmail.length > 254)) throw new Error('请填写有效的 MyMemory 联系邮箱，或留空使用匿名额度。');
  try {
    const url = new URL(values.endpoint);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("端点必须使用 http 或 https。");
  } catch {
    throw new Error("请输入有效的 API 端点。");
  }
  if (!values.model && values.apiStyle === "openai-compatible") throw new Error("请填写模型名称。");
  if (!values.apiKey && !['custom-json','mymemory','auto-machine'].includes(values.apiStyle)) throw new Error("请填写 API Key。");
  if(values.apiStyle==='mymemory' && values.sourceLanguage==='auto')throw new Error('MyMemory 试用需手动选择源语言。');
  let headers;
  try { headers = JSON.parse(values.customHeaders); } catch { throw new Error("自定义请求头必须是有效 JSON。"); }
  if (!headers || typeof headers !== "object" || Array.isArray(headers)) throw new Error("自定义请求头必须是 JSON 对象。");
  if (values.apiStyle === "custom-json") {
    try { JSON.parse(templateForValidation(values.requestTemplate)); } catch { throw new Error("自定义请求模板替换占位符后必须是有效 JSON。"); }
    if (!values.responsePath) throw new Error("请填写自定义接口的译文响应路径。");
  }
}

function renderApiStyle() {
  const style = $("apiStyle").value,plan=style==='chatgpt-plan',automatic=style==='auto-machine',ai=plan||style==='openai-compatible';
  $('chatgptConnection').hidden=!plan;$('endpointWrap').classList.toggle('field-hidden',plan||automatic);
  $('localModelWrap').hidden=!automatic;
  const browserModelSupported=Boolean(globalThis.Translator?.create);
  $('prepareLocalModel').disabled=!browserModelSupported;
  if(automatic&&!browserModelSupported)$('localModelStatus').textContent='当前浏览器未开放本地 Translator 模型，将直接使用 MyMemory。';
  if(automatic)$('endpoint').value=PROVIDER_ENDPOINTS['auto-machine'];
  $('temperature').disabled=plan;
  if(plan){$('endpoint').value='https://api.openai.com/v1/responses';$('apiKey').value='';$('customHeaders').value='{}';$('temperature').value='';$('streamOpenAi').checked=true;}
  $("customSection").classList.toggle("visible", style === "custom-json");
  $("modelWrap").classList.toggle("field-hidden", DIRECT_STYLES.has(style));
  $("regionWrap").classList.toggle("visible", style === "microsoft-translator");
  $("streamWrap").classList.toggle("field-hidden", style !== "openai-compatible");
  $('fetchModels').hidden = !ai;
  $('modelStatus').hidden = !ai;
  $('modelBrowser').hidden = !ai || !modelConnection;
  $('modelVerification').hidden = !ai;
  $("apiKeyWrap").classList.toggle("field-hidden",style==='mymemory'||automatic||plan);
  $("mymemoryEmailWrap").classList.toggle("field-hidden",style!=='mymemory'&&!automatic);
  $("customHeadersWrap").classList.toggle("field-hidden",style==='mymemory'||automatic||plan);
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
  if(style!=='auto-machine')localModelController?.abort();
  if (renderedStyle) providerDrafts.set(renderedStyle, formValues());
  const draft = providerDrafts.get(style) || { ...DEFAULTS, endpoint: PROVIDER_ENDPOINTS[style] || "", apiKey: "" };
  for (const key of CONNECTION_FIELDS) $(key).value = draft[key] ?? "";
  if(style==='mymemory' && $('sourceLanguage').value==='auto')$('sourceLanguage').value='en';
  renderedStyle = style;
  resetModelList();
  renderApiStyle();
  updateSaveState(); updateVerification();
  setStatus("已切换接口；请检查连接信息并保存设置。");
  askForEndpointPermission(false);
}

function showValues(values) {
  values={...DEFAULTS,...values};
  $('chatgptAccount').dataset.saved=values.chatgptAccount||'';
  if(values.chatgptAccount&&!Array.from($('chatgptAccount').options).some(o=>o.value===values.chatgptAccount))$('chatgptAccount').add(new Option('已保存账号 · 请检测连接',values.chatgptAccount));
  $('apiKey').type='password';$('toggleKey').textContent='显示';
  providerDrafts.clear();
  for (const [key, value] of Object.entries(values)) {
    const element = $(key);
    if (element?.type === "checkbox") element.checked = value;
    else if (element) element.value = value;
  }
  renderedStyle=values.apiStyle;renderApiStyle();
  resetModelList(); updateVerification();
  if (values.customHeaders && values.customHeaders.trim() !== '{}') $('customHeadersWrap').open = true;
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
  savedEditorState = editorState(); updateSaveState();
}
async function load() {
  await loadProfiles();
  const values = await chrome.storage.local.get(DEFAULTS);
  showValues(values);
  const appearance = await chrome.storage.local.get({ immersiveTranslationColor: '', immersiveShortcut: QFImmersiveShortcut.DEFAULT, immersiveShortcutVersion: 0 });
  savedImmersiveColor = normalizeImmersiveColor(appearance.immersiveTranslationColor);
  showImmersiveColor(savedImmersiveColor);
  colorStatus(savedImmersiveColor ? `当前颜色 ${savedImmersiveColor.toUpperCase()}，选色后自动保存。` : '默认颜色随浅色、深色模式适配。');
  const shortcut = QFImmersiveShortcut.resolve(appearance);
  savedImmersiveShortcut = shortcut;
  showImmersiveShortcut(shortcut);
  shortcutStatus(appearance.immersiveShortcutVersion !== QFImmersiveShortcut.VERSION && appearance.immersiveShortcut === 'Ctrl+A' ? '旧版默认 Ctrl+A 已改为 Shift+A；如仍需 Ctrl+A，可重新录制或手动保存。' : shortcut ? `当前快捷键 ${shortcut}，可录制或手动输入后保存。` : '网页快捷键已停用。');
  await askForEndpointPermission(false);
  savedEditorState = editorState(); updateSaveState();
  document.body.dataset.ready='true';
  document.dispatchEvent(new Event('qf-settings-ready'));
  if(new URLSearchParams(location.search).get('preview')==='chatgpt'){
    $('apiStyle').value='chatgpt-plan';
    $('apiStyle').dispatchEvent(new Event('change'));
    $('connectionSettings').open=true;
    history.replaceState(null,'',location.pathname+location.hash);
  }
}

$("settingsForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (testing) return;
  stopModelRequest();
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
  if(profile){showValues(profile.values);$('profileName').value=profile.name;}else{showValues(DEFAULTS);$('profileName').value='';}
  updateSaveState();
  $('deleteProfile').disabled=!profile;setStatus('方案已载入编辑器。编辑后点击“保存设置”应用，或另存为新方案。');askForEndpointPermission(false);
});
$('saveAsProfile').addEventListener('click',async()=>{
  if(testing)return;stopModelRequest();let unlock;try{const values=formValues();validate(values);const permission=askForEndpointPermission();unlock=lockEditor();await saveProfile(values,true);const granted=await permission;setStatus(granted?'新方案已保存并启用。':'新方案已保存，请允许 API 域名访问。',!granted);}catch(error){setStatus(error.message,true);}finally{unlock?.();}
});
$('deleteProfile').addEventListener('click',async()=>{
  if(testing||!selectedProfileId)return;
  if(!confirm('删除这个本地配置方案？若它正在使用，将同时清空当前连接中的密钥。'))return;
  stopModelRequest();
  const unlock=lockEditor();try{await profileMessage({type:'PROFILE_DELETE',profileId:selectedProfileId,revision:profileRevision});await load();setStatus('配置方案已删除。');}catch(error){setStatus(error.message,true);}finally{unlock();}
});
$('useTrial').addEventListener('click',async()=>{
  if(testing)return;
  stopModelRequest();
  const permission=permissionContains(['https://api.mymemory.translated.net/*']),unlock=lockEditor();
  try{await profileMessage({type:'PROFILE_TRIAL'});await load();const granted=await permission;setStatus(granted?'MyMemory 基础试用已启用：English → 简体中文。可测试连接或返回网页翻译。':'基础试用已保存；请允许 MyMemory 域名访问。',!granted);}catch(error){setStatus(error.message,true);}finally{unlock();}
});

$("requestPermission").addEventListener("click", () => askForEndpointPermission());
$("apiStyle").addEventListener("change", switchProvider);
$('prepareLocalModel').addEventListener('click', async () => {
  const api=globalThis.Translator;
  if(!api?.create||localModelController)return;
  const tag=language=>/^zh-(tw|hk|hant)$/i.test(language)?'zh-Hant':/^zh(?:-|$)/i.test(language)?'zh':String(language).split('-')[0].toLowerCase();
  const targetLanguage=tag($('targetLanguage').value);
  let sourceLanguage=tag($('sourceLanguage').value==='auto'?'en':$('sourceLanguage').value);
  if(sourceLanguage===targetLanguage)sourceLanguage=targetLanguage==='en'?'zh':'en';
  const controller=new AbortController();
  localModelController=controller;
  $('prepareLocalModel').disabled=true;
  $('cancelLocalModel').hidden=false;
  $('localModelStatus').textContent='正在准备 '+sourceLanguage+' → '+targetLanguage+' 本地模型…';
  let session;
  try{
    // create() is called in the button gesture so the browser may download its model.
    session=await api.create({sourceLanguage,targetLanguage,signal:controller.signal,monitor(m){
      m.addEventListener('downloadprogress',event=>{
        if(!controller.signal.aborted&&Number.isFinite(event.loaded))$('localModelStatus').textContent='正在下载本地模型：'+Math.round(event.loaded*100)+'%';
      });
    }});
    if(controller.signal.aborted){$('localModelStatus').textContent='已取消本地模型下载。';return;}
    localStorage.removeItem('qfLocalTranslationAvailability:'+sourceLanguage+':'+targetLanguage);
    await chrome.runtime.sendMessage({type:'QF_BROWSER_TRANSLATOR_READY',sourceLanguage,targetLanguage});
    $('localModelStatus').textContent='本地模型已准备好。此语言方向会优先在设备上翻译。';
  }catch(error){
    $('localModelStatus').textContent=controller.signal.aborted?'已取消本地模型下载。':'本地模型暂不可用：'+(error?.message||'浏览器不支持此语言方向')+'。仍可使用 MyMemory。';
  }finally{
    try{session?.destroy();}catch{}
    if(localModelController===controller)localModelController=undefined;
    $('cancelLocalModel').hidden=true;
    $('prepareLocalModel').disabled=!globalThis.Translator?.create;
  }
});
$('cancelLocalModel').addEventListener('click',()=>localModelController?.abort());
window.addEventListener('pagehide',()=>localModelController?.abort());
$("endpoint").addEventListener("change", () => askForEndpointPermission(false));
$("toggleKey").addEventListener("click", () => {
  const input = $("apiKey");
  input.type = input.type === "password" ? "text" : "password";
  $("toggleKey").textContent = input.type === "password" ? "显示" : "隐藏";
});
$("testApi").addEventListener("click", async () => {
  if (testing) return;
  stopModelRequest();
  let timer, unlock;
  try {
    const values = formValues();
    validate(values);
    const permissionPromise = askForEndpointPermission();
    unlock = lockEditor();
    const granted = await permissionPromise;
    if (!granted) return;
    testRequestId = crypto.randomUUID();
    testCancelled = false;
    $('cancelTestApi').hidden = false;
    $('cancelTestApi').disabled = false;
    const started = Date.now();
    const render = () => setStatus(testCancelled ? '正在停止测试…' : `正在测试 API…已等待 ${Math.floor((Date.now() - started) / 1000)} 秒，可手动停止。`);
    render();
    timer = setInterval(render, 1000);
    const response = await chrome.runtime.sendMessage({ type: "TRANSLATE_TEST_DRAFT", requestId: testRequestId, values });
    if (testCancelled || response?.code === 'CANCELLED') {
      draftTestState = ''; updateVerification();
      setStatus('测试已停止。'); return;
    }
    if (!response?.ok) throw connectionError(response, 'API 测试失败。');
    const seconds = ((response.elapsedMs || Date.now() - started) / 1000).toFixed(1);
    draftTestState = JSON.stringify(values);
    draftTestResult = `当前模型文本连接通过 · 本次 ${seconds} 秒。图片能力尚未测试；配置仅在点击保存后应用。`;
    updateVerification();
    setStatus(`连接成功（${seconds} 秒）：${response.translation}。点击“保存设置”应用此配置。`);
  } catch (error) {
    draftTestState = ''; updateVerification();
    setStatus(error.message, true);
  } finally {
    clearInterval(timer);
    testRequestId = '';
    $('cancelTestApi').hidden = true;
    unlock?.();
  }
});

function stopTestRequest() {
  if (!testRequestId) return;
  testCancelled = true;
  $('cancelTestApi').disabled = true;
  chrome.runtime.sendMessage({type:'CANCEL_TEST_DRAFT',requestId:testRequestId}).catch(() => {});
}
$('cancelTestApi').addEventListener('click', stopTestRequest);

$('fetchModels').addEventListener('click', async () => {
  if (testing || modelRequestId) return;
  const values = formValues();
  if (values.apiStyle==='chatgpt-plan'?!values.chatgptAccount:(!endpointPattern() || !values.apiKey.trim())) {
    $('modelStatus').textContent = values.apiStyle==='chatgpt-plan'?'请先登录并选择 ChatGPT 账号，再读取模型列表。':'请先填写有效端点和 API Key，再读取模型列表。';
    $('modelStatus').classList.add('error'); return;
  }
  const permission = askForEndpointPermission();
  const requestId = crypto.randomUUID(), connection = connectionState();
  modelRequestId = requestId;
  modelList = []; modelConnection = '';
  $('modelBrowser').hidden = true;
  $('modelCandidates').replaceChildren(); showModelDetail();
  $('modelStatus').textContent = '正在读取上游模型…持续等待接口响应，可随时取消。';
  $('modelStatus').classList.remove('error'); syncModelControls();
  try {
    const granted = await permission;
    if (modelRequestId !== requestId) return;
    if (!granted) throw new Error('未获得所填 API 域名权限，可授权后重试。');
    const response = await chrome.runtime.sendMessage({ type: 'FETCH_MODELS', requestId, values });
    if (modelRequestId !== requestId || connectionState() !== connection) return;
    if (!response?.ok) throw connectionError(response, '未能读取模型，可手动填写准确 ID。');
    modelList = response.models;
    modelConnection = connection;
    $('modelBrowser').hidden = false;
    $('modelSearch').value = ''; $('modelFilter').value = 'all';
    renderModelList();
    const currentMissing = values.model && !modelList.some(model => model.id === values.model);
    $('modelStatus').textContent = `已从 ${response.source} 读取 ${modelList.length} 个模型，列表已在本地保存并按连接隔离。${currentMissing ? '当前模型未在列表中，已保留；可手动测试。' : '当前模型未更改；请在列表中选中模型并点击“填入此模型”。'}${response.truncated ? '列表较大或上游还有分页，当前仅显示本批最多 1000 个。' : ''}${response.skipped ? '已忽略无效条目。' : ''}`;
    if(modelList.length)$('modelBrowser').scrollIntoView({block:'nearest'});
  } catch (error) {
    if (modelRequestId === requestId) {
      $('modelStatus').textContent = error.message;
      $('modelStatus').classList.add('error');
    }
  } finally {
    if (modelRequestId === requestId) modelRequestId = '';
    syncModelControls();
  }
});

$('cancelModels').addEventListener('click', () => {
  stopModelRequest();
  $('modelStatus').textContent = '已取消读取模型，当前配置未更改。';
});
$('modelSearch').addEventListener('input', renderModelList);
$('modelFilter').addEventListener('change', renderModelList);
$('modelCandidates').addEventListener('change', showModelDetail);
$('applyModel').addEventListener('click', () => {
  const model = modelList.find(item => item.id === $('modelCandidates').value);
  if (!model || testing || connectionState() !== modelConnection) return;
  $('model').value = model.id;
  updateSaveState(); updateVerification();
  setStatus('已填入所选模型。可测试文本连接，确认后点击“保存设置”。');
});
for (const eventName of ['input', 'change']) $('settingsForm').addEventListener(eventName, event => {
  if (MODEL_CONNECTION_FIELDS.includes(event.target.id)) resetModelList();
  updateSaveState(); updateVerification();
});
window.addEventListener('pagehide', () => { stopModelRequest(); stopTestRequest(); });

const navLinks = [...document.querySelectorAll('.settings-nav nav a')];
const foldingSections=[...document.querySelectorAll('.settings-section')];
const nestedSections=[...document.querySelectorAll('#customSection')];
let folded={};try{const saved=JSON.parse(localStorage.getItem('qudadflow-settings-folds')||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))folded=saved;}catch{}
if(folded.profileSettings===true)folded.connectionSettings=true;
delete folded.profileSettings;
delete folded.trialSettings;
delete folded.permissionSettings;
for(const section of [...foldingSections,...nestedSections]){
  if(typeof folded[section.id]==='boolean')section.open=folded[section.id];
  section.addEventListener('toggle',()=>{folded[section.id]=section.open;try{localStorage.setItem('qudadflow-settings-folds',JSON.stringify(folded));}catch{}});
}
function revealSection(hash){const target=document.getElementById(hash.slice(1)),section=target?.matches('.settings-section')?target:target?.closest('.settings-section');if(section)section.open=true;if(target instanceof HTMLDetailsElement&&target!==section)target.open=true;}
$('collapseSettings').onclick=()=>foldingSections.forEach(section=>section.open=false);
$('expandSettings').onclick=()=>foldingSections.forEach(section=>section.open=true);
window.addEventListener('hashchange',()=>revealSection(location.hash));revealSection(location.hash);
const sectionObserver = new IntersectionObserver(entries => {
  const entry = entries.find(item => item.isIntersecting);
  if (!entry) return;
  for (const link of navLinks) {
    if (link.hash === '#' + entry.target.id) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
}, { rootMargin: '-5% 0px -65% 0px' });
for (const link of navLinks) {
  link.addEventListener('click',()=>revealSection(link.hash));
  const section = document.querySelector(link.hash);
  if (section) sectionObserver.observe(section);
}

load().catch((error) => setStatus(`读取设置失败：${error.message}`, true));
