/* global chrome */

const DEFAULT_TARGET = "zh-CN";
let activeTab;

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
    $("selection").textContent = selection || "未检测到选中文本。可以改用“翻译当前网页”。";
  } catch (error) {
    $("selection").textContent = "此页面不允许注入扩展脚本。请换到普通网页后重试。";
    setStatus(error.message, true);
  }
}

async function run(type) {
  try {
    if (!activeTab?.id) await loadSelection();
    if (!activeTab?.id) return;
    await ensureContentScript(activeTab.id);
    setStatus("正在翻译…");
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
  $("openOptions").addEventListener("click", () => chrome.runtime.openOptionsPage());
  await loadSelection();
});
