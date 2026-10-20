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

if (typeof importScripts === "function") importScripts("profile-store.js", "my-memory.js");

const MAX_INPUT_CHARS = 12000;
const REQUEST_TIMEOUT_MS = 45000;
const activeRequests = new Map();
const translationCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_CHARS = 250000;
let cacheConfiguration = "";
let cacheChars = 0;

function clearTranslationCache() {
  translationCache.clear();
  cacheConfiguration = "";
  cacheChars = 0;
}

function cachedTranslation(settings, text, context) {
  // Memory only: a provider, credential or preference change invalidates previous results.
  const configuration = JSON.stringify(settings);
  if (configuration !== cacheConfiguration) { clearTranslationCache(); cacheConfiguration = configuration; }
  const now = Date.now();
  for (const [expiredKey, entry] of translationCache) {
    if (now - entry.created >= CACHE_TTL_MS) { cacheChars -= entry.chars; translationCache.delete(expiredKey); }
  }
  const key = JSON.stringify([context, text]);
  const entry = translationCache.get(key);
  if (entry) {
    translationCache.delete(key);
    translationCache.set(key, entry);
    return { key, translation: entry.translation };
  }
  return { key };
}

function rememberTranslation(key, translation, configuration) {
  if (JSON.stringify(configuration) !== cacheConfiguration) return translation;
  const chars = key.length + translation.length;
  if (chars > CACHE_MAX_CHARS) return translation;
  const old = translationCache.get(key);
  if (old) cacheChars -= old.chars;
  translationCache.delete(key);
  translationCache.set(key, { translation, chars, created: Date.now() });
  cacheChars += chars;
  while (translationCache.size > 128 || cacheChars > CACHE_MAX_CHARS) {
    const first = translationCache.keys().next().value;
    cacheChars -= translationCache.get(first).chars;
    translationCache.delete(first);
  }
  return translation;
}

function selectionScriptId(pattern) {
  return `qf-selection-${encodeURIComponent(pattern)}`;
}

function selectionPattern(url) {
  const parsed = new URL(url);
  if (!/^https?:$/.test(parsed.protocol)) throw new Error("划词按钮仅支持普通 HTTP/HTTPS 网页。");
  return `${parsed.protocol}//${parsed.hostname}/*`;
}

function translationError(message, code) {
  return Object.assign(new Error(message), { code });
}

function storageGet(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (value) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(value);
    });
  });
}

function tabsSendMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(response);
    });
  });
}

function normalizeSettings(settings) {
  return { ...DEFAULTS, ...(settings || {}) };
}

function getOriginPattern(endpoint) {
  const url = new URL(endpoint);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("API 端点必须使用 http 或 https。");
  }
  return `${url.protocol}//${url.host}/*`;
}

function permissionsContains(origins) {
  return new Promise((resolve) => {
    chrome.permissions.contains({ origins }, (result) => {
      resolve(Boolean(result));
    });
  });
}

function openAiEndpoint(endpoint) {
  const url = new URL(endpoint);
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.hash = "";
  if (/\/(chat\/completions|responses)$/.test(url.pathname)) return url.toString();
  if (url.pathname.endsWith("/v1")) {
    url.pathname += "/chat/completions";
  } else {
    url.pathname += "/v1/chat/completions";
  }
  return url.toString();
}

function hasHeader(headers, name) {
  return Object.keys(headers).some((key) => key.toLowerCase() === name.toLowerCase());
}

function googleLanguage(language) {
  return String(language || "auto").toLowerCase() === "zh-cn" ? "zh-CN" : language;
}

function microsoftLanguage(language) {
  const aliases = {
    "zh-CN": "zh-Hans",
    "zh-TW": "zh-Hant",
    en: "en",
    ja: "ja",
    ko: "ko",
    fr: "fr",
    de: "de",
    es: "es",
    ru: "ru"
  };
  return aliases[language] || language;
}

function deeplLanguage(language, source = false) {
  if (source && /^(zh|zh-cn|zh-tw|zh-hans|zh-hant)$/i.test(language)) return "ZH";
  const aliases = {
    "zh-CN": "ZH-HANS",
    "zh-TW": "ZH-HANT",
    en: "EN",
    ja: "JA",
    ko: "KO",
    fr: "FR",
    de: "DE",
    es: "ES",
    ru: "RU"
  };
  return aliases[language] || String(language || "").toUpperCase();
}

