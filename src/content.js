/* global chrome */

if (!globalThis.__edgeWebTranslatorLoaded) {
  globalThis.__edgeWebTranslatorLoaded = true;

  (() => {
    const MAX_PAGE_CHARS = 12000;
    const CHUNK_CHARS = 2600;
    const MAX_IMMERSIVE_BLOCKS = 80;
    const IMMERSIVE_BATCH_CHARS = 5000;
    const IMMERSIVE_BLOCK_SELECTOR = "p,li,h1,h2,h3,h4,h5,h6,blockquote,figcaption,td,th,pre,summary,dt,dd,div";
    const IMMERSIVE_NESTED_SELECTOR = `${IMMERSIVE_BLOCK_SELECTOR},ul,ol,table,article,section,nav,main,form`;
    const EXCLUDED_SELECTOR = "#edge-web-translator-host,[data-edge-wt-ignore],[data-edge-wt-immersive-translation],script,style,noscript,template,textarea,input,select,button,[contenteditable]:not([contenteditable='false']),[translate='no'],.notranslate";
    let host;
    let shadow;
    let immersiveStyle;
    let immersiveRecords = [];
    let immersiveRunId = 0;
    let panelRunId = 0;

    function beginPanelRun() {
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

    function showPanel({ title, source = "", translation = "", status = "", showRestore = false }) {
      const root = ensurePanel();
      root.querySelector(".title").textContent = title || "QudadFlow Translator";
      root.querySelector(".source").textContent = source;
      root.querySelector(".translation").textContent = translation;
      root.querySelector(".status").textContent = status;
      root.querySelector(".restore").style.display = showRestore ? "inline-block" : "none";
      root.querySelector(".translation").classList.toggle("error", !translation && status.startsWith("翻译失败"));
    }

    function setStatus(status) {
      const root = ensurePanel();
      root.querySelector(".status").textContent = status;
    }

    function runtimeMessage(message) {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) resolve({ ok: false, error: chrome.runtime.lastError.message });
          else resolve(response || { ok: false, error: "扩展没有返回结果。" });
        });
      });
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

    function isCssVisible(element) {
      for (let current = element; current; current = current.parentElement) {
        const style = getComputedStyle(current);
        if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || Number(style.opacity) === 0 || style.contentVisibility === "hidden") return false;
      }
      return true;
    }

    function isVisibleImmersiveElement(element) {
      if (element.dataset.edgeWtImmersive === "1") return false;
      if (element.closest(EXCLUDED_SELECTOR) || !isCssVisible(element)) return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
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

    function collectImmersiveBlocks() {
      const records = [];
      for (const element of document.querySelectorAll(IMMERSIVE_BLOCK_SELECTOR)) {
        if (records.length >= MAX_IMMERSIVE_BLOCKS) break;
        if (!isVisibleImmersiveElement(element)) continue;
        if (element.querySelector(IMMERSIVE_NESTED_SELECTOR)) continue;
        if (element.matches("script,style,noscript,template,textarea,input,select,button,[contenteditable='true']")) continue;
        const source = collectVisibleText(element, Number.MAX_SAFE_INTEGER).replace(/\s+/g, " ").trim();
        if (source.length < 3) continue;
        if (!/[\p{L}\p{N}]/u.test(source)) continue;
        records.push({ element, source });
      }
      return records;
    }

    function ensureImmersiveStyle() {
      if (immersiveStyle) return;
      immersiveStyle = document.createElement("style");
      immersiveStyle.dataset.edgeWtIgnore = "1";
      immersiveStyle.textContent = `
        [data-edge-wt-immersive-translation="1"] { display:block !important; margin: .35em 0 .7em !important; padding: .35em .6em !important; color: #315bc7 !important; background: rgba(240,245,255,.78) !important; border-left: 3px solid #6e8fe0 !important; border-radius: 4px !important; white-space: pre-wrap !important; font: inherit !important; line-height: 1.6 !important; }
      `;
      (document.head || document.documentElement).appendChild(immersiveStyle);
    }

    function restoreImmersive() {
      immersiveRunId += 1;
      panelRunId += 1;
      const nodes = document.querySelectorAll('[data-edge-wt-immersive-translation="1"]');
      const count = nodes.length;
      nodes.forEach((node) => node.remove());
      document.querySelectorAll('[data-edge-wt-immersive="1"]').forEach((element) => delete element.dataset.edgeWtImmersive);
      immersiveRecords = [];
      if (immersiveStyle) {
        immersiveStyle.remove();
        immersiveStyle = undefined;
      }
      return count;
    }

    function createImmersiveBatches(records) {
      const batches = [];
      let current = [];
      let length = 0;
      records.forEach((record, index) => {
        record.marker = `__EDGE_WT_${index}__`;
        const pieceLength = record.source.length + record.marker.length + 3;
        if (current.length && length + pieceLength > IMMERSIVE_BATCH_CHARS) {
          batches.push(current);
          current = [];
          length = 0;
        }
        current.push(record);
        length += pieceLength;
      });
      if (current.length) batches.push(current);
      return batches;
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

    function insertImmersiveTranslation(record, translation) {
      const element = record.element;
      if (!element || !element.isConnected) return;
      const node = document.createElement("span");
      node.dataset.edgeWtImmersiveTranslation = "1";
      node.textContent = translation;
      element.dataset.edgeWtImmersive = "1";
      element.appendChild(node);
      record.translationElement = node;
    }

    async function translateImmersive(targetLanguage) {
      restoreImmersive();
      const runId = ++immersiveRunId;
      panelRunId += 1;
      const records = collectImmersiveBlocks();
      if (!records.length) {
        showPanel({ title: "沉浸式翻译", status: "没有找到可翻译的正文段落。" });
        return { ok: false, error: "没有找到可翻译的正文段落。" };
      }
      immersiveRecords = records;
      ensureImmersiveStyle();
      const batches = createImmersiveBatches(records);
      showPanel({ title: "沉浸式翻译", source: `已找到 ${records.length} 个正文段落。`, status: `正在翻译第 1/${batches.length} 批…`, showRestore: true });
      let translatedCount = 0;
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
        if (runId !== immersiveRunId) return { ok: false, error: "沉浸式翻译已取消。" };
        const batch = batches[batchIndex];
        // Long paragraphs are translated in bounded pieces, then inserted once.
        if (batch.length === 1 && batch[0].source.length > CHUNK_CHARS) {
          const parts = splitText(batch[0].source, CHUNK_CHARS);
          const translated = [];
          for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
            setStatus(`正在翻译第 ${batchIndex + 1}/${batches.length} 批，第 ${partIndex + 1}/${parts.length} 段…`);
            const single = await runtimeMessage({ type: "TRANSLATE_TEXT", text: parts[partIndex], targetLanguage, context: "immersive web translation; return only the translation" });
            if (runId !== immersiveRunId) return { ok: false, error: "沉浸式翻译已取消。" };
            if (!single?.ok) {
              showPanel({ title: "沉浸式翻译", status: `翻译失败：${single?.error || "未知错误"}`, showRestore: true });
              return single;
            }
            translated.push(single.translation);
          }
          insertImmersiveTranslation(batch[0], translated.join("\n\n"));
          translatedCount += 1;
          continue;
        }
        const payload = batch.map((record) => `${record.marker}\n${record.source}`).join("\n\n");
        setStatus(`正在翻译第 ${batchIndex + 1}/${batches.length} 批…`);
        const response = await runtimeMessage({
          type: "TRANSLATE_TEXT",
          text: payload,
          targetLanguage,
          context: "immersive web translation; preserve every __EDGE_WT_N__ marker exactly and return only the marked translations"
        });
        if (runId !== immersiveRunId) return { ok: false, error: "沉浸式翻译已取消。" };
        if (!response?.ok) {
          showPanel({ title: "沉浸式翻译", source: `已翻译 ${translatedCount}/${records.length} 个段落。`, status: `翻译失败：${response?.error || "未知错误"}`, showRestore: true });
          return response;
        }
        let translations = parseImmersiveBatch(response.translation, batch);
        if (!translations) {
          translations = [];
          for (const record of batch) {
            if (runId !== immersiveRunId) return { ok: false, error: "沉浸式翻译已取消。" };
            const single = await runtimeMessage({ type: "TRANSLATE_TEXT", text: record.source, targetLanguage, context: "immersive web translation; return only the translation" });
            if (runId !== immersiveRunId) return { ok: false, error: "沉浸式翻译已取消。" };
            if (!single?.ok) {
              showPanel({ title: "沉浸式翻译", source: `已翻译 ${translatedCount}/${records.length} 个段落。`, status: `翻译失败：${single?.error || "未知错误"}`, showRestore: true });
              return single;
            }
            translations.push(single.translation);
          }
        }
        if (!translations) {
          showPanel({ title: "沉浸式翻译", source: `已翻译 ${translatedCount}/${records.length} 个段落。`, status: "翻译失败：接口没有保留段落标记。", showRestore: true });
          return { ok: false, error: "接口没有保留段落标记。" };
        }
        translations.forEach((translation, index) => insertImmersiveTranslation(batch[index], translation));
        translatedCount += batch.length;
      }
      showPanel({ title: "沉浸式翻译", source: `已在原网页位置显示 ${translatedCount} 个译文段落。`, status: "保留原文的沉浸式译文已完成。", showRestore: true });
      return { ok: true, translatedCount };
    }

    async function translateSelection(targetLanguage, providedText = "") {
      const runId = beginPanelRun();
      const source = String(providedText || "").trim() || selectionText();
      if (!source) {
        showPanel({ title: "翻译选中文本", status: "请先在网页中选择文本。" });
        return { ok: false, error: "请先选择文本。" };
      }
      showPanel({ title: "翻译选中文本", source, status: "正在请求翻译 API…" });
      const result = await runtimeMessage({ type: "TRANSLATE_TEXT", text: source, targetLanguage, context: "selected text" });
      if (runId !== panelRunId) return { ok: false, error: "翻译已取消。" };
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
      for (let index = 0; index < chunks.length; index += 1) {
        if (runId !== panelRunId) return { ok: false, error: "翻译已取消。" };
        setStatus(`${notice}正在翻译第 ${index + 1}/${chunks.length} 段…`);
        const result = await runtimeMessage({ type: "TRANSLATE_TEXT", text: chunks[index], targetLanguage, context: "web page" });
        if (runId !== panelRunId) return { ok: false, error: "翻译已取消。" };
        if (!result?.ok) {
          showPanel({ title: "翻译当前网页", source, translation: translated.join("\n\n"), status: `翻译失败：${result?.error || "未知错误"}` });
          return result;
        }
        translated.push(result.translation);
      }
      showPanel({ title: "翻译当前网页", source, translation: translated.join("\n\n"), status: notice });
      return { ok: true, translation: translated.join("\n\n") };
    }

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === "PING") {
        sendResponse({ ok: true });
        return false;
      }
      if (message?.type === "GET_SELECTION") {
        sendResponse({ ok: true, selection: selectionText() });
        return false;
      }
      if (message?.type === "TRANSLATE_SELECTION") {
        translateSelection(message.targetLanguage, message.selectionText).then(sendResponse);
        return true;
      }
      if (message?.type === "TRANSLATE_PAGE") {
        translatePage(message.targetLanguage).then(sendResponse);
        return true;
      }
      if (message?.type === "TRANSLATE_IMMERSIVE") {
        translateImmersive(message.targetLanguage).then(sendResponse);
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
