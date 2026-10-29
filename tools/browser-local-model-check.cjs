/* Optional real Chrome for Testing check. Uses a fresh isolated profile. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const root = path.resolve(__dirname, '..');
const reportPath = path.resolve(process.argv[2] || 'browser-local-model-check.json');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'qudadflow-local-model-'));
const report = { browser: '', before: '', after: '', translation: '', status: '', elapsedMs: 0 };
let context;
const started = Date.now();

(async () => {
  try {
    context = await chromium.launchPersistentContext(path.join(scratch, 'profile'), {
      channel: 'chromium', headless: true, args: [
        '--disable-extensions-except=' + root,
        '--load-extension=' + root
      ]
    });
    report.browser = context.browser().version();
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).host;
    const page = await context.newPage();
    await page.goto('chrome-extension://' + id + '/options.html');
    await page.waitForFunction(() => document.body.dataset.ready === 'true');
    const supported = await page.evaluate(() => Boolean(globalThis.Translator?.availability && globalThis.Translator?.create));
    if (!supported) { report.status = 'API_UNAVAILABLE'; return; }
    report.before = await page.evaluate(() => Translator.availability({ sourceLanguage: 'en', targetLanguage: 'zh' }));
    await page.locator('#prepareLocalModel').click();
    await page.waitForFunction(() => /已准备好|暂不可用|已取消/.test(document.querySelector('#localModelStatus').textContent), null, { timeout: 180000 });
    report.status = await page.locator('#localModelStatus').textContent();
    report.after = await page.evaluate(() => Translator.availability({ sourceLanguage: 'en', targetLanguage: 'zh' }));
    if (!report.status.includes('已准备好')) return;
    report.translation = await worker.evaluate(async () => {
      await ensureBrowserTranslationDocument();
      return chrome.runtime.sendMessage({
        target: 'QF_BROWSER_TRANSLATOR', action: 'translate', requestId: 'real-local-model',
        pair: { sourceLanguage: 'en', targetLanguage: 'zh' },
        chunks: [{ text: 'Hello world', translate: true }]
      });
    });
    if (report.translation.status !== 'ok' || !/[\u3400-\u9fff]/u.test(report.translation.translation)) throw new Error('Local model did not return Chinese text.');
  } finally {
    report.elapsedMs = Date.now() - started;
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
    await context?.close();
    if (!scratch.startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(scratch).startsWith('qudadflow-local-model-')) throw new Error('Unsafe temporary path');
    fs.rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