function replaceJsonTemplate(template, values) {
  return String(template).replace(/\{\{(text|model|sourceLanguage|targetLanguage|context|apiKey)\}\}/g, (_, key) => {
    return JSON.stringify(values[key] ?? "");
  });
}

function replaceHeaderTemplate(template, values) {
  return String(template).replace(/\{\{(text|model|sourceLanguage|targetLanguage|context|apiKey)\}\}/g, (_, key) => {
    const value = String(values[key] ?? "");
    return value.replace(/[\\\"\u0000-\u001f]/g, (char) => {
      const escapes = { "\\": "\\\\", "\"": "\\\"", "\n": "\\n", "\r": "\\r", "\t": "\\t" };
      return escapes[char] || `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`;
    });
  });
}

function parseHeaders(raw, values) {
  let parsed = {};
  if (raw && String(raw).trim()) {
    try {
      parsed = JSON.parse(replaceHeaderTemplate(raw, values));
    } catch (error) {
      throw new Error(`自定义请求头不是有效 JSON：${error.message}`);
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("自定义请求头必须是 JSON 对象。");
  }
  return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value)]));
}

function getByPath(value, path) {
  if (!path) return value;
  const parts = String(path).replace(/\[([0-9]+)\]/g, ".$1").split(".").filter(Boolean);
  let current = value;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

function readTranslation(response, settings) {
  let candidates;
  if (settings.apiStyle === "custom-json") {
    candidates = [getByPath(response, settings.responsePath)];
  } else if (settings.apiStyle === "google-translate-v2") {
    candidates = [getByPath(response, "data.translations[0].translatedText")];
  } else if (settings.apiStyle === "microsoft-translator") {
    candidates = [getByPath(response, "[0].translations[0].text")];
  } else if (settings.apiStyle === "deepl") {
    candidates = [getByPath(response, "translations[0].text")];
  } else {
    if (response?.error) throw translationError(response.error.message || "接口返回错误。", "API_ERROR");
    if (response?.status === "incomplete" || response?.choices?.[0]?.finish_reason === "length") {
      throw translationError("API 输出被截断，请缩短文本或检查模型的输出限制。", "INCOMPLETE_RESPONSE");
    }
    const content = getByPath(response, "choices[0].message.content");
    candidates = [
      Array.isArray(content) ? content.filter((part) => part.type === "text" || part.type === "output_text").map((part) => part.text || "").join("") : content,
      response?.output_text,
      Array.isArray(response?.output) ? response.output.filter((item) => item.type === "message").flatMap((item) => item.content || []).filter((part) => part.type === "output_text").map((part) => part.text || "").join("\n") : undefined,
      getByPath(response, "choices[0].text"),
      getByPath(response, "translation"),
      getByPath(response, "result")
    ];
  }
  const text = candidates.find((item) => typeof item === "string" && item.trim());
  if (!text) throw translationError("API 返回中没有找到翻译文本，请检查端点协议、模型或自定义响应路径。", "EMPTY_TRANSLATION");
  return text.trim();
}

function buildRequest(settings, text, context) {
  const values = {
    text,
    model: settings.model,
    sourceLanguage: settings.sourceLanguage,
    targetLanguage: settings.targetLanguage,
    context,
    apiKey: settings.apiKey
  };
  const headers = { "Content-Type": "application/json", ...parseHeaders(settings.customHeaders, values) };
  let endpoint = settings.endpoint.trim();
  let body;
  if (settings.apiStyle === "google-translate-v2") {
    const url = new URL(endpoint);
    url.searchParams.set("key", settings.apiKey);
    endpoint = url.toString();
    body = { q: [text], target: googleLanguage(settings.targetLanguage), format: "text" };
    if (settings.sourceLanguage && settings.sourceLanguage !== "auto") body.source = googleLanguage(settings.sourceLanguage);
  } else if (settings.apiStyle === "microsoft-translator") {
    const url = new URL(endpoint);
    if (!url.searchParams.has("api-version")) url.searchParams.set("api-version", "3.0");
    url.searchParams.set("to", microsoftLanguage(settings.targetLanguage));
    if (settings.sourceLanguage && settings.sourceLanguage !== "auto") url.searchParams.set("from", microsoftLanguage(settings.sourceLanguage));
    endpoint = url.toString();
    if (!hasHeader(headers, "Ocp-Apim-Subscription-Key")) headers["Ocp-Apim-Subscription-Key"] = settings.apiKey;
    if (settings.providerRegion && !hasHeader(headers, "Ocp-Apim-Subscription-Region")) headers["Ocp-Apim-Subscription-Region"] = settings.providerRegion;
    body = [{ Text: text }];
  } else if (settings.apiStyle === "deepl") {
    const form = new URLSearchParams();
    form.set("text", text);
    form.set("target_lang", deeplLanguage(settings.targetLanguage));
    if (settings.sourceLanguage && settings.sourceLanguage !== "auto") form.set("source_lang", deeplLanguage(settings.sourceLanguage, true));
    endpoint = new URL(endpoint).toString();
    if (!hasHeader(headers, "Authorization")) headers.Authorization = `DeepL-Auth-Key ${settings.apiKey}`;
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = form.toString();
  } else if (settings.apiStyle === "custom-json") {
    try {
      body = JSON.parse(replaceJsonTemplate(settings.requestTemplate, values));
    } catch (error) {
      throw new Error(`自定义请求模板不是有效 JSON：${error.message}`);
    }
  } else {
    endpoint = openAiEndpoint(endpoint);
    const instructions = `You are a translation engine. Translate from ${settings.sourceLanguage || "auto-detected language"} to ${settings.targetLanguage}. Preserve meaning, line breaks, punctuation, URLs, placeholders, Markdown, and code. Return only the translation. Context: ${context || "web page"}.`;
    body = new URL(endpoint).pathname.endsWith("/responses")
      ? { model: settings.model, instructions, input: text, stream: settings.streamOpenAi !== false, store: false }
      : { model: settings.model, stream: settings.streamOpenAi !== false, messages: [
        {
          role: "system",
          content: instructions
        },
        { role: "user", content: text }
      ] };
    if (settings.temperature !== "" && settings.temperature !== null && Number.isFinite(Number(settings.temperature))) {
      body.temperature = Math.min(1, Math.max(0, Number(settings.temperature)));
    }
    if (settings.apiKey && !Object.keys(headers).some((key) => key.toLowerCase() === "authorization")) {
      headers.Authorization = `Bearer ${settings.apiKey}`;
    }
  }
  return { endpoint, headers, body };
}

function httpError(status, detail) {
  const hints = {
    400: "请检查模型与接口协议是否匹配。",
    401: "API Key 无效或已过期。",
    403: "请检查 Key 权限和模型访问权限。",
    404: "请检查 API 地址和模型名称。",
    429: "接口限流或额度不足，请稍后再试。",
    502: "网关上游暂时不可用。", 503: "网关上游暂时不可用。", 504: "网关等待上游超时。"
  };
  return translationError(`API 返回 ${status}：${detail} ${hints[status] || ""}`.trim(), `HTTP_${status}`);
}

// Read only translation deltas. Reasoning, tool calls and SSE metadata are never displayed.
async function readEventStream(response, settings, onProgress) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let translation = "";
  let completed = false;
  let bytes = 0;
  const consume = (event) => {
    const data = event.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
    if (!data) return;
    if (data.trim() === "[DONE]") { completed = true; return; }
    let item;
    try { item = JSON.parse(data); } catch { throw translationError("接口返回了无效的流式数据。", "INVALID_RESPONSE"); }
    if (item.error || item.type === "error" || item.type === "response.failed") {
      throw translationError(item.error?.message || item.response?.error?.message || item.message || "API 流式请求失败。", "API_ERROR");
    }
    if (item.type === "response.incomplete" || item.choices?.[0]?.finish_reason === "length") {
      throw translationError("API 输出被截断，请缩短文本或检查模型的输出限制。", "INCOMPLETE_RESPONSE");
    }
    const delta = item.type === "response.output_text.delta" ? item.delta : item.choices?.[0]?.delta?.content;
    if (typeof delta === "string") translation += delta;
    else if (Array.isArray(delta)) translation += delta.filter((part) => part.type === "text").map((part) => part.text || "").join("");
    if (item.type === "response.completed") {
      translation = readTranslation(item.response, settings);
      completed = true;
    }
    if (translation) onProgress(translation);
  };
  try {
    while (!completed) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 2 * 1024 * 1024) throw translationError("API 响应过大，请缩短文本。", "RESPONSE_TOO_LARGE");
      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, "\n");
      let boundary;
      while ((boundary = buffer.indexOf("\n\n")) >= 0 && !completed) {
        consume(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
      }
    }
    buffer += decoder.decode();
    if (!completed && buffer.trim()) consume(buffer.replace(/\r\n/g, "\n"));
    if (!completed) throw translationError("API 连接提前结束，未收到完整译文，请重试。", "INCOMPLETE_RESPONSE");
    if (!translation.trim()) throw translationError("API 返回中没有找到翻译文本。", "EMPTY_TRANSLATION");
    return translation.trim();
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

