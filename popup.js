/* global chrome */

const DEFAULT_TARGET = "zh-CN";
let activeTab;
let busy = false;
let selectionSitePattern;
let selectionSiteId;

const $ = (id) => document.getElementById(id);

function setStatus(text, error = false) {
  const element = $("status");
  element.textContent = text || "";
  element.classList.toggle("error", error);
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(response);
    });
  });
}

async function ensureContentScript(tabId) {
  try {
    await sendTabMessage(tabId, { type: "PING" });
  } catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["src/content.js"] });
  }
}

async function loadSelection() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab = tabs[0];
    if (!activeTab?.id) throw new Error("找不到当前标签页。");
    await ensureContentScript(activeTab.id);
    const response = await sendTabMessage(activeTab.id, { type: "GET_SELECTION" });
    const selection = response?.selection?.trim();
    $("selection").textContent = selection || "未检测到选中文本。可启用本站划词按钮，或直接翻译当前网页。";
  } catch (error) {
    $("selection").textContent = "此页面不允许注入扩展脚本。请换到普通网页后重试。";
    setStatus(error.message, true);
  }
}

async function loadSelectionSite() {
  const checkbox = $("selectionEnabled");
  try {
    const url = new URL(activeTab?.url);
    if (!/^https?:$/.test(url.protocol)) return;
    selectionSitePattern = `${url.protocol}//${url.hostname}/*`;
    selectionSiteId = `qf-selection-${encodeURIComponent(selectionSitePattern)}`;
    const scripts = await chrome.scripting.getRegisteredContentScripts({ ids: [selectionSiteId] });
    const allowed = await chrome.permissions.contains({ origins: [selectionSitePattern] });
    checkbox.checked = scripts.length > 0 && allowed;
    checkbox.disabled = false;
    await sendTabMessage(activeTab.id, { type: "SET_SELECTION_ENABLED", enabled: checkbox.checked });
  } catch { checkbox.disabled = true; }
}

async function setSelectionSite() {
  const checkbox = $("selectionEnabled");
  if (!selectionSitePattern || !activeTab?.id) return;
  const enabled = checkbox.checked;
  checkbox.disabled = true;
  let createdScript = false;
  try {
    if (enabled) {
      const allowed = await chrome.permissions.request({ origins: [selectionSitePattern] });
      if (!allowed) throw new Error("未授予本站访问权限，划词按钮尚未开启。");
      const scripts = await chrome.scripting.getRegisteredContentScripts({ ids: [selectionSiteId] });
      if (!scripts.length) {
        await chrome.scripting.registerContentScripts([{
          id: selectionSiteId, matches: [selectionSitePattern], js: ["src/content.js"], runAt: "document_idle", persistAcrossSessions: true
        }]);
        createdScript = true;
      }
      await ensureContentScript(activeTab.id);
      await sendTabMessage(activeTab.id, { type: "SET_SELECTION_ENABLED", enabled: true });
    } else {
      const scripts = await chrome.scripting.getRegisteredContentScripts({ ids: [selectionSiteId] });
      if (scripts.length) await chrome.scripting.unregisterContentScripts({ ids: [selectionSiteId] });
    }
    const tabs = await chrome.tabs.query({ url: selectionSitePattern });
    await Promise.allSettled(tabs.map((tab) => sendTabMessage(tab.id, { type: "SET_SELECTION_ENABLED", enabled })));
    setStatus(enabled ? "本站已开启划词按钮。选中文字后点击“翻译”，Esc 关闭。" : "本站划词按钮已关闭，后续打开页面也不会自动启用。");
  } catch (error) {
    if (createdScript) await chrome.scripting.unregisterContentScripts({ ids: [selectionSiteId] }).catch(() => {});
    const scripts = await chrome.scripting.getRegisteredContentScripts({ ids: [selectionSiteId] }).catch(() => []);
    checkbox.checked = scripts.length > 0;
    setStatus(error.message, true);
  } finally { checkbox.disabled = false; }
}

async function run(type) {
  if (busy) return;
  busy = true;
  const buttons = ["translateSelection", "translatePage", "translateImmersive"].map($);
  buttons.forEach((button) => { button.disabled = true; });
  try {
    if (!activeTab?.id) await loadSelection();
    if (!activeTab?.id) return;
    await ensureContentScript(activeTab.id);
    setStatus("正在翻译，进度显示在网页面板中。可关闭弹窗继续阅读。");
    const response = await sendTabMessage(activeTab.id, { type, targetLanguage: $("targetLanguage").value });
    if (!response?.ok) {
      const suffix = response?.code === "PERMISSION_REQUIRED" ? "请打开设置并允许访问 API 域名。" : "";
      setStatus(`${response?.error || "翻译失败。"} ${suffix}`.trim(), true);
      return;
    }
    setStatus(type === "TRANSLATE_IMMERSIVE"
      ? `沉浸式译文已显示在原网页位置（${response.translatedCount || 0} 个段落）。`
      : "译文已显示在网页右上角。点击页面面板中的复制即可复制。");
  } catch (error) {
    setStatus(`无法访问当前页面：${error.message}`, true);
  } finally {
    busy = false;
    buttons.forEach((button) => { button.disabled = false; });
  }
}

async function restoreImmersive() {
  try {
    if (!activeTab?.id) await loadSelection();
    if (!activeTab?.id) return;
    await ensureContentScript(activeTab.id);
    const response = await sendTabMessage(activeTab.id, { type: "RESTORE_IMMERSIVE" });
    setStatus(response?.count ? `已恢复 ${response.count} 个网页段落。` : "当前页面没有沉浸式译文。");
  } catch (error) {
    setStatus(`无法恢复当前页面：${error.message}`, true);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const stored = await chrome.storage.local.get({ targetLanguage: DEFAULT_TARGET });
  $("targetLanguage").value = stored.targetLanguage || DEFAULT_TARGET;
  $("targetLanguage").addEventListener("change", () => chrome.storage.local.set({ targetLanguage: $("targetLanguage").value }));
  $("translateSelection").addEventListener("click", () => run("TRANSLATE_SELECTION"));
  $("translatePage").addEventListener("click", () => run("TRANSLATE_PAGE"));
  $("translateImmersive").addEventListener("click", () => run("TRANSLATE_IMMERSIVE"));
  $("restoreImmersive").addEventListener("click", restoreImmersive);
  $("selectionEnabled").addEventListener("change", setSelectionSite);
  $("openOptions").addEventListener("click", () => chrome.runtime.openOptionsPage());
  await loadSelection();
  await loadSelectionSite();
});
