/* Optional native setup. This module never executes a downloaded file. */
globalThis.QFConnectorSetup = (() => {
  const $ = id => document.getElementById(id);
  const storeInstall = new Set(['nichpjndbjbcfkcbanfcfogpkdhblghh', 'dfecnbleolbeddoflpfmailolehhnaih']).has(chrome.runtime.id);
  const installerUrl = $('chatgptManualDownload').href;
  let platform, handlers, ready = false, downloading = false, waiting = false;
  let downloadId, downloadComplete = false, timer, deadline = 0, revision = 0, closed = false, listening = false;
  const active = () => !closed && $('apiStyle').value === 'chatgpt-plan';
  const status = (text, error = false) => {
    $('chatgptInstallStatus').textContent = text;
    $('chatgptInstallStatus').classList.toggle('error', error);
  };
  function controls() {
    $('chatgptInstall').disabled = downloading || waiting || !platform || platform.os !== 'win' || platform.arch !== 'x86-64';
    $('chatgptInstallStop').hidden = !waiting && !downloading;
    $('chatgptInstallShow').hidden = !downloadComplete;
  }
  function stop(message = '') {
    revision++;
    waiting = false;
    downloading = false;
    clearTimeout(timer);
    controls();
    if (message) status(message);
  }
  function resume() {
    if (!ready || !waiting || !active() || handlers?.busy()) return;
    stop();
    void handlers.login();
  }
  function scheduleProbe() {
    clearTimeout(timer);
    if (!waiting || !active()) return;
    if (Date.now() > deadline) {
      stop('尚未检测到连接程序。完成安装后可点击“重新检测”；不会自动打开授权。');
      return;
    }
    timer = setTimeout(async () => {
      if (!waiting || !active()) return;
      if (!document.hidden) await handlers?.probe();
      resume();
      scheduleProbe();
    }, 2000);
  }
  function waitingForHost() {
    downloading = false;
    waiting = true;
    deadline = Date.now() + 10 * 60 * 1000;
    status('下载完成。请打开下载文件并确认安装一次，返回此页后将自动继续官方授权。');
    controls();
    resume();
    scheduleProbe();
  }
  function downloadChanged(change) {
    // Inspect only the download initiated by this page, never download history.
    if (closed || !downloading || change.id !== downloadId) return;
    if (change.state?.current === 'interrupted') {
      stop();
      status('下载未完成，账号登录仍未启用。请检查网络或浏览器下载提示后重试，也可使用手动下载。', true);
      return;
    }
    if (change.state?.current === 'complete') {
      downloadComplete = true;
      if (active()) waitingForHost(); else stop();
    }
  }
  async function download() {
    if (!active() || !storeInstall || downloading || waiting || ready || !platform || platform.os !== 'win' || platform.arch !== 'x86-64') return;
    const attempt = ++revision;
    downloading = true; downloadComplete = false; downloadId = undefined; controls();
    status('请允许本次下载。安装完成前不会打开官方登录页。');
    try {
      // Request the optional permission directly from the user's click.
      const allowed = await chrome.permissions.request({permissions: ['downloads']});
      if (attempt !== revision || !active()) return;
      if (!allowed) {
        stop(); status('未授予下载权限。你仍可点击“手动下载”，安装后重新检测。'); return;
      }
      if (!chrome.downloads?.download) throw new Error('当前浏览器无法管理下载。');
      if (!listening) { chrome.downloads.onChanged.addListener(downloadChanged); listening = true; }
      const id = await chrome.downloads.download({url: installerUrl, filename: installerUrl.split('/').pop(), conflictAction: 'uniquify'});
      if (attempt !== revision || !active()) return;
      downloadId = id;
      status('正在下载连接程序。下载完成后，需要你打开文件并确认安装一次。');
      // Covers a very fast failure/completion before download() returned its ID.
      const [item] = await chrome.downloads.search({id});
      if (attempt === revision && item) downloadChanged({id, state: {current: item.state}});
    } catch (error) {
      if (attempt !== revision) return;
      stop(); status('无法开始下载：' + error.message + '。账号登录仍未启用，可重试或手动下载。', true);
    }
  }
  async function missing() {
    ready = false;
    $('chatgptSetup').hidden = false;
    $('chatgptSetup').open = true;
    if (!platform) platform = await chrome.runtime.getPlatformInfo().catch(() => ({}));
    if (ready) return;
    $('chatgptStoreSetup').hidden = !storeInstall || platform.os !== 'win' || platform.arch !== 'x86-64';
    const hint = $('chatgptPlatformHint');
    hint.hidden = storeInstall && platform.os === 'win' && platform.arch === 'x86-64';
    hint.textContent = !storeInstall ? '当前是侧载开发版，扩展 ID 与商店版不同。请按下方说明注册当前 ID；商店用户可直接使用下载按钮。' : '当前连接程序支持 Windows x64。此设备可继续使用默认机器翻译或自己的 API。';
    $('chatgptDevelopmentSetup').open = !storeInstall;
    controls();
  }
  $('chatgptInstall').addEventListener('click', download);
  $('chatgptInstallStop').addEventListener('click', () => stop('已停止等待，不会自动继续登录。已开始的下载可在浏览器下载列表中取消。'));
  $('chatgptInstallShow').addEventListener('click', () => {
    if (Number.isInteger(downloadId)) Promise.resolve(chrome.downloads.show(downloadId)).catch(() => status('请在浏览器下载列表中找到连接程序。'));
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && waiting) { void handlers?.probe(); scheduleProbe(); } });
  window.addEventListener('pagehide', () => { closed = true; stop(); if (listening) chrome.downloads?.onChanged.removeListener(downloadChanged); }, {once: true});
  controls();
  return {
    init(value) { handlers = value; },
    missing,
    connected() { ready = true; $('chatgptSetup').hidden = true; },
    resume,
    stop
  };
})();