async function translateText(request, controller = new AbortController(), onProgress = () => {}, metadata = {}) {
  const settings = normalizeSettings(await storageGet(DEFAULTS));
  const effectiveSettings = {
    ...settings,
    sourceLanguage: request.sourceLanguage || settings.sourceLanguage,
    targetLanguage: request.targetLanguage || settings.targetLanguage
  };
  const text = String(request.text || "").trim();
  if (!text) throw new Error("没有可翻译的文本。");
  if (text.length > MAX_INPUT_CHARS) throw new Error(`单次翻译最多支持 ${MAX_INPUT_CHARS} 个字符，请缩短文本后重试。`);
  if (!effectiveSettings.endpoint.trim()) throw new Error("请先在设置中填写 API 端点。");
  if (!effectiveSettings.apiKey && !["custom-json", "mymemory"].includes(effectiveSettings.apiStyle)) throw new Error("请先在设置中填写 API Key。");
  if (effectiveSettings.apiStyle === "openai-compatible" && !effectiveSettings.model.trim()) throw new Error("请先在设置中填写模型名称。");
  if (controller.signal.aborted) throw translationError("翻译已取消。", "CANCELLED");

  const pattern = getOriginPattern(effectiveSettings.endpoint);
  if (!(await permissionsContains([pattern]))) {
    const error = new Error(`尚未允许访问 API 域名：${pattern}`);
    error.code = "PERMISSION_REQUIRED";
    throw error;
  }
  if (controller.signal.aborted) throw translationError("翻译已取消。", "CANCELLED");

  const context = request.context || "web page";
  const cached = cachedTranslation(effectiveSettings, text, context);
  // A connection test must always reach the provider.
  if (!request.skipCache && cached.translation) {
    metadata.cached = true;
    onProgress(cached.translation);
    return cached.translation;
  }

  const { endpoint, headers, body } = effectiveSettings.apiStyle==='mymemory'?{}:buildRequest(effectiveSettings, text, context);
  const timeoutSeconds = Number(effectiveSettings.requestTimeoutSeconds);
  const timeoutMs = Number.isFinite(timeoutSeconds) && timeoutSeconds >= 10 && timeoutSeconds <= 180 ? timeoutSeconds * 1000 : REQUEST_TIMEOUT_MS;
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    if(effectiveSettings.apiStyle==='mymemory')return rememberTranslation(cached.key,await translateMyMemory(effectiveSettings,text,controller,onProgress),effectiveSettings);
    // Retry only a rejected temperature parameter, once, within the original deadline.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch(endpoint, {
        method: "POST", headers,
        body: typeof body === "string" ? body : JSON.stringify(body),
        signal: controller.signal
      });
      if (response.ok && /text\/event-stream/i.test(response.headers.get("content-type") || "") && effectiveSettings.apiStyle === "openai-compatible") {
        return rememberTranslation(cached.key, await readEventStream(response, effectiveSettings, onProgress), effectiveSettings);
      }
      const raw = await response.text();
      let parsed;
      try { parsed = JSON.parse(raw); } catch {
        if (!response.ok) throw httpError(response.status, "端点返回的内容不是 JSON。");
        throw translationError("API 返回的内容不是 JSON，请确认填写的是 API 地址而非网站首页。", "INVALID_RESPONSE");
      }
      if (!response.ok) {
        const detail = typeof parsed?.error?.message === "string" ? parsed.error.message.slice(0, 300) : "请查看服务商后台错误记录。";
        if (attempt === 0 && response.status === 400 && effectiveSettings.apiStyle === "openai-compatible" && Object.hasOwn(body, "temperature") && /temperature/i.test(detail) && /unsupported|not.support|only.*supported|not.allowed|不支持/i.test(detail)) {
          delete body.temperature;
          continue;
        }
        throw httpError(response.status, detail);
      }
      return rememberTranslation(cached.key, readTranslation(parsed, effectiveSettings), effectiveSettings);
    }
  } catch (error) {
    if (controller.signal.aborted) throw translationError(timedOut ? `API 请求超时（${timeoutMs / 1000} 秒）。请先测试短文本，检查端点、模型和网关记录；慢模型可在设置中调整超时。` : "翻译已取消。", timedOut ? "TIMEOUT" : "CANCELLED");
    if (error.code) throw error;
    throw translationError(`API 请求失败：${error.message}。请检查 API 地址、网络及域名访问权限。`, "NETWORK_ERROR");
  } finally {
    clearTimeout(timer);
  }
}

