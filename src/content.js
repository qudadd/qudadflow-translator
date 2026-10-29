/* global chrome */

if (!globalThis.__edgeWebTranslatorLoaded) {
  globalThis.__edgeWebTranslatorLoaded = true;

  (() => {
    const MAX_PAGE_CHARS = 12000;
    const CHUNK_CHARS = 1800;
    const IMMERSIVE_BATCH_CHARS = 1800;
    const IMMERSIVE_BATCH_BLOCKS = 8;
    const MAX_CONCURRENT_REQUESTS = 2;
    const MAX_MARKER_FALLBACK_BLOCKS = 8;
    const IMMERSIVE_BLOCK_SELECTOR = "p,li,h1,h2,h3,h4,h5,h6,blockquote,figcaption,td,th,pre,summary,dt,dd,div,article,section,main,aside";
    const EXCLUDED_SELECTOR = "#edge-web-translator-host,#edge-wt-selection-host,[data-edge-wt-ignore],[data-edge-wt-immersive-translation],script,style,noscript,template,textarea,input,select,button,svg,canvas,[contenteditable]:not([contenteditable='false']),[translate='no'],.notranslate";
    let host;
    let shadow;
    const immersiveStyles = new Map();
    let immersiveColor = '', immersiveColorRevision = 0;
    const immersiveWrappers = new Set();
    let immersiveRecords = [];
    let immersiveSession;
    let immersiveRunId = 0;
    let panelRunId = 0;
    let requestSequence = 0;
    let progressText = "";
    let progressStarted = 0;
    let progressTimer;
    let selectionEnabled = false;
    let selectionSettingChanged = false;
    let selectionHost;
    let selectionShadow;
    let selectionSnapshot;
    let selectionGeneration = 0;
    let selectionTimer;
    let selectionDebounce;
    let selectionPositionFrame;
    let selectionBusy = false;
    let activeRequestCount = 0;
    const waitingRequests = [];
    const pendingRequests = new Map();
    const pendingCommands = new Map();

    function stopProgress() {
      clearInterval(progressTimer);
      progressTimer = undefined;
    }

    function cancelRequests(scope = "panel") {
      if (scope === "panel") { stopImmersiveWatch(); stopProgress(); discardPendingImmersive(); }
      const requests = Array.from(pendingRequests.values()).filter((request) => request.scope === scope);
      requests.forEach((request) => { request.cancelled = true; });
      requests.forEach((request) => request.cancel());
    }

    function processRequestQueue() {
      while (activeRequestCount < MAX_CONCURRENT_REQUESTS && waitingRequests.length) {
        const request = waitingRequests.shift();
        if (!request.cancelled) request.start();
      }
    }

    function startProgress(text) {
      stopProgress();
      progressText = text;
      progressStarted = Date.now();
      const render = () => {
        if (!shadow) return stopProgress();
        const seconds = Math.floor((Date.now() - progressStarted) / 1000);
        shadow.querySelector(".status").textContent = `${progressText} 已等待 ${seconds} 秒。`;
      };
      render();
      progressTimer = setInterval(render, 1000);
    }

    async function mapConcurrent(items, translate, isCurrent) {
      const output = new Array(items.length);
      let next = 0;
      let failure;
      await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT_REQUESTS, items.length) }, async () => {
        while (!failure && isCurrent()) {
          const index = next++;
          if (index >= items.length) return;
          try { output[index] = await translate(items[index], index); }
          catch (error) {
            if (!failure) {
              failure = error;
              if (isCurrent()) cancelRequests();
            }
          }
        }
      }));
      if (failure) throw failure;
      if (!isCurrent()) throw Object.assign(new Error("翻译已取消。"), { code: "CANCELLED" });
      return output;
    }

    function beginPanelRun() {
      hideSelectionBubble(true);
      cancelRequests();
      immersiveRunId += 1;
      return ++panelRunId;
    }

    function ensurePanel() {
      if (host && shadow) return shadow;
      host = document.createElement("div");
      host.id = "edge-web-translator-host";
      host.style.all = "initial";
      document.documentElement.appendChild(host);
      shadow = host.attachShadow({ mode: "open" });
      shadow.innerHTML = `
        <style>
          :host { all: initial; }
          .panel { position: fixed; z-index: 2147483647; top: 24px; right: 24px; width: min(560px, calc(100vw - 48px)); max-height: calc(100vh - 48px); display: flex; flex-direction: column; overflow: hidden; color: #172033; background: #fff; border: 1px solid #d9e1ef; border-radius: 14px; box-shadow: 0 18px 55px rgba(17, 31, 62, .25); font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
          .head { display:flex; align-items:center; gap:10px; padding:14px 16px; border-bottom:1px solid #edf0f6; background: linear-gradient(135deg, #f7f9ff, #fff); }
          .title { flex:1; font-weight:700; font-size:15px; }
          button { border:0; background:transparent; color:#52627a; cursor:pointer; border-radius:7px; padding:5px 8px; }
          button:hover { background:#edf2ff; color:#315bc7; }
          .body { overflow:auto; padding:16px; }
          .label { margin:0 0 6px; color:#66748b; font-size:12px; font-weight:600; }
          .box { white-space:pre-wrap; overflow-wrap:anywhere; padding:11px 12px; margin:0 0 14px; background:#f7f9fc; border:1px solid #e7ebf2; border-radius:9px; }
          .translation { background:#f0f5ff; border-color:#d8e4ff; }
          .actions { display:flex; justify-content:flex-end; gap:8px; }
          .primary { background:#315bc7; color:#fff; padding:7px 11px; }
          .primary:hover { background:#254aa8; color:#fff; }
          .restore { display:none; }
          .status { margin:0 0 12px; color:#66748b; }
          .error { color:#b42318; background:#fff3f1; border-color:#ffd8d3; }
          .panel.compact { top:auto; bottom:16px; right:16px; width:min(340px, calc(100vw - 32px)); max-height:35vh; border-radius:12px; }
          .compact .head { padding:9px 12px; }
          .compact .body { padding:10px 12px; }
          .compact .source { margin:0 0 5px; padding:0; border:0; background:none; font-size:12px; }
          .compact .status { margin:0 0 4px; font-size:12px; }
          .compact .label, .compact .translation, .compact .actions, .compact .copy { display:none; }
        </style>
        <section class="panel" role="dialog" aria-label="QudadFlow Translator">
          <header class="head"><strong class="title">QudadFlow Translator</strong><button class="restore" title="恢复网页原文">恢复原文</button><button class="copy" title="复制译文">复制</button><button class="close" title="关闭">×</button></header>
          <div class="body"><p class="status"></p><p class="label">原文</p><div class="box source"></div><p class="label">译文</p><div class="box translation"></div><div class="actions"><button class="primary copy-bottom">复制译文</button></div></div>
        </section>`;
      const close = () => {
        beginPanelRun();
        host.remove();
        host = undefined;
        shadow = undefined;
      };
      shadow.querySelector(".close").addEventListener("click", close);
      shadow.querySelector(".restore").addEventListener("click", () => {
        const count = restoreImmersive();
        showPanel({ title: "沉浸式翻译", status: count ? `已恢复 ${count} 个网页段落。` : "当前页面没有沉浸式译文。" });
      });
      const copy = async () => {
        const root = shadow;
        const value = root.querySelector(".translation").textContent;
        if (!value) return;
        const status = root.querySelector(".status");
        try {
          await navigator.clipboard.writeText(value);
          status.textContent = "译文已复制。";
          setTimeout(() => { if (status.textContent === "译文已复制。") status.textContent = ""; }, 1800);
        } catch {
          status.textContent = "复制失败，请选中译文后手动复制。";
        }
      };
      shadow.querySelector(".copy").addEventListener("click", copy);
      shadow.querySelector(".copy-bottom").addEventListener("click", copy);
      return shadow;
    }

    function showPanel({ title, source = "", translation = "", status = "", showRestore = false, compact = false }) {
      const root = ensurePanel();
      root.querySelector(".panel").classList.toggle("compact", compact);
      root.querySelector(".title").textContent = title || "QudadFlow Translator";
      root.querySelector(".source").textContent = source;
      root.querySelector(".translation").textContent = translation;
      root.querySelector(".status").textContent = status;
      root.querySelector(".restore").style.display = showRestore ? "inline-block" : "none";
      root.querySelector(".translation").classList.toggle("error", !translation && status.startsWith("翻译失败"));
    }

    function setStatus(status) {
      const root = ensurePanel();
      progressText = status;
      root.querySelector(".status").textContent = status;
    }

    function runtimeMessage(message, onProgress, scope = "panel") {
      const requestId = `${Date.now()}-${++requestSequence}`;
      return new Promise((resolve) => {
        let finished = false;
        const request = { onProgress, scope, started: false, cancelled: false };
        const cancelled = { ok: false, code: "CANCELLED", error: "翻译已取消。" };
        const finish = (response) => {
          if (finished) return;
          finished = true;
          pendingRequests.delete(requestId);
          if (request.started) activeRequestCount -= 1;
          const runtimeError = chrome.runtime.lastError;
          if (request.cancelled) resolve(cancelled);
          else if (runtimeError) resolve({ ok: false, error: runtimeError.message });
          else resolve(response || { ok: false, error: "扩展没有返回结果。" });
          processRequestQueue();
        };
        request.start = () => {
          request.started = true;
          activeRequestCount += 1;
          try { chrome.runtime.sendMessage({ ...message, requestId }, finish); }
          catch (error) { finish({ ok: false, error: `${error.message}。请刷新网页后重试。` }); }
        };
        request.cancel = () => {
          if (!request.started) return finish(cancelled);
          try { chrome.runtime.sendMessage({ type: "CANCEL_TRANSLATION", requestId }, () => void chrome.runtime.lastError); }
          catch { finish(cancelled); }
        };
        pendingRequests.set(requestId, request);
        // A selected phrase gets the next free slot ahead of queued page batches.
        if (scope === "selection") waitingRequests.unshift(request);
        else waitingRequests.push(request);
        processRequestQueue();
      });
    }

    async function requestTranslation(text, targetLanguage, context, onProgress) {
      const response = await runtimeMessage({ type: "TRANSLATE_TEXT", text, targetLanguage, context }, onProgress);
      if (!response?.ok) throw Object.assign(new Error(response?.error || "扩展没有返回翻译结果。"), { code: response?.code || "TRANSLATION_FAILED" });
      return response.translation;
    }

    function splitText(text, maxChars) {
      const normalized = text.replace(/\r\n/g, "\n").trim();
      if (normalized.length <= maxChars) return [normalized];
      const paragraphs = normalized.split(/\n{2,}/);
      const chunks = [];
      let current = "";
      for (const paragraph of paragraphs) {
        if (!paragraph) continue;
        if (current && current.length + paragraph.length + 2 > maxChars) {
          chunks.push(current);
          current = "";
        }
        if (paragraph.length > maxChars) {
          for (let i = 0; i < paragraph.length; i += maxChars) chunks.push(paragraph.slice(i, i + maxChars));
        } else {
          current = current ? `${current}\n\n${paragraph}` : paragraph;
        }
      }
      if (current) chunks.push(current);
      return chunks;
    }

    function selectionText() {
      return window.getSelection()?.toString().trim() || "";
    }

    function hideSelectionBubble(cancel = false) {
      if (cancel) cancelRequests("selection");
      selectionBusy = false;
      selectionGeneration += 1;
      clearInterval(selectionTimer);
      if (selectionHost) selectionHost.style.display = "none";
    }

    function positionSelectionBubble() {
      if (!selectionHost || selectionHost.style.display === "none" || !selectionSnapshot) return;
      const range = selectionSnapshot.range;
      if (!range.startContainer.isConnected) return hideSelectionBubble(true);
      const rects = Array.from(range.getClientRects());
      const rect = rects.filter((item) => item.width && item.height && item.bottom > 0 && item.top < innerHeight && item.right > 0 && item.left < innerWidth).at(-1);
      const bubble = selectionShadow.querySelector(".bubble");
      bubble.style.visibility = rect ? "visible" : "hidden";
      if (!rect) return;
      const size = bubble.getBoundingClientRect();
      const left = Math.max(8, Math.min(rect.left, innerWidth - size.width - 8));
      const below = rect.bottom + 8;
      const top = below + size.height <= innerHeight - 8 ? below : Math.max(8, rect.top - size.height - 8);
      bubble.style.left = `${left}px`;
      bubble.style.top = `${Math.min(top, Math.max(8, innerHeight - size.height - 8))}px`;
    }

    function scheduleSelectionPosition() {
      if (!selectionHost || selectionHost.style.display !== "block" || selectionPositionFrame) return;
      selectionPositionFrame = requestAnimationFrame(() => { selectionPositionFrame = undefined; positionSelectionBubble(); });
    }

    function ensureSelectionBubble() {
      if (selectionHost) return;
      selectionHost = document.createElement("div");
      selectionHost.id = "edge-wt-selection-host";
      selectionHost.style.all = "initial";
      document.documentElement.appendChild(selectionHost);
      selectionShadow = selectionHost.attachShadow({ mode: "open" });
      selectionShadow.innerHTML = `
        <style>
          :host { all:initial; }
          * { box-sizing:border-box; }
          .bubble { position:fixed; z-index:2147483647; width:max-content; max-width:calc(100vw - 16px); max-height:calc(100vh - 16px); overflow:auto; color:#172033; background:#fff; border:1px solid #d8e1f0; border-radius:12px; box-shadow:0 8px 30px #15264a26; font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; text-align:start; }
          .toolbar { display:flex; align-items:center; gap:6px; padding:5px; }
          button { border:0; border-radius:8px; padding:6px 10px; color:#52627a; background:transparent; cursor:pointer; font:inherit; white-space:nowrap; }
          button:hover { background:#edf2ff; }
          .translate { color:#fff; background:#315bc7; }
          .translate:hover { background:#254aa8; }
          .brand { display:none; flex:1; padding-left:6px; font-size:11px; font-weight:600; }
          .copy { display:none; }
          .content { display:none; width:360px; max-width:calc(100vw - 16px); padding:0 12px 12px; }
          .status { margin:2px 0 6px; color:#66748b; font-size:12px; overflow-wrap:anywhere; }
          .result { max-height:min(240px, 45vh); overflow:auto; white-space:pre-wrap; overflow-wrap:anywhere; user-select:text; }
          .expanded .content { display:block; }
          .expanded .brand { display:block; }
          .expanded .translate { display:none; }
          .expanded .copy { display:block; }
          .failed .status { color:#b42318; }
          .failed .translate { display:block; }
          @media(prefers-color-scheme:dark) { .bubble { color:#eef3ff; background:#182235; border-color:#34435d; } button { color:#bccbe5; } button:hover { background:#2a3c5b; } .status { color:#a3b4d0; } .failed .status { color:#ffaaa1; } }
        </style>
        <section class="bubble" aria-label="划词翻译"><div class="toolbar"><span class="brand">QudadFlow Translator</span><button class="translate" title="仅在点击后发送选中文字">翻译</button><button class="copy" title="复制译文">复制</button><button class="close" title="关闭（Esc）" aria-label="关闭划词翻译">×</button></div><div class="content"><p class="status" role="status"></p><div class="result"></div></div></section>`;
      selectionShadow.querySelectorAll("button").forEach((button) => button.addEventListener("pointerdown", (event) => event.preventDefault()));
      selectionShadow.querySelector(".close").addEventListener("click", () => hideSelectionBubble(true));
      selectionShadow.querySelector(".translate").addEventListener("click", translateSelectionBubble);
      selectionShadow.querySelector(".copy").addEventListener("click", async () => {
        const value = selectionShadow.querySelector(".result").textContent;
        if (!value) return;
        try { await navigator.clipboard.writeText(value); selectionShadow.querySelector(".status").textContent = "译文已复制。"; }
        catch { selectionShadow.querySelector(".status").textContent = "复制失败，请选中译文后手动复制。"; }
      });
    }

    function captureSelection() {
      if (!selectionEnabled) return;
      const selected = window.getSelection();
      if (!selected?.rangeCount || selected.isCollapsed) {
        // Clicking/copying inside a result can collapse the document selection.
        if (selectionHost?.style.display === "block" && selectionShadow.querySelector(".expanded")) return;
        return hideSelectionBubble(true);
      }
      const range = selected.getRangeAt(0);
      const start = range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer : range.startContainer.parentElement;
      const end = range.endContainer.nodeType === Node.ELEMENT_NODE ? range.endContainer : range.endContainer.parentElement;
      if (start?.getRootNode() === selectionShadow || end?.getRootNode() === selectionShadow) return;
      if (!start || !end || start.closest(EXCLUDED_SELECTOR) || end.closest(EXCLUDED_SELECTOR)) return hideSelectionBubble(true);
      const ancestor = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
      if (Array.from(ancestor.querySelectorAll(EXCLUDED_SELECTOR)).some((element) => range.intersectsNode(element))) return hideSelectionBubble(true);
      const text = selected.toString().trim();
      if (text.length < 2 || text.length > MAX_PAGE_CHARS || !/[\p{L}\p{N}]/u.test(text)) return hideSelectionBubble(true);
      if (selectionSnapshot?.text === text && selectionHost?.style.display !== "none") { selectionSnapshot.range = range.cloneRange(); return positionSelectionBubble(); }
      hideSelectionBubble(true);
      selectionSnapshot = { text, range: range.cloneRange() };
      ensureSelectionBubble();
      selectionHost.style.display = "block";
      selectionShadow.querySelector(".bubble").className = "bubble";
      selectionShadow.querySelector(".translate").textContent = "翻译";
      selectionShadow.querySelector(".translate").disabled = false;
      selectionShadow.querySelector(".result").textContent = "";
      positionSelectionBubble();
    }

    async function translateSelectionBubble() {
      if (!selectionSnapshot || selectionBusy) return;
      const generation = selectionGeneration;
      selectionBusy = true;
      selectionShadow.querySelector(".translate").disabled = true;
      const bubble = selectionShadow.querySelector(".bubble");
      bubble.className = "bubble expanded";
      const status = selectionShadow.querySelector(".status");
      const result = selectionShadow.querySelector(".result");
      result.textContent = "";
      const started = Date.now();
      const isCurrent = () => generation === selectionGeneration;
      const elapsed = () => { if (isCurrent()) status.textContent = `正在翻译… ${Math.floor((Date.now() - started) / 1000)} 秒`; };
      elapsed();
      selectionTimer = setInterval(elapsed, 1000);
      positionSelectionBubble();
      const response = await runtimeMessage({ type: "TRANSLATE_TEXT", text: selectionSnapshot.text, context: "selected text" }, (partial) => {
        if (isCurrent()) { result.textContent = partial; positionSelectionBubble(); }
      }, "selection");
      if (!isCurrent()) return;
      clearInterval(selectionTimer);
      selectionBusy = false;
      selectionShadow.querySelector(".translate").disabled = false;
      if (response?.ok) {
        result.textContent = response.translation;
        status.textContent = response.cached ? "已复用近期译文" : `完成 · ${((Date.now() - started) / 1000).toFixed(1)} 秒`;
      } else {
        result.textContent = "";
        status.textContent = `${response?.error || "翻译失败。"}${response?.code ? ` [${response.code}]` : ""}`;
        bubble.classList.add("failed");
        selectionShadow.querySelector(".translate").textContent = "重试";
      }
      positionSelectionBubble();
    }

    document.addEventListener("selectionchange", () => {
      clearTimeout(selectionDebounce);
      selectionDebounce = setTimeout(captureSelection, 150);
    });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") hideSelectionBubble(true); });
    document.addEventListener("pointerdown", (event) => {
      if (event.target === selectionHost) return;
      if (selectionHost && selectionHost.style.display !== "none") hideSelectionBubble(true);
    }, true);
    window.addEventListener("scroll", scheduleSelectionPosition, true);
    window.addEventListener("resize", scheduleSelectionPosition);
    try {
      chrome.runtime.sendMessage({ type: "GET_SELECTION_ENABLED" }, (response) => {
        if (!chrome.runtime.lastError && !selectionSettingChanged) selectionEnabled = Boolean(response?.enabled);
      });
    } catch { /* The page can outlive an extension update. */ }

    function isCssVisible(element) {
      for (let current = element; current; current = current.parentElement) {
        const style = getComputedStyle(current);
        if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || Number(style.opacity) === 0 || style.contentVisibility === "hidden") return false;
      }
      return true;
    }

    function collectVisibleText(body, maxChars = MAX_PAGE_CHARS) {
      const pieces = [];
      let length = 0;
      const append = (value) => {
        const piece = value.slice(0, Math.max(0, maxChars + 1 - length));
        pieces.push(piece);
        length += piece.length;
      };
      const visit = (element) => {
        if (length > maxChars || element.matches(EXCLUDED_SELECTOR) || !isCssVisible(element)) return;
        if (element.tagName === "BR") { append("\n"); return; }
        const display = getComputedStyle(element).display;
        const block = !["inline", "inline-block", "contents"].includes(display);
        if (block && length) append("\n\n");
        for (const child of element.childNodes) {
          if (length > maxChars) break;
          if (child.nodeType === Node.TEXT_NODE) append(child.textContent);
          else if (child.nodeType === Node.ELEMENT_NODE) visit(child);
        }
        if (block) append("\n\n");
      };
      if (body) visit(body);
      return pieces.join("").replace(/[\t ]*\n[\t ]*/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    }

    function composedParent(element) {
      return element.parentElement || element.getRootNode()?.host || null;
    }

    function excludedFromImmersive(element) {
      for (let current = element; current; current = composedParent(current)) {
        if (current.matches(EXCLUDED_SELECTOR)) return true;
      }
      return false;
    }

    function originalStillMatches(record) {
      if (!record.nodes.every((node, index) => node.isConnected && node.textContent === record.originals[index])) return false;
      for (const node of record.nodes) {
        for (let element = node.parentElement || node.getRootNode()?.host; element; element = composedParent(element)) {
          if (element.matches(EXCLUDED_SELECTOR) || !isCssVisible(element)) return false;
        }
      }
      let doc = record.element.ownerDocument;
      while (doc !== document) {
        try {
          const frame = doc.defaultView?.frameElement;
          if (!frame?.isConnected || frame.contentDocument !== doc || excludedFromImmersive(frame) || !isCssVisible(frame)) return false;
          doc = frame.ownerDocument;
        } catch { return false; }
      }
      return true;
    }

    function unwrapImmersive(record) {
      const wrapper = record.flowWrapper;
      if (wrapper?.parentNode) { while (wrapper.firstChild) wrapper.before(wrapper.firstChild); wrapper.remove(); }
      immersiveWrappers.delete(wrapper);
      record.flowWrapper = undefined;
    }

    async function collectImmersiveBlocks(session) {
      const records = [];
      const body = document.body || document.documentElement;
      const styles = new WeakMap();
      const visible = new WeakMap();
      const owners = new WeakMap();
      const validity = new WeakMap();
      const shadowHostOf = (node) => node.parentNode?.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? node.parentNode.host : null;
      session.roots = new Set([document]);
      const pushChildren = (node) => { for (let index = node.childNodes.length - 1; index >= 0; index -= 1) stack.push(node.childNodes[index]); };
      const styleOf = (element) => {
        if (!styles.has(element)) styles.set(element, element.ownerDocument.defaultView.getComputedStyle(element));
        return styles.get(element);
      };
      const visibleElement = (element) => {
        if (!element) return true;
        if (!visible.has(element)) {
          const style = styleOf(element);
          visible.set(element, style.display !== "none" && style.visibility !== "hidden" && style.visibility !== "collapse" && Number(style.opacity) !== 0 && style.contentVisibility !== "hidden" && visibleElement(composedParent(element)));
        }
        return visible.get(element);
      };
      if (!body || excludedFromImmersive(body) || !visibleElement(body)) return [];
      const ownerOf = (element) => {
        if (!element) return null;
        if (owners.has(element)) return owners.get(element);
        const display = styleOf(element).display;
        const parent = element.parentElement;
        const layoutItem = parent && /flex|grid/.test(styleOf(parent).display);
        const owner = display !== "contents" && (element.matches(IMMERSIVE_BLOCK_SELECTOR) || element === body || layoutItem || shadowHostOf(element) || /flex|grid/.test(display) || ["block", "inline-block", "list-item"].includes(display)) ? element
            : ownerOf(element.parentElement);
        owners.set(element, owner);
        return owner;
      };
      let current;
      const stack = [body];
      let scanned = 0;
      while (stack.length) {
        if (++scanned % 1200 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
          if (!session.isCurrent()) return [];
        }
        const node = stack.pop();
        if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
          current = undefined;
          session.roots.add(node);
          pushChildren(node);
          continue;
        }
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (!visibleElement(node) || node.matches(EXCLUDED_SELECTOR)) {
            if (!["inline", "inline-block", "contents"].includes(styleOf(node).display)) current = undefined;
            continue;
          }
          if (node.tagName === "BR" && current) current.source += "\n";
          else if (!["inline", "inline-block", "contents"].includes(styleOf(node).display) || /flex|grid/.test(styleOf(node.parentElement || node).display)) current = undefined;
          pushChildren(node);
          if (node.shadowRoot) stack.push(node.shadowRoot);
          if (node.tagName === "IFRAME") {
            // Only same-origin frames already readable by the top page. No extra site access.
            try {
              const frameDocument = node.contentDocument;
              if (frameDocument?.body) { session.roots.add(frameDocument); stack.push(frameDocument.body); }
            } catch { /* Protected / cross-origin frames remain with their original text. */ }
          }
          continue;
        }
        if (node.nodeType !== Node.TEXT_NODE) continue;
        const previous = session.seen.get(node);
        if (previous && !validity.has(previous.record)) validity.set(previous.record, originalStillMatches(previous.record));
        if (previous && previous.original === node.textContent && validity.get(previous.record)) { current = undefined; continue; }
        const element = ownerOf(node.parentElement) || shadowHostOf(node);
        if (!element) { current = undefined; continue; }
        if (!node.textContent.trim() && (!current || current.element !== element)) continue;
        const directLayout = node.parentElement === element && /flex|grid/.test(styleOf(element).display);
        if (!current || current.element !== element || directLayout && current.lastNode.nextSibling !== node) {
          current = { element, source: "", nodes: [], originals: [], lastNode: node, directLayout };
          records.push(current);
        }
        const style = styleOf(node.parentElement || element);
        current.source += style.whiteSpace.startsWith("pre") ? node.textContent : node.textContent.replace(/\s+/g, " ");
        current.nodes.push(node);
        current.originals.push(node.textContent);
        current.lastNode = node;
      }
      const eligible = records.filter((record) => {
        record.source = record.source.replace(/[^\S\n]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
        if (!/[\p{L}]/u.test(record.source.replace(/https?:\/\/\S+|\b\S+@\S+\.\S+/g, ""))) return false;
        const range = record.lastNode.ownerDocument.createRange();
        if (!record.nodes.some((node) => { range.selectNodeContents(node); return Array.from(range.getClientRects()).some((rect) => rect.width > 0 && rect.height > 0); })) return false;
        record.distance = viewportDistance(record);
        return true;
      });
      eligible.forEach((record, index) => { record.order = index; });
      return eligible;
    }

    function viewportDistance(record) {
      // Text geometry avoids treating every block in a tall owner as visible.
      const range = record.element.ownerDocument.createRange();
      range.setStart(record.nodes[0], 0);
      range.setEnd(record.lastNode, record.lastNode.length);
      const rect = range.getBoundingClientRect();
      let top = rect.top, bottom = rect.bottom, left = rect.left, right = rect.right;
      let view = record.element.ownerDocument.defaultView, distance = 0;
      const outside = () => Math.max(0, -bottom, top - view.innerHeight, -right, left - view.innerWidth);
      while (view && view !== window) {
        distance = Math.max(distance, outside());
        const frame = view.frameElement;
        if (!frame) break;
        const offset = frame.getBoundingClientRect();
        top += offset.top + frame.clientTop; bottom += offset.top + frame.clientTop;
        left += offset.left + frame.clientLeft; right += offset.left + frame.clientLeft;
        view = frame.ownerDocument.defaultView;
      }
      return Math.max(distance, outside());
    }

    function immersiveStyleText() {
      return `
        [data-edge-wt-immersive-translation="1"] { all:initial !important; display:block !important; position:static !important; float:none !important; box-sizing:border-box !important; width:auto !important; min-width:0 !important; max-width:100% !important; margin:.4em 0 0 !important; padding:0 !important; color:${immersiveColor || '#315bc7'} !important; font:inherit !important; line-height:1.6 !important; text-align:inherit !important; writing-mode:inherit !important; text-indent:0 !important; text-transform:none !important; white-space:pre-wrap !important; overflow-wrap:anywhere !important; }
        @media (prefers-color-scheme:dark) { [data-edge-wt-immersive-translation="1"] { color:${immersiveColor || '#9abaff'} !important; } }
        [data-edge-wt-pending="1"] { opacity:.7 !important; }
      `;
    }
    function setImmersiveColor(value) {
      immersiveColor = typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : '';
      for (const style of immersiveStyles.values()) style.textContent = immersiveStyleText();
    }
    function ensureImmersiveStyle(root = document) {
      if (immersiveStyles.get(root)?.isConnected) return;
      const style = (root.ownerDocument || root).createElement("style");
      style.dataset.edgeWtIgnore = "1";
      style.textContent = immersiveStyleText();
      (root.head || root.documentElement || root).appendChild(style);
      immersiveStyles.set(root, style);
    }

    function restoreImmersive() {
      hideSelectionBubble(true);
      cancelRequests();
      immersiveRunId += 1;
      panelRunId += 1;
      const nodes = immersiveRecords.map((record) => record.translationElement).filter((node) => node?.isConnected);
      const count = nodes.length;
      nodes.forEach((node) => node.remove());
      immersiveRecords.forEach((record) => delete record.element.dataset.edgeWtImmersive);
      for (const record of immersiveRecords) unwrapImmersive(record);
      immersiveWrappers.clear();
      immersiveRecords = [];
      for (const style of immersiveStyles.values()) style.remove();
      immersiveStyles.clear();
      return count;
    }

    function nextImmersiveBatch(session) {
      const pending = [];
      for (const record of session.pending) {
        if (!originalStillMatches(record)) { session.pending.delete(record); continue; }
        record.distance = viewportDistance(record);
        pending.push(record);
      }
      pending.sort((a, b) => a.distance - b.distance || (a.lastDispatch || 0) - (b.lastDispatch || 0) || a.order - b.order);
      const batch = [];
      let length = 0;
      for (const record of pending) {
        if (batch.length && (record.forceSingle || record.parts || (record.distance === 0) !== (batch[0].distance === 0))) break;
        const pieceLength = record.source.length + record.marker.length + 3;
        if (batch.length && (length + pieceLength > IMMERSIVE_BATCH_CHARS || batch.length >= IMMERSIVE_BATCH_BLOCKS)) break;
        batch.push(record); session.pending.delete(record);
        record.lastDispatch = ++session.dispatchSequence;
        length += pieceLength;
        if (record.forceSingle || record.parts || record.source.length > CHUNK_CHARS) break;
      }
      return batch;
    }

    function parseImmersiveBatch(text, records) {
      const output = [];
      for (let index = 0; index < records.length; index += 1) {
        const marker = records[index].marker;
        const start = text.indexOf(marker);
        if (start < 0) return null;
        const contentStart = start + marker.length;
        const nextMarker = index + 1 < records.length ? text.indexOf(records[index + 1].marker, contentStart) : text.length;
        if (nextMarker < 0) return null;
        const translation = text.slice(contentStart, nextMarker).replace(/^[\s:：-]+|[\s]+$/g, "").trim();
        if (!translation) return null;
        output.push(translation);
      }
      return output;
    }

    function renderImmersiveProgress(text, records) {
      let cursor = 0;
      for (let index = 0; index < records.length; index += 1) {
        const start = text.indexOf(records[index].marker, cursor);
        if (start < 0) return;
        const contentStart = start + records[index].marker.length;
        const nextMarker = records[index + 1]?.marker;
        const end = nextMarker ? text.indexOf(nextMarker, contentStart) : -1;
        let translation = text.slice(contentStart, end >= 0 ? end : text.length);
        if (end < 0 && nextMarker) {
          for (let length = nextMarker.length - 1; length > 0; length -= 1) {
            if (translation.endsWith(nextMarker.slice(0, length))) { translation = translation.slice(0, -length); break; }
          }
        }
        translation = translation.replace(/^[\s:：-]+|\s+$/g, "");
        if (translation) insertImmersiveTranslation(records[index], translation, true);
        if (end < 0) return;
        cursor = end;
      }
    }

    function discardPendingImmersive(records = immersiveRecords) {
      for (const record of records) {
        if (record.translationElement?.dataset.edgeWtPending !== "1") continue;
        record.translationElement.remove();
        record.translationElement = undefined;
        unwrapImmersive(record);
        if (!record.element.querySelector('[data-edge-wt-immersive-translation="1"]')) delete record.element.dataset.edgeWtImmersive;
      }
    }

    function insertImmersiveTranslation(record, translation, pending = false) {
      let element = record.element;
      if (!element?.isConnected || !originalStillMatches(record)) return false;
      if (record.directLayout) {
        // Replace the anonymous flex/grid text item with a single flow item, so
        // its translation cannot become an extra column. Original Text nodes survive.
        if (!record.flowWrapper?.isConnected) {
          const wrapper = element.ownerDocument.createElement("span");
          wrapper.dataset.edgeWtFlowWrapper = "1";
          wrapper.style.cssText = "display:block;min-width:0;max-width:100%;text-align:inherit;font:inherit;color:inherit";
          if (getComputedStyle(element).display.includes("flex")) {
            const range = element.ownerDocument.createRange();
            range.setStartBefore(record.nodes[0]); range.setEndAfter(record.lastNode);
            wrapper.style.flexBasis = `${range.getBoundingClientRect().width}px`;
          }
          record.nodes[0].before(wrapper);
          record.nodes.forEach((original) => wrapper.appendChild(original));
          record.flowWrapper = wrapper;
          immersiveWrappers.add(wrapper);
        }
        element = record.flowWrapper;
      }
      ensureImmersiveStyle(record.lastNode.getRootNode());
      const node = record.translationElement?.isConnected ? record.translationElement : element.ownerDocument.createElement("span");
      node.dataset.edgeWtImmersiveTranslation = "1";
      if (pending) node.dataset.edgeWtPending = "1";
      else delete node.dataset.edgeWtPending;
      node.setAttribute("lang", record.targetLanguage || "");
      node.setAttribute("translate", "no");
      node.setAttribute("dir", "auto");
      node.textContent = translation;
      element.dataset.edgeWtImmersive = "1";
      // Stop before the next original child. Direct text before/after nested blocks is paired separately.
      if (!node.isConnected) {
        let anchor = record.lastNode;
        const inlineFlow = (sibling) => {
          if (sibling.nodeType !== Node.ELEMENT_NODE) return true;
          if (!["inline", "inline-block", "contents", "none"].includes(getComputedStyle(sibling).display)) return false;
          return !Array.from(sibling.querySelectorAll(IMMERSIVE_BLOCK_SELECTOR)).some((child) => !["inline", "inline-block", "contents", "none"].includes(getComputedStyle(child).display));
        };
        while (anchor.parentElement !== element && anchor.parentElement) {
          let sibling = anchor.nextSibling;
          while (sibling && inlineFlow(sibling)) sibling = sibling.nextSibling;
          if (sibling) break;
          anchor = anchor.parentElement;
        }
        while (anchor.nextSibling && inlineFlow(anchor.nextSibling)) anchor = anchor.nextSibling;
        anchor.after(node);
      }
      record.translationElement = node;
      scheduleSelectionPosition();
      return true;
    }

    function targetScriptDecision(text, targetLanguage) {
      const target = targetLanguage.toLowerCase();
      const language = target.split("-")[0];
      const cleaned = text.replace(/https?:\/\/\S+|\b\S+@\S+\.\S+/g, "");
      const letters = cleaned.match(/\p{L}/gu) || [];
      if (!letters.length) return true;
      const han = (cleaned.match(/\p{Script=Han}/gu) || []).length;
      const kana = (cleaned.match(/[\p{Script=Hiragana}\p{Script=Katakana}]/gu) || []).length;
      const hangul = (cleaned.match(/\p{Script=Hangul}/gu) || []).length;
      // A complete foreign clause must still be translated, even inside a Chinese paragraph.
      const latinClause = /(?:\p{Script=Latin}+[\s,;:'’"()\-]+){5}\p{Script=Latin}+/u.test(cleaned);
      if (language === "zh") {
        if (!han || kana || hangul || latinClause || han / letters.length < .5) return false;
        const traditional = /[這個們為來時學習體書語說話國對與會後發現關開門問長東車馬無點讓還過種樣從處實應將數據讀頁圖論譯簡萬專業]/u;
        const simplified = /[这个们为来时学习体书语说话国对与会后发现关开门问长东车马无点让还过种样从处实应将数据读页图论译简万专业]/u;
        if (/\b(?:tw|hk|mo|hant)\b/.test(target)) return simplified.test(cleaned) ? false : true;
        if (/\b(?:cn|sg|hans)\b/.test(target)) return traditional.test(cleaned) ? false : true;
        return true;
      }
      if (language === "ja") return kana && !hangul && (han + kana) / letters.length >= .75 && !latinClause ? true : han || kana ? null : false;
      if (language === "ko") return hangul && hangul / letters.length >= .75 && !latinClause ? true : false;
      if (["en", "fr", "de", "es", "pt", "it", "nl"].includes(language) && (han || kana || hangul || letters.filter((letter) => !/\p{Script=Latin}/u.test(letter)).length > letters.length * .1)) return false;
      return null;
    }

    async function alreadyTargetLanguage(record, session) {
      const script = targetScriptDecision(record.source, session.targetLanguage);
      if (script !== null) return script;
      if (!chrome.i18n?.detectLanguage) return false;
      const text = record.source;
      const sample = text.length <= 6000 ? text : text.slice(0, 2000) + "\n" + text.slice(Math.floor(text.length / 2), Math.floor(text.length / 2) + 2000) + "\n" + text.slice(-2000);
      if (!session.languages.has(sample)) {
        const detected = new Promise((resolve) => {
          let finished = false;
          const finish = (result) => { if (!finished) { finished = true; clearTimeout(timer); resolve(result); } };
          const timer = setTimeout(() => finish(null), 500);
          try { chrome.i18n.detectLanguage(sample, (result) => { const error = chrome.runtime.lastError; finish(error ? null : result); }); }
          catch { finish(null); }
        });
        session.languages.set(sample, detected);
        session.languageChars += sample.length;
        while (session.languages.size > 128 || session.languageChars > 128000) {
          const oldest = session.languages.keys().next().value;
          session.languageChars -= oldest.length;
          session.languages.delete(oldest);
        }
      }
      const detected = await session.languages.get(sample);
      const languages = detected?.languages || [];
      const best = languages.slice().sort((a, b) => b.percentage - a.percentage)[0];
      return Boolean(best && best.language.toLowerCase().split("-")[0] === session.targetLanguage.toLowerCase().split("-")[0] && best.percentage >= 90 && (detected.isReliable || best.percentage >= 99 && (text.match(/\p{L}/gu) || []).length >= 4));
    }

    function stopImmersiveWatch() {
      const session = immersiveSession;
      if (!session) return;
      clearTimeout(session.timer);
      for (const wake of session.waiters) wake();
      session.waiters.clear();
      for (const observer of session.observers.values()) observer.disconnect();
      for (const view of session.views) {
        view.removeEventListener("scroll", session.onScroll, true);
        view.removeEventListener("resize", session.onScroll);
        view.removeEventListener("pagehide", session.onPageHide);
        view.removeEventListener("load", session.onLoad, true);
      }
      immersiveSession = undefined;
    }

    function scheduleImmersiveScan(session) {
      if (!session.isCurrent()) return;
      if (location.href.split("#")[0] !== session.url) {
        beginPanelRun();
        if (shadow) setStatus("页面已切换，已停止沉浸式翻译。请在新页面重新开启。");
        return;
      }
      session.dirty = true;
      if (session.timer) return;
      session.timer = setTimeout(async () => {
        session.timer = undefined;
        if (!session.isCurrent()) return;
        if (session.busy) { for (const wake of session.waiters) wake(); session.waiters.clear(); return; }
        await processImmersive(session);
      }, 250);
    }

    function watchImmersiveRoots(session) {
      const internal = (node) => {
        for (let element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement; element; element = composedParent(element)) {
          if (element.matches("#edge-web-translator-host,#edge-wt-selection-host,[data-edge-wt-ignore],[data-edge-wt-immersive-translation],script,style,noscript,template")) return true;
        }
        return false;
      };
      for (const root of session.roots) {
        if (!session.observers.has(root)) {
          const observer = new MutationObserver((mutations) => {
            if (mutations.some((mutation) => (mutation.type === "attributes" && mutation.attributeName === "data-edge-wt-ignore" || !internal(mutation.target)) && (mutation.type !== "childList" || [...mutation.addedNodes, ...mutation.removedNodes].some((node) => !internal(node))))) scheduleImmersiveScan(session);
          });
          observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class", "style", "hidden", "open", "lang", "translate", "contenteditable", "data-edge-wt-ignore"] });
          session.observers.set(root, observer);
        }
        const view = (root.ownerDocument || root).defaultView;
        if (view && !session.views.has(view)) {
          view.addEventListener("scroll", session.onScroll, true);
          view.addEventListener("resize", session.onScroll);
          view.addEventListener("pagehide", session.onPageHide);
          view.addEventListener("load", session.onLoad, true);
          session.views.add(view);
        }
      }
      for (const [root, observer] of session.observers) if (!session.roots.has(root)) {
        observer.disconnect(); session.observers.delete(root);
        immersiveStyles.get(root)?.remove(); immersiveStyles.delete(root);
      }
      const currentViews = new Set(Array.from(session.roots, (root) => (root.ownerDocument || root).defaultView));
      for (const view of session.views) if (!currentViews.has(view)) {
        view.removeEventListener("scroll", session.onScroll, true); view.removeEventListener("resize", session.onScroll);
        view.removeEventListener("pagehide", session.onPageHide); view.removeEventListener("load", session.onLoad, true); session.views.delete(view);
      }
    }

    function pruneImmersive(session) {
      immersiveRecords = immersiveRecords.filter((record) => {
        if (originalStillMatches(record)) return true;
        record.translationElement?.remove();
        if (record.completed) session.translatedCount -= 1;
        if (record.skipped) session.skippedCount -= 1;
        record.nodes.forEach((node) => { if (session.seen.get(node)?.record === record) session.seen.delete(node); });
        unwrapImmersive(record);
        if (!record.element.querySelector('[data-edge-wt-immersive-translation="1"]')) delete record.element.dataset.edgeWtImmersive;
        return false;
      });
    }

    async function refreshImmersiveRecords(session) {
      if (session.scanPromise) return session.scanPromise;
      session.scanPromise = (async () => {
        session.dirty = false;
        const isCurrent = session.isCurrent;
        pruneImmersive(session);
        const records = await collectImmersiveBlocks(session);
        if (!isCurrent()) throw Object.assign(new Error("翻译已取消。"), { code: "CANCELLED" });
        watchImmersiveRoots(session);
        let next = 0;
        await Promise.all(Array.from({ length: Math.min(8, records.length) }, async () => {
          while (next < records.length && isCurrent()) {
            const record = records[next++];
            record.skipped = await alreadyTargetLanguage(record, session);
          }
        }));
        if (!isCurrent()) throw Object.assign(new Error("翻译已取消。"), { code: "CANCELLED" });
        for (const record of records) {
          record.targetLanguage = session.targetLanguage;
          record.order = session.recordSequence++;
          record.marker = `__EDGE_WT_${record.order}__`;
          record.nodes.forEach((node, index) => session.seen.set(node, { original: record.originals[index], record }));
          if (record.skipped) session.skippedCount += 1;
          else session.pending.add(record);
          immersiveRecords.push(record);
        }
      })();
      try { await session.scanPromise; }
      finally { session.scanPromise = undefined; }
    }

    async function processImmersive(session) {
      session.busy = true;
      const isCurrent = session.isCurrent;
      try {
        await refreshImmersiveRecords(session);
        return await translateImmersiveRecords(session);
      } catch (error) {
        if (session.runId === immersiveRunId && error.code !== "CANCELLED") {
          cancelRequests();
          showPanel({ title: "沉浸式翻译", source: `已显示 ${session.translatedCount} 个译文段落。`, status: `翻译失败：${error.message}`, showRestore: true, compact: true });
        }
        return { ok: false, code: error.code || "TRANSLATION_FAILED", error: error.message };
      } finally {
        session.busy = false;
        if (isCurrent()) {
          stopProgress();
          if (session.dirty) scheduleImmersiveScan(session);
        }
      }
    }

    async function translateImmersiveRecords(session) {
      const targetLanguage = session.targetLanguage;
      const isCurrent = session.isCurrent;
      if (session.pending.size) {
        showPanel({ title: "沉浸式翻译", source: `待翻译 ${session.pending.size} 段，随滚动优先翻译当前视区。已跳过 ${session.skippedCount} 个目标语言段落。`, status: "正在翻译…", showRestore: true, compact: true });
        let failure;
        const status = () => {
          progressText = `正在翻译，已显示 ${session.translatedCount} 个段落，待发送 ${session.pending.size} 段…`;
          setStatus(progressText);
        };
        const complete = (record, translation) => {
          if (!isCurrent()) return;
          if (insertImmersiveTranslation(record, translation) && !record.completed) { record.completed = true; session.translatedCount += 1; }
        };
        startProgress(`正在翻译，已显示 ${session.translatedCount} 个段落…`);
        const translateBatch = async (batch) => {
          let translations;
          if (batch.length === 1) {
            const record = batch[0];
            record.parts ||= splitText(record.source, CHUNK_CHARS);
            record.translatedParts ||= [];
            const part = record.parts[record.translatedParts.length];
            const translated = await requestTranslation(part, targetLanguage, "immersive web translation; return only the translation", (partial) => {
              if (isCurrent()) insertImmersiveTranslation(record, [...record.translatedParts, partial].join("\n\n"), true);
            });
            if (!isCurrent()) return;
            record.translatedParts.push(translated);
            if (record.translatedParts.length < record.parts.length) {
              insertImmersiveTranslation(record, record.translatedParts.join("\n\n"), true);
              // Yield after each chunk. A long paragraph cannot monopolize a worker.
              if (originalStillMatches(record)) session.pending.add(record);
              return;
            }
            translations = [record.translatedParts.join("\n\n")];
            delete record.parts; delete record.translatedParts;
          } else {
            const payload = batch.map((record) => `${record.marker}\n${record.source}`).join("\n\n");
            const response = await requestTranslation(payload, targetLanguage, "immersive web translation; preserve every __EDGE_WT_N__ marker exactly and return only the marked translations", (partial) => {
              if (isCurrent()) renderImmersiveProgress(partial, batch);
            });
            if (!isCurrent()) return;
            translations = parseImmersiveBatch(response, batch);
            if (!translations) {
              discardPendingImmersive(batch);
              session.fallbackBlocks += batch.length;
              if (session.fallbackBlocks > MAX_MARKER_FALLBACK_BLOCKS) throw Object.assign(new Error("模型多次未保留段落标记，已停止额外重试。请更换模型或使用网页译文面板。"), { code: "MARKER_MISMATCH" });
              for (const record of batch) {
                record.forceSingle = true;
                if (originalStillMatches(record)) session.pending.add(record);
              }
              return;
            }
          }
          if (!isCurrent()) return;
          translations.forEach((translation, index) => complete(batch[index], translation));
        };
        await Promise.all(Array.from({length:MAX_CONCURRENT_REQUESTS}, async () => {
          while (!failure && isCurrent()) {
            try {
              if (session.dirty || session.scanPromise) await refreshImmersiveRecords(session);
              if (failure || !isCurrent()) return;
              // Form batches only when a slot is free, using the current text positions.
              // Scrolling never aborts a request already sent to the API.
              const batch = nextImmersiveBatch(session);
              if (!batch.length) {
                if (!session.inFlight) return;
                await new Promise(resolve => session.waiters.add(resolve));
                continue;
              }
              session.inFlight += 1;
              try { await translateBatch(batch); }
              finally {
                session.inFlight -= 1;
                for (const wake of session.waiters) wake(); session.waiters.clear();
              }
              if (isCurrent()) status();
            } catch (error) {
              if (!failure) { failure = error; if (isCurrent()) cancelRequests(); }
            }
          }
        }));
        if (failure) throw failure;
      }
      if (!isCurrent()) throw Object.assign(new Error("翻译已取消。"), { code: "CANCELLED" });
      showPanel({ title: "沉浸式翻译", source: `已显示 ${session.translatedCount} 个译文段落，已跳过 ${session.skippedCount} 个目标语言段落。`, status: "滚动或展开内容后自动补译。关闭浮窗停止补译；恢复原文可移除译文。", showRestore: true, compact: true });
      return { ok: true, translatedCount: session.translatedCount, skippedCount: session.skippedCount };
    }

    async function translateImmersive(targetLanguage) {
      restoreImmersive();
      const runId = ++immersiveRunId;
      panelRunId += 1;
      showPanel({ title: "沉浸式翻译", status: "正在读取网页并在本地识别目标语言…", showRestore: true, compact: true });
      const colorRevision = immersiveColorRevision;
      const preferences = await chrome.storage.local.get({ targetLanguage: "zh-CN", immersiveTranslationColor: '' });
      targetLanguage ||= preferences.targetLanguage || "zh-CN";
      if (colorRevision === immersiveColorRevision) setImmersiveColor(preferences.immersiveTranslationColor);
      if (runId !== immersiveRunId) return { ok: false, code: "CANCELLED", error: "翻译已取消。" };
      const session = { runId, targetLanguage, url: location.href.split("#")[0], roots: new Set([document]), observers: new Map(), views: new Set(), seen: new WeakMap(), languages: new Map(), pending:new Set(), waiters:new Set(), inFlight:0, recordSequence:0, dispatchSequence:0, languageChars: 0, translatedCount: 0, skippedCount: 0, fallbackBlocks: 0 };
      session.isCurrent = () => runId === immersiveRunId && immersiveSession === session;
      session.onScroll = () => scheduleImmersiveScan(session);
      session.onLoad = (event) => { if (event.target?.tagName === "IFRAME") scheduleImmersiveScan(session); };
      session.onPageHide = (event) => { if (event.target === document && session.isCurrent()) { cancelRequests(); immersiveRunId += 1; } else scheduleImmersiveScan(session); };
      immersiveSession = session;
      return processImmersive(session);
    }

    async function translateSelection(targetLanguage, providedText = "") {
      const runId = beginPanelRun();
      const source = String(providedText || "").trim() || selectionText();
      if (!source) {
        showPanel({ title: "翻译选中文本", status: "请先在网页中选择文本。" });
        return { ok: false, error: "请先选择文本。" };
      }
      showPanel({ title: "翻译选中文本", source, status: "正在请求翻译 API…" });
      startProgress("正在请求翻译 API…");
      const result = await runtimeMessage({ type: "TRANSLATE_TEXT", text: source, targetLanguage, context: "selected text" }, (translation) => {
        if (runId === panelRunId && shadow) shadow.querySelector(".translation").textContent = translation;
      });
      if (runId !== panelRunId) return { ok: false, error: "翻译已取消。" };
      stopProgress();
      if (!result?.ok) {
        showPanel({ title: "翻译选中文本", source, status: `翻译失败：${result?.error || "未知错误"}` });
        return result;
      }
      showPanel({ title: "翻译选中文本", source, translation: result.translation });
      return result;
    }

    async function translatePage(targetLanguage) {
      const runId = beginPanelRun();
      const collected = collectVisibleText(document.body || document.documentElement);
      const notice = collected.length > MAX_PAGE_CHARS ? `本次仅翻译前 ${MAX_PAGE_CHARS} 个字符。` : "";
      const source = collected.slice(0, MAX_PAGE_CHARS);
      if (!source) {
        showPanel({ title: "翻译当前网页", status: "当前页面没有可翻译的文本。" });
        return { ok: false, error: "当前页面没有可翻译的文本。" };
      }
      const chunks = splitText(source, CHUNK_CHARS);
      showPanel({ title: "翻译当前网页", source, status: `${notice}正在翻译第 1/${chunks.length} 段…` });
      const translated = [];
      const isCurrent = () => runId === panelRunId;
      let completed = 0;
      startProgress(`${notice}正在翻译，已完成 0/${chunks.length} 段…`);
      const render = () => { if (isCurrent() && shadow) shadow.querySelector(".translation").textContent = translated.filter(Boolean).join("\n\n"); };
      try {
        await mapConcurrent(chunks, async (chunk, index) => {
          const translation = await requestTranslation(chunk, targetLanguage, "web page", (partial) => {
            if (isCurrent()) { translated[index] = partial; render(); }
          });
          if (!isCurrent()) return;
          translated[index] = translation;
          completed += 1;
          render();
          setStatus(`${notice}正在翻译，已完成 ${completed}/${chunks.length} 段…`);
        }, isCurrent);
      } catch (error) {
        if (isCurrent()) showPanel({ title: "翻译当前网页", source, translation: translated.filter(Boolean).join("\n\n"), status: `翻译失败：${error.message}` });
        return { ok: false, code: error.code, error: error.message };
      } finally {
        if (isCurrent()) stopProgress();
      }
      showPanel({ title: "翻译当前网页", source, translation: translated.join("\n\n"), status: notice });
      return { ok: true, translation: translated.join("\n\n") };
    }

    chrome.storage?.onChanged?.addListener((changes,area)=>{
      if(area!=='local')return;
      if('immersiveTranslationColor' in changes){immersiveColorRevision+=1;setImmersiveColor(changes.immersiveTranslationColor.newValue);}
      const fields=['apiStyle','chatgptAccount','endpoint','apiKey','mymemoryEmail','model','providerRegion','sourceLanguage','targetLanguage','temperature','streamOpenAi','customHeaders','requestTemplate','responsePath'];
      if(!fields.some(key=>key in changes))return;
      const running=pendingRequests.size>0||Boolean(immersiveSession);
      if(!running)return;
      if(selectionBusy)hideSelectionBubble(true);
      cancelRequests();immersiveRunId+=1;panelRunId+=1;
      if(running&&shadow)setStatus('翻译配置已更改，当前任务已停止。已完成的译文保留；可重新发起翻译。');
    });

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === "TRANSLATION_PROGRESS") {
        const request = pendingRequests.get(message.requestId);
        if (request && !request.cancelled) request.onProgress?.(message.translation);
        sendResponse({ ok: true });
        return false;
      }
      if (message?.type === "PING") {
        sendResponse({ ok: true });
        return false;
      }
      if (message?.type === "GET_SELECTION") {
        sendResponse({ ok: true, selection: selectionText() });
        return false;
      }
      if (message?.type === "SET_SELECTION_ENABLED") {
        selectionSettingChanged = true;
        selectionEnabled = Boolean(message.enabled);
        if (!selectionEnabled) hideSelectionBubble(true);
        sendResponse({ ok: true });
        return false;
      }
      if (["TRANSLATE_SELECTION", "TRANSLATE_PAGE", "TRANSLATE_IMMERSIVE"].includes(message?.type)) {
        const key = JSON.stringify([message.type, message.targetLanguage, message.selectionText || selectionText()]);
        if (!pendingCommands.has(key)) {
          const task = (message.type === "TRANSLATE_SELECTION" ? translateSelection(message.targetLanguage, message.selectionText)
            : message.type === "TRANSLATE_PAGE" ? translatePage(message.targetLanguage) : translateImmersive(message.targetLanguage))
            .catch((error) => ({ ok: false, code: error.code || "TRANSLATION_FAILED", error: error.message }))
            .finally(() => pendingCommands.delete(key));
          pendingCommands.set(key, task);
        }
        pendingCommands.get(key).then(sendResponse);
        return true;
      }
      if (message?.type === "RESTORE_IMMERSIVE") {
        const count = restoreImmersive();
        sendResponse({ ok: true, count });
        return false;
      }
      return false;
    });
  })();
}
