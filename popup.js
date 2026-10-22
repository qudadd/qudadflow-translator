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
    $("selection").textContent = "PDF 或浏览器保护页面请使用“PDF / 文档左右对照”；普通网页可使用沉浸式翻译。";
    setStatus("当前页面无法直接显示网页翻译，可从上方打开文档阅读器。");
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
  try {
    const profiles=await chrome.runtime.sendMessage({type:'PROFILE_LIST'});
    if(profiles?.ok){$('activeProfile').replaceChildren(new Option('当前配置',''),...profiles.profiles.map(profile=>new Option(profile.name,profile.id)));$('activeProfile').value=profiles.activeProfileId;}
  } catch {}
  $('activeProfile').addEventListener('change',async()=>{
    if(!$('activeProfile').value)return;
    try {const result=await chrome.runtime.sendMessage({type:'PROFILE_APPLY',profileId:$('activeProfile').value});if(!result?.ok)throw new Error(result?.error||'切换失败');const values=await chrome.storage.local.get({targetLanguage:DEFAULT_TARGET});$('targetLanguage').value=values.targetLanguage;setStatus('已切换翻译方案。若尚未授权该 API 域名，请打开设置授权。');}catch(error){setStatus(error.message,true);}
  });
  $("openDocument").addEventListener("click", async () => {
    const tab = activeTab || (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
    let fragment = "local=1";
    try {
      const url = new URL(tab?.url);
      if (/^https?:$/.test(url.protocol) && !url.username && !url.password) fragment = `url=${encodeURIComponent(url.href)}`;
    } catch {}
    await chrome.tabs.create({ url: chrome.runtime.getURL(`reader.html#${fragment}`) });
    window.close();
  });
  $('openResearch').addEventListener('click',async()=>{
    $('openResearch').disabled=true;setStatus('正在本地提取论文与图表…');
    try{const tab=activeTab||(await chrome.tabs.query({active:true,currentWindow:true}))[0];const result=await chrome.runtime.sendMessage({type:'RESEARCH_CAPTURE',tabId:tab?.id});if(!result?.ok)throw new Error(result?.error||'提取失败');window.close();}catch(error){setStatus(error.message,true);}finally{$('openResearch').disabled=false;}
  });
  await loadSelection();
  await loadSelectionSite();
});