async function ensureContentScript(tabId) {
  try {
    await tabsSendMessage(tabId, { type: "PING" });
    return;
  } catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["src/content.js"] });
  }
}

async function forwardToActiveTab(message) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab || typeof tab.id !== "number") throw new Error("找不到当前标签页。");
  await ensureContentScript(tab.id);
  return tabsSendMessage(tab.id, message);
}

function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "translate-selection",
      title: "翻译选中文本",
      contexts: ["selection"]
    });
    chrome.contextMenus.create({
      id: "translate-immersive-page",
      title: "沉浸式翻译当前网页",
      contexts: ["page"]
    });
    chrome.contextMenus.create({
      id: "translate-document",
      title: "用 QudadFlow 打开 PDF / 文档对照阅读",
      contexts: ["page", "link"]
    });
  });
}

chrome.runtime.onInstalled.addListener(createContextMenu);
chrome.runtime.onStartup.addListener(createContextMenu);
chrome.storage.onChanged?.addListener((_changes, area) => { if (area === "local") clearTranslationCache(); });

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  try {
    if (info.menuItemId === "translate-document") {
      let fragment = "local=1";
      try {
        const url = new URL(info.linkUrl || info.pageUrl || tab.url);
        if (/^https?:$/.test(url.protocol) && !url.username && !url.password) fragment = `url=${encodeURIComponent(url.href)}`;
      } catch {}
      await chrome.tabs.create({ url: chrome.runtime.getURL(`reader.html#${fragment}`) });
      return;
    }
    await ensureContentScript(tab.id);
    if (info.menuItemId === "translate-selection") {
      await tabsSendMessage(tab.id, { type: "TRANSLATE_SELECTION", selectionText: info.selectionText || "" });
    } else if (info.menuItemId === "translate-immersive-page") {
      await tabsSendMessage(tab.id, { type: "TRANSLATE_IMMERSIVE" });
    }
  } catch (error) {
    console.warn("Unable to translate selection", error);
  }
});

