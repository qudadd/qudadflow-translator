/* global chrome */

const DEFAULT_TARGET = "zh-CN";
let activeTab,modelPicker;
let busy = false;
let selectionSitePattern;
let selectionSiteId;
let siteAuthorizationTarget;
let authorizingSite = false;

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

function siteAuthorizationFor(tab) {
  try {
    const url = new URL(tab?.url);
    if (!/^https?:$/.test(url.protocol) || !tab?.id) return null;
    if (url.hostname === 'chromewebstore.google.com' ||
        url.hostname === 'chrome.google.com' && /^\/webstore(?:\/|$)/.test(url.pathname) ||
        url.hostname === 'microsoftedge.microsoft.com' && /^\/addons(?:\/|$)/.test(url.pathname)) return null;
    return {tabId:tab.id,pattern:`${url.protocol}//${url.hostname}/*`,host:url.host};
  } catch { return null; }
}

async function updateSiteAuthorization() {
  const card = $('siteAuthorization'), button = $('authorizeCurrentSite');
  const target = siteAuthorizationFor(activeTab);
  siteAuthorizationTarget = target;
  card.hidden = true; button.disabled = true;
  if (!target) {
    $('siteAuthorizationDetails').open = false;
    return;
  }
  try {
    const allowed = await chrome.permissions.contains({origins:[target.pattern]});
    if (siteAuthorizationTarget !== target) return;
    card.hidden = allowed; button.disabled = allowed || authorizingSite;
    $('siteAuthorizationHint').textContent = target.host;
    if (allowed) $('siteAuthorizationDetails').open = false;
  } catch {
    if (siteAuthorizationTarget === target) siteAuthorizationTarget = null;
  }
}

async function authorizeCurrentSite() {
  const target = siteAuthorizationTarget;
  if (!target || authorizingSite) return;
  authorizingSite = true; $('authorizeCurrentSite').disabled = true;
  try {
    // Keep the permission request inside the click's user activation.
    const allowed = await chrome.permissions.request({origins:[target.pattern]});
    if (!allowed) {
      $('siteAuthorizationHint').textContent = `${target.host} · 未授权，可重试`;
      setStatus('未授予本站权限。可以稍后重试，或在设置中管理网站授权。', true);
      return;
    }
    // Hide immediately on consent, even if page setup or an older permission check is pending.
    siteAuthorizationTarget = null;
    $('siteAuthorization').hidden = true;
    $('siteAuthorizationDetails').open = false;
    setStatus(`已授权 ${target.host}。可以开始沉浸式翻译，或自行开启下方划词按钮。`);
    const tab = await chrome.tabs.get(target.tabId).catch(() => null);
    if (tab) activeTab = tab;
    if (tab && siteAuthorizationFor(tab)?.pattern === target.pattern) {
      try { await ensureContentScript(tab.id); await loadSelectionSite(); }
      catch { setStatus(`已授权 ${target.host}。当前页面不支持网页注入；PDF 请使用文档阅读器。`); }
    }
    await updateSiteAuthorization();
  } catch (error) {
    setStatus(`网站授权未完成：${error.message}`, true);
  } finally {
    authorizingSite = false; $('authorizeCurrentSite').disabled = $('siteAuthorization').hidden || !siteAuthorizationTarget;
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
  if (busy||modelPicker?.pending) return;
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
  const stored = await chrome.storage.local.get({ targetLanguage: DEFAULT_TARGET, apiStyle:'auto-machine', chatgptAccount:'', qfChatgptInstallOffer:'' });
  $("targetLanguage").value = stored.targetLanguage || DEFAULT_TARGET;
  const offer=$('chatgptInstallOffer');
  const platform=await chrome.runtime.getPlatformInfo().catch(()=>({}));
  offer.hidden=stored.qfChatgptInstallOffer!=='0.9.0'||stored.apiStyle==='chatgpt-plan'||Boolean(stored.chatgptAccount)||platform.os!=='win'||platform.arch!=='x86-64';
  $('chatgptInstallLater').addEventListener('click',async()=>{await chrome.storage.local.remove('qfChatgptInstallOffer');offer.hidden=true;});
  $('chatgptInstallGuide').addEventListener('click',async()=>{
    await chrome.tabs.create({url:chrome.runtime.getURL('options.html?preview=chatgpt#connectionSettings')});
    await chrome.storage.local.remove('qfChatgptInstallOffer');
    window.close();
  });
  $("targetLanguage").addEventListener("change", () => chrome.storage.local.set({ targetLanguage: $("targetLanguage").value }));
  $("translateSelection").addEventListener("click", () => run("TRANSLATE_SELECTION"));
  $("translatePage").addEventListener("click", () => run("TRANSLATE_PAGE"));
  $("translateImmersive").addEventListener("click", () => run("TRANSLATE_IMMERSIVE"));
  $("restoreImmersive").addEventListener("click", restoreImmersive);
  $("selectionEnabled").addEventListener("change", setSelectionSite);
  $('authorizeCurrentSite').addEventListener('click', authorizeCurrentSite);
  for (const event of [chrome.permissions.onAdded, chrome.permissions.onRemoved]) event?.addListener(() => updateSiteAuthorization());
  $("openOptions").addEventListener("click", () => chrome.runtime.openOptionsPage());
  const {ModelPicker}=await import('./src/model-picker.mjs');
  modelPicker=new ModelPicker($('activeModel'),{onNotice:setStatus,onPending:pending=>{for(const id of ['translateSelection','translatePage','translateImmersive'])$(id).disabled=pending||busy;}});
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
  await updateSiteAuthorization();
  await loadSelectionSite();
});
