/* Default key-free translation: ready browser model first, then MyMemory. */
const MACHINE_FALLBACK_ENDPOINT = 'https://api.mymemory.translated.net/get';
const MACHINE_MARKER = /^__(?:EDGE_WT|QF_DOC)_\d+__$/;
const BROWSER_TRANSLATION_DOCUMENT = 'offscreen-translation.html';
const pendingBrowserModelRequests = new Map();
let creatingBrowserTranslationDocument;
let browserModelRetryAfter = 0;

function machineLanguageTag(language) {
  if (/^zh-(tw|hk|hant)$/i.test(language)) return 'zh-Hant';
  if (/^zh(?:-|$)/i.test(language)) return 'zh';
  return String(language || '').split('-')[0].toLowerCase();
}

async function machineSourceLanguage(text, configured) {
  if (configured && configured !== 'auto') return configured;
  const sample = text.replace(/__(?:EDGE_WT|QF_DOC)_\d+__/g, ' ').slice(0, 2500);
  if (chrome.i18n?.detectLanguage) {
    try {
      const result = await chrome.i18n.detectLanguage(sample);
      const first = result.languages?.[0];
      if (first && first.language !== 'und' && (result.isReliable || first.percentage >= 55)) return first.language;
    } catch { /* Use the script fallback below. */ }
  }
  if (/[\u3040-\u30ff]/u.test(sample)) return 'ja';
  if (/[\uac00-\ud7af]/u.test(sample)) return 'ko';
  if (/[\u4e00-\u9fff]/u.test(sample)) return 'zh-CN';
  if (/[\u0400-\u04ff]/u.test(sample)) return 'ru';
  return 'en';
}

function browserModelChunks(text) {
  const chunks = [];
  for (const part of text.split(/(__(?:EDGE_WT|QF_DOC)_\d+__|\n+)/).filter(Boolean)) {
    if (MACHINE_MARKER.test(part) || !part.trim()) chunks.push({ text: part, translate: false });
    else for (const chunk of myMemoryChunks(part, 1200)) chunks.push({ text: chunk, translate: Boolean(chunk.trim()) });
  }
  return chunks;
}

async function ensureBrowserTranslationDocument() {
  if (!chrome.offscreen?.createDocument || !chrome.runtime?.getContexts) return false;
  const documentUrl = chrome.runtime.getURL(BROWSER_TRANSLATION_DOCUMENT);
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [documentUrl] });
  if (contexts.length) return true;
  if (!creatingBrowserTranslationDocument) {
    creatingBrowserTranslationDocument = chrome.offscreen.createDocument({
      url: BROWSER_TRANSLATION_DOCUMENT,
      reasons: ['LOCAL_STORAGE'],
      justification: 'Use the browser Translator API in a window and cache language-pair availability locally for fast fallback.'
    }).finally(() => { creatingBrowserTranslationDocument = undefined; });
  }
  await creatingBrowserTranslationDocument;
  return true;
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== 'QF_BROWSER_TRANSLATOR_PROGRESS') return;
  if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL(BROWSER_TRANSLATION_DOCUMENT)) return;
  const onProgress = pendingBrowserModelRequests.get(message.requestId);
  if (onProgress && typeof message.translation === 'string') onProgress(message.translation);
});

async function requestBrowserTranslator(chunks, pair, controller, onProgress) {
  if (Date.now() < browserModelRetryAfter) return null;
  try {
    if (!(await ensureBrowserTranslationDocument())) return null;
  } catch {
    browserModelRetryAfter = Date.now() + 30_000;
    return null;
  }
  if (controller.signal.aborted) throw translationError('翻译已取消。', 'CANCELLED');
  const requestId = crypto.randomUUID();
  const abort = () => { chrome.runtime.sendMessage({ target: 'QF_BROWSER_TRANSLATOR', action: 'cancel', requestId }).catch(() => {}); };
  pendingBrowserModelRequests.set(requestId, onProgress);
  controller.signal.addEventListener('abort', abort, { once: true });
  try {
    const result = await chrome.runtime.sendMessage({ target: 'QF_BROWSER_TRANSLATOR', action: 'translate', requestId, pair, chunks });
    if (controller.signal.aborted) throw translationError('翻译已取消。', 'CANCELLED');
    if (result?.status === 'ok' && typeof result.translation === 'string' && result.translation.trim()) return result.translation;
    if (result?.status === 'unavailable') browserModelRetryAfter = Date.now() + 120_000;
    return null;
  } catch {
    if (controller.signal.aborted) throw translationError('翻译已取消。', 'CANCELLED');
    browserModelRetryAfter = Date.now() + 30_000;
    return null;
  } finally {
    controller.signal.removeEventListener('abort', abort);
    pendingBrowserModelRequests.delete(requestId);
  }
}

async function translateWithBrowserModel(text, source, target, controller, onProgress) {
  const pair = { sourceLanguage: machineLanguageTag(source), targetLanguage: machineLanguageTag(target) };
  return globalThis.requestBrowserTranslator(browserModelChunks(text), pair, controller, onProgress);
}

async function translateAutomaticMachine(settings, text, controller, onProgress, cacheAllowed = true) {
  const source = await machineSourceLanguage(text, settings.sourceLanguage);
  if (machineLanguageTag(source) === machineLanguageTag(settings.targetLanguage)) return text;
  const local = await translateWithBrowserModel(text, source, settings.targetLanguage, controller, onProgress);
  if (local !== null) return local;
  if (controller.signal.aborted) throw translationError('翻译已取消。', 'CANCELLED');
  if (!(await permissionsContains(['https://api.mymemory.translated.net/*']))) {
    throw translationError('尚未允许访问 MyMemory 翻译服务，请在扩展设置中检查权限。', 'PERMISSION_REQUIRED');
  }
  return translateMyMemory({ ...settings, endpoint: MACHINE_FALLBACK_ENDPOINT, sourceLanguage: source }, text, controller, onProgress, { cacheSettings: settings, cacheAllowed });
}