// A reader tab owns its port and up to two requests. Disconnecting aborts only that reader.
chrome.runtime.onConnect?.addListener((port) => {
  if (port.name !== "qudadflow-document") return;
  if (port.sender?.id !== chrome.runtime.id || port.sender?.url?.split(/[?#]/)[0] !== chrome.runtime.getURL("reader.html")) {
    port.disconnect();
    return;
  }
  const requests = new Map();
  let disconnected = false;
  const post = message => { if (!disconnected) try { port.postMessage(message); } catch {} };
  port.onDisconnect.addListener(() => {
    disconnected = true;
    for (const controller of requests.values()) controller.abort();
    requests.clear();
  });
  port.onMessage.addListener(message => {
    const requestId = message?.requestId;
    if (message?.type === "PING") { post({ type: "PONG" }); return; }
    if (typeof requestId !== "string" || requestId.length > 80) return;
    if (message.type === "CANCEL") { requests.get(requestId)?.abort(); return; }
    if (message.type !== "TRANSLATE" || requests.has(requestId)) return;
    if (requests.size >= 2) {
      post({ type: "RESULT", requestId, ok: false, error: "已有两个文档翻译请求正在进行，请稍后重试。" });
      return;
    }
    const controller = new AbortController(), metadata = {}, started = Date.now();
    requests.set(requestId, controller);
    let lastProgress = 0;
    const progress = translation => {
      if (controller.signal.aborted || Date.now() - lastProgress < 150) return;
      lastProgress = Date.now();
      post({ type: "PROGRESS", requestId, translation });
    };
    (async () => {
      let result;
      try {
        const translation = await translateText(message, controller, progress, metadata);
        result = { ok: true, translation, cached: Boolean(metadata.cached) };
      } catch (error) { result = { ok: false, error: error.message, code: error.code || "TRANSLATION_FAILED" }; }
      finally { requests.delete(requestId); }
      post({ type: "RESULT", requestId, ...result, elapsedMs: Date.now() - started });
    })();
  });
});

chrome.commands.onCommand.addListener(async (command) => {
  if (!["translate-selection", "translate-immersive"].includes(command)) return;
  try {
    await forwardToActiveTab({ type: command === "translate-immersive" ? "TRANSLATE_IMMERSIVE" : "TRANSLATE_SELECTION" });
  } catch (error) {
    console.warn("Unable to translate selection", error);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type?.startsWith('PROFILE_')) {
    const ownPage=sender.id===chrome.runtime.id && ['options.html','popup.html'].some(page=>sender.url?.split(/[?#]/)[0]===chrome.runtime.getURL(page));
    if(!ownPage){sendResponse({ok:false,error:'仅扩展设置和弹窗可管理配置方案。'});return false;}
    queuedProfileAction(message).then(sendResponse).catch(error=>sendResponse({ok:false,error:error.message}));return true;
  }
  if (message?.type === "GET_SELECTION_ENABLED") {
    (async () => {
      if (!sender.tab?.url) return { enabled: false };
      const pattern = selectionPattern(sender.tab.url);
      const scripts = await chrome.scripting.getRegisteredContentScripts({ ids: [selectionScriptId(pattern)] });
      return { enabled: scripts.length > 0 && await permissionsContains([pattern]) };
    })().then(sendResponse).catch(() => sendResponse({ enabled: false }));
    return true;
  }
  const owner = `${sender.tab?.id ?? "extension"}:${sender.frameId ?? 0}`;
  const requestKey = `${owner}:${message?.requestId || ""}`;
  if (message?.type === "CANCEL_TRANSLATION") {
    activeRequests.get(requestKey)?.abort();
    sendResponse({ ok: true });
    return false;
  }
  if (message?.type !== "TRANSLATE_TEXT" && message?.type !== "TRANSLATE_TEST") return false;
  const request = message.type === "TRANSLATE_TEST"
    ? { text: "This is a connection test.", context: "API connection test", skipCache: true }
    : message;
  const controller = new AbortController();
  const started = Date.now();
  let lastProgress = 0;
  const metadata = {};
  if (message.requestId) activeRequests.set(requestKey, controller);
  const progress = (translation) => {
    if (!message.requestId || !sender.tab?.id || controller.signal.aborted || Date.now() - lastProgress < 150) return;
    lastProgress = Date.now();
    tabsSendMessage(sender.tab.id, { type: "TRANSLATION_PROGRESS", requestId: message.requestId, translation }).catch(() => {});
  };
  translateText(request, controller, progress, metadata)
    .then((translation) => sendResponse({ ok: true, translation, cached: Boolean(metadata.cached), elapsedMs: Date.now() - started }))
    .catch((error) => sendResponse({ ok: false, code: error.code || "TRANSLATION_FAILED", error: error.message, elapsedMs: Date.now() - started }))
    .finally(() => { if (activeRequests.get(requestKey) === controller) activeRequests.delete(requestKey); });
  return true;
});
