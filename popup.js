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
    const allowed = await QFWebsiteAccess.contains();
    if (siteAuthorizationTarget !== target) return;
    card.hidden = allowed; button.disabled = allowed || authorizingSite;
    $('siteAuthorizationHint').textContent = '浏览器确认一次，之后无需逐站授权。';
    if (allowed) $('siteAuthorizationDetails').open = false;
  } catch {
    if (siteAuthorizationTarget !== target) return;
    card.hidden = false; button.disabled = authorizingSite;
    $('siteAuthorizationHint').textContent = '无法读取权限，请点击授权重试。';
  }
}

async function authorizeCurrentSite() {
  const target = siteAuthorizationTarget;
  if (!target || authorizingSite) return;
  authorizingSite = true; $('authorizeCurrentSite').disabled = true;
  try {
    // Keep the permission request inside the click's user activation.
    const allowed = await QFWebsiteAccess.request();
    if (!allowed) {
      $('siteAuthorizationHint').textContent = '未授权，可重试';
      setStatus('未授予所有网站访问权限。点击“一次授权所有网站”重试。', true);
      return;
    }
    // Hide immediately on consent, even if page setup or an older permission check is pending.
    siteAuthorizationTarget = null;
    $('siteAuthorization').hidden = true;
    $('siteAuthorizationDetails').open = false;
    setStatus('已授权所有 HTTP/HTTPS 网站，后续无需逐站确认。');
    const tab = await chrome.tabs.get(target.tabId).catch(() => null);
    if (tab) activeTab = tab;
    if (tab && siteAuthorizationFor(tab)?.pattern === target.pattern) {
      try { await ensureContentScript(tab.id); await loadSelectionSite(); }
      catch { setStatus('所有网站已授权。当前页面不支持网页注入；PDF 请使用文档阅读器。'); }
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
    if (!activeTab) activeTab = (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
    if (!activeTab?.id) throw new Error("找不到当前标签页。");
    let selection;
    try {
      selection = (await sendTabMessage(activeTab.id, {type: 'GET_SELECTION'}))?.selection?.trim();
    } catch {
      // Opening the popup needs only selected text, not the complete page UI,
      // selection observers and translation engine. Load those on the action.
      const result = await chrome.scripting.executeScript({target: {tabId: activeTab.id}, func: () => window.getSelection()?.toString() || ''});
      selection = result[0]?.result?.trim();
    }
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
    const [scripts, allowed] = await Promise.all([
      chrome.scripting.getRegisteredContentScripts({ ids: [selectionSiteId] }),
      chrome.permissions.contains({ origins: [selectionSitePattern] })
    ]);
    checkbox.checked = scripts.length > 0 && allowed;
    checkbox.disabled = false;
    await sendTabMessage(activeTab.id, { type: "SET_SELECTION_ENABLED", enabled: checkbox.checked }).catch(() => {});
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
      const allowed = await QFWebsiteAccess.request();
      if (!allowed) { await updateSiteAuthorization(); throw new Error('未授予所有网站访问权限，划词按钮尚未开启。'); }
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
    // Request all web origins while the initiating click is still active.
    if (siteAuthorizationFor(activeTab) && !await QFWebsiteAccess.request()) {
      await updateSiteAuthorization();
      setStatus('未授予所有网站访问权限。点击“一次授权所有网站”后继续。', true);
      return;
    }
    await updateSiteAuthorization();
    if (!activeTab?.id) await loadSelection();
    if (!activeTab?.id) return;
    await ensureContentScript(activeTab.id);
    setStatus("正在翻译，进度显示在网页面板中。可关闭弹窗继续阅读。");
    const response = await sendTabMessage(activeTab.id, { type, targetLanguage: $("targetLanguage").value });
    if (!response?.ok) {
      const suffix = response?.code === "PERMISSION_REQUIRED" ? "请打开设置并允许访问 API 域名。" : "";
      setStatus(`${response?.error || "翻译失败。"} ${suffix}${response?.canResume ? '已完成译文保留，点击网页中的“继续翻译”或再次点击翻译按钮即可接着翻译。' : ''}`.trim(), true);
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
  const stored = chrome.storage.local.get({targetLanguage: DEFAULT_TARGET});
  const currentTab = chrome.tabs.query({active: true, currentWindow: true});
  $("targetLanguage").addEventListener("change", () => chrome.storage.local.set({ targetLanguage: $("targetLanguage").value }));
  $("translateSelection").addEventListener("click", () => run("TRANSLATE_SELECTION"));
  $("translatePage").addEventListener("click", () => run("TRANSLATE_PAGE"));
  $("translateImmersive").addEventListener("click", () => run("TRANSLATE_IMMERSIVE"));
  $("restoreImmersive").addEventListener("click", restoreImmersive);
  $("selectionEnabled").addEventListener("change", setSelectionSite);
  $('authorizeCurrentSite').addEventListener('click', authorizeCurrentSite);
  for (const event of [chrome.permissions.onAdded, chrome.permissions.onRemoved]) event?.addListener(() => updateSiteAuthorization());
  $("openOptions").addEventListener("click", () => chrome.runtime.openOptionsPage());
  void import('./src/model-picker.mjs').then(({ModelPicker}) => {
    modelPicker=new ModelPicker($('activeModel'),{onNotice:setStatus,onPending:pending=>{for(const id of ['translateSelection','translatePage','translateImmersive'])$(id).disabled=pending||busy;}});
  }).catch(error => setStatus('模型列表暂不可用：'+error.message,true));
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
    try{const permission=QFWebsiteAccess.request();if(!await permission){await updateSiteAuthorization();throw new Error('未授予所有网站访问权限，请点击“一次授权所有网站”后重试。');}const tab=activeTab||(await chrome.tabs.query({active:true,currentWindow:true}))[0];const result=await chrome.runtime.sendMessage({type:'RESEARCH_CAPTURE',tabId:tab?.id});if(!result?.ok)throw new Error(result?.error||'提取失败');window.close();}catch(error){setStatus(error.message,true);}finally{$('openResearch').disabled=false;}
  });
  await Promise.all([
    stored.then(value => { $("targetLanguage").value = value.targetLanguage || DEFAULT_TARGET; }),
    currentTab.then(async tabs => {
      activeTab=tabs[0];
      await Promise.all([loadSelection(), updateSiteAuthorization(), loadSelectionSite()]);
    })
  ]).catch(error => setStatus('读取本地状态失败：'+error.message,true));
});
