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
  "openai-compatible": "可填写 OpenAI、DeepSeek、智谱、通义、Moonshot、硅基流动、Ollama 等兼容接口的完整地址。",
  "google-translate-v2": "机器翻译直连：填写 Google Cloud Translation v2 地址，API Key 会作为 key 参数发送。默认地址：https://translation.googleapis.com/language/translate/v2。",
  "microsoft-translator": "机器翻译直连：填写 Azure Translator 地址，默认地址：https://api.cognitive.microsofttranslator.com/translate；API Key 放入 Ocp-Apim-Subscription-Key。",
  deepl: "机器翻译直连：填写 DeepL 地址（免费版通常是 https://api-free.deepl.com/v2/translate，专业版使用 api.deepl.com）。",
  "custom-json": "自定义接口可配置请求体、请求头和响应路径；适合其他机器翻译服务或自建翻译网关。"
};

const ENDPOINT_HINTS = {
  "openai-compatible": "OpenAI 兼容接口可填完整地址，或填到 /v1；扩展会补全 /chat/completions。",
  "google-translate-v2": "请填写 Google Cloud Translation v2 的 POST 地址；扩展会把 API Key 作为 key 参数加入请求。",
  "microsoft-translator": "请填写 Azure Translator 的 POST 地址；扩展会自动加入 api-version=3.0 和目标语言参数。",
  deepl: "请填写 DeepL 的 POST 地址；免费版通常是 api-free.deepl.com，专业版通常是 api.deepl.com。",
  "custom-json": "请填写自定义服务实际接收 POST 请求的地址。"
};

const DIRECT_STYLES = new Set(["google-translate-v2", "microsoft-translator", "deepl"]);
const PROVIDER_ENDPOINTS = {
  "openai-compatible": DEFAULTS.endpoint,
  "google-translate-v2": "https://translation.googleapis.com/language/translate/v2",
  "microsoft-translator": "https://api.cognitive.microsofttranslator.com/translate",
  deepl: "https://api-free.deepl.com/v2/translate",
  "custom-json": ""
};
const CONNECTION_FIELDS = ["endpoint", "apiKey", "model", "providerRegion", "customHeaders", "requestTemplate", "responsePath"];
const providerDrafts = new Map();
let renderedStyle;

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
    temperature: Number($("temperature").value),
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
  if (!values.apiKey && values.apiStyle !== "custom-json") throw new Error("请填写 API Key。");
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
  renderedStyle = style;
  renderApiStyle();
  setStatus("已切换接口；请检查连接信息并保存设置。");
  askForEndpointPermission(false);
}

async function load() {
  const values = await chrome.storage.local.get(DEFAULTS);
  for (const [key, value] of Object.entries(values)) {
    const element = $(key);
    if (element) element.value = value;
  }
  renderedStyle = values.apiStyle;
  renderApiStyle();
  await askForEndpointPermission(false);
}

$("settingsForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const values = formValues();
    validate(values);
    const permissionPromise = askForEndpointPermission();
    await chrome.storage.local.set(values);
    const granted = await permissionPromise;
    setStatus(granted ? "设置已保存。" : "设置已保存，但尚未授予 API 域名权限。", !granted);
  } catch (error) {
    setStatus(error.message, true);
  }
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
  try {
    const values = formValues();
    validate(values);
    const permissionPromise = askForEndpointPermission();
    await chrome.storage.local.set(values);
    const granted = await permissionPromise;
    if (!granted) return;
    setStatus("正在测试 API…");
    const response = await chrome.runtime.sendMessage({ type: "TRANSLATE_TEST" });
    if (!response?.ok) throw new Error(response?.error || "API 测试失败。");
    setStatus(`连接成功：${response.translation}`);
  } catch (error) {
    setStatus(error.message, true);
  }
});

load().catch((error) => setStatus(`读取设置失败：${error.message}`, true));
