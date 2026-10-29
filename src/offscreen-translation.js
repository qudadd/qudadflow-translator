/* Translator is a Window API. Extension service workers cannot call it. */
(() => {
  const active = new Map();
  const availabilityPrefix = 'qfLocalTranslationAvailability:';
  const idleSessions = [];
  const SESSION_IDLE_MS = 30_000;

  function dispose(entry) {
    clearTimeout(entry.timer);
    entry.disposed = true;
    entry.lifetime.abort();
    if (entry.session && !entry.destroyed) {
      entry.destroyed = true;
      try { entry.session.destroy(); } catch {}
    }
  }

  function takeSession(pair) {
    const key = pair.sourceLanguage + ':' + pair.targetLanguage;
    const index = idleSessions.findIndex(entry => entry.key === key);
    if (index < 0) return null;
    const [entry] = idleSessions.splice(index, 1);
    clearTimeout(entry.timer);
    return entry;
  }

  function retain(entry) {
    idleSessions.push(entry);
    entry.timer = setTimeout(() => {
      const index = idleSessions.indexOf(entry);
      if (index >= 0) idleSessions.splice(index, 1);
      dispose(entry);
    }, SESSION_IDLE_MS);
    // Retain at most two idle instances. In-use instances are never shared,
    // so cancelling one paragraph cannot destroy another paragraph's model.
    while (idleSessions.length > 2) dispose(idleSessions.shift());
  }

  function cachedUnavailable(pair) {
    try {
      const value = JSON.parse(localStorage.getItem(availabilityPrefix + pair.sourceLanguage + ':' + pair.targetLanguage));
      return value?.status === 'unavailable' && value.expires > Date.now();
    } catch { return false; }
  }

  function recordAvailability(pair, status) {
    try {
      localStorage.setItem(availabilityPrefix + pair.sourceLanguage + ':' + pair.targetLanguage,
        JSON.stringify({ status, expires: Date.now() + (status === 'unavailable' ? 120_000 : 30_000) }));
    } catch { /* Translation still works if localStorage is unavailable. */ }
  }

  async function translate(message, controller) {
    const pair = message.pair;
    const chunks = message.chunks;
    if (!pair || !/^[a-z]{2,3}(?:-[A-Za-z]+)?$/.test(pair.sourceLanguage) ||
        !/^[a-z]{2,3}(?:-[A-Za-z]+)?$/.test(pair.targetLanguage) ||
        !Array.isArray(chunks) || chunks.length > 12000 ||
        chunks.some(chunk => !chunk || typeof chunk.text !== 'string' || typeof chunk.translate !== 'boolean') ||
        chunks.reduce((length, chunk) => length + chunk.text.length, 0) > 12000) return { status: 'unavailable' };
    const api = globalThis.Translator;
    if (!api?.availability || !api?.create) return { status: 'unavailable' };
    if (controller.signal.aborted) return { status: 'cancelled' };
    let entry = takeSession(pair);
    if (!entry) {
      if (cachedUnavailable(pair)) return { status: 'unavailable' };
      let status;
      try { status = await api.availability(pair); }
      catch { return { status: 'unavailable' }; }
      recordAvailability(pair, status);
      // A model download requires a user gesture in a visible page. Never wait here.
      if (status !== 'available') return { status: status || 'unavailable' };
      entry = {key: pair.sourceLanguage + ':' + pair.targetLanguage, lifetime: new AbortController()};
    }
    let reusable = false;
    const destroySession = () => dispose(entry);
    controller.signal.addEventListener('abort', destroySession, { once: true });
    try {
      if (controller.signal.aborted) return { status: 'cancelled' };
      // Creation's signal controls the instance lifetime. A completed request's
      // signal must not stay attached to a model later borrowed by a new request.
      if (!entry.session) entry.session = await api.create({ ...pair, signal: entry.lifetime.signal });
      try {
        let result = '';
        for (const chunk of chunks) {
          if (controller.signal.aborted) return { status: 'cancelled' };
          if (!chunk.translate) { result += chunk.text; continue; }
          const source = chunk.text.trim();
          const translated = await entry.session.translate(source, { signal: controller.signal });
          if (typeof translated !== 'string' || !translated.trim()) return { status: 'unavailable' };
          result += (chunk.text.match(/^\s*/)?.[0] || '') + translated + (chunk.text.match(/\s*$/)?.[0] || '');
          chrome.runtime.sendMessage({ type: 'QF_BROWSER_TRANSLATOR_PROGRESS', requestId: message.requestId, translation: result }).catch(() => {});
        }
        if (controller.signal.aborted) return { status: 'cancelled' };
        reusable = true;
        return { status: 'ok', translation: result.trim() };
      } finally { controller.signal.removeEventListener('abort', destroySession); }
    } catch { return { status: controller.signal.aborted ? 'cancelled' : 'unavailable' }; }
    finally {
      controller.signal.removeEventListener('abort', destroySession);
      if (reusable && !entry.disposed) retain(entry); else destroySession();
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.target !== 'QF_BROWSER_TRANSLATOR') return false;
    if (sender.id !== chrome.runtime.id || sender.tab) { sendResponse({ status: 'unavailable' }); return false; }
    if (message.action === 'cancel') {
      active.get(message.requestId)?.abort();
      sendResponse({ status: 'cancelled' });
      return false;
    }
    if (message.action === 'probe') {
      sendResponse({ status: 'ok', hasTranslator: Boolean(globalThis.Translator?.availability), userActivation: Boolean(navigator.userActivation?.isActive) });
      return false;
    }
    if (message.action !== 'translate' || typeof message.requestId !== 'string' || message.requestId.length > 80 || active.has(message.requestId)) {
      sendResponse({ status: 'unavailable' });
      return false;
    }
    const controller = new AbortController();
    active.set(message.requestId, controller);
    translate(message, controller).then(sendResponse).catch(() => sendResponse({ status: 'unavailable' }))
      .finally(() => active.delete(message.requestId));
    return true;
  });
})();
