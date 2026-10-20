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

const MAX_INPUT_CHARS = 12000;
const REQUEST_TIMEOUT_MS = 45000;

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
  if (url.pathname.endsWith("/chat/completions")) return url.toString();
  if (url.pathname.endsWith("/v1") || url.pathname.endsWith("/v1/")) {
    url.pathname = `${url.pathname.replace(/\/$/, "")}/chat/completions`;
  } else {
    url.pathname = `${url.pathname.replace(/\/$/, "")}/v1/chat/completions`;
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
    candidates = [
      getByPath(response, "choices[0].message.content"),
      getByPath(response, "choices[0].text"),
      getByPath(response, "translation"),
      getByPath(response, "result")
    ];
  }
  const text = candidates.find((item) => typeof item === "string" && item.trim());
  if (!text) throw new Error("API 返回中没有找到翻译文本，请检查响应路径设置。");
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
    const temperature = Number(settings.temperature);
    body = {
      model: settings.model,
      temperature: Number.isFinite(temperature) ? Math.min(1, Math.max(0, temperature)) : 0.2,
      messages: [
        {
          role: "system",
          content: `You are a translation engine. Translate from ${settings.sourceLanguage || "auto-detected language"} to ${settings.targetLanguage}. Preserve meaning, line breaks, punctuation, URLs, placeholders, Markdown, and code. Return only the translation. Context: ${context || "web page"}.`
        },
        { role: "user", content: text }
      ]
    };
    if (settings.apiKey && !Object.keys(headers).some((key) => key.toLowerCase() === "authorization")) {
      headers.Authorization = `Bearer ${settings.apiKey}`;
    }
  }
  return { endpoint, headers, body };
}

async function translateText(request) {
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
  if (!effectiveSettings.apiKey && effectiveSettings.apiStyle !== "custom-json") throw new Error("请先在设置中填写 API Key。");

  const pattern = getOriginPattern(effectiveSettings.endpoint);
  if (!(await permissionsContains([pattern]))) {
    const error = new Error(`尚未允许访问 API 域名：${pattern}`);
    error.code = "PERMISSION_REQUIRED";
    throw error;
  }

  const { endpoint, headers, body } = buildRequest(effectiveSettings, text, request.context || "web page");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  let raw;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: typeof body === "string" ? body : JSON.stringify(body),
      signal: controller.signal
    });
    // The deadline also covers downloading the response body.
    raw = await response.text();
  } catch (error) {
    if (error.name === "AbortError") throw new Error("API 请求超时，请检查端点或网络。");
    throw new Error(`API 请求失败：${error.message}`);
  } finally {
    clearTimeout(timer);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { result: raw };
  }
  if (!response.ok) {
    const detail = typeof parsed?.error?.message === "string" ? parsed.error.message : raw.slice(0, 300);
    throw new Error(`API 返回 ${response.status}：${detail}`);
  }
  return readTranslation(parsed, effectiveSettings);
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
  });
}

chrome.runtime.onInstalled.addListener(createContextMenu);
chrome.runtime.onStartup.addListener(createContextMenu);

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  try {
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

chrome.commands.onCommand.addListener(async (command) => {
  if (!["translate-selection", "translate-immersive"].includes(command)) return;
  try {
    await forwardToActiveTab({ type: command === "translate-immersive" ? "TRANSLATE_IMMERSIVE" : "TRANSLATE_SELECTION" });
  } catch (error) {
    console.warn("Unable to translate selection", error);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "TRANSLATE_TEXT" && message?.type !== "TRANSLATE_TEST") return false;
  const request = message.type === "TRANSLATE_TEST"
    ? { text: "This is a connection test.", context: "API connection test" }
    : message;
  translateText(request)
    .then((translation) => sendResponse({ ok: true, translation }))
    .catch((error) => sendResponse({ ok: false, code: error.code || "TRANSLATION_FAILED", error: error.message }));
  return true;
});
