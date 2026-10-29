/* Capture current extension UI in an isolated Edge profile. The store-ID UI
   branch is simulated because an unpacked copy has a different extension ID. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'branding', 'store-0.9.1', 'sources');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'qudadflow-store-'));
let context;
async function useStoreId(page) {
  await page.addInitScript(() => {
    const native = window.chrome;
    const runtime = new Proxy(native.runtime, { get(target, key) {
      return key === 'id' ? 'nichpjndbjbcfkcbanfcfogpkdhblghh' : Reflect.get(target, key);
    } });
    Object.defineProperty(window, 'chrome', { value: new Proxy(native, { get(target, key) {
      return key === 'runtime' ? runtime : Reflect.get(target, key);
    } }) });
  });
}

(async () => {
  try {
    fs.mkdirSync(output, { recursive: true });
    context = await chromium.launchPersistentContext(path.join(scratch, 'profile'), {
      channel: 'msedge', headless: true, viewport: { width: 1440, height: 900 },
      args: ['--disable-extensions-except=' + root, '--load-extension=' + root]
    });
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).host;
    const base = 'chrome-extension://' + id + '/';
    const page = await context.newPage();
    await useStoreId(page);
    await page.goto(base + 'options.html');
    await page.waitForFunction(() => document.body.dataset.ready === 'true');
    await page.locator('#connectionSettings').screenshot({ path: path.join(output, 'settings-default-0.9.1.png') });
    await page.locator('#apiStyle').selectOption('chatgpt-plan');
    await page.waitForFunction(() => !document.querySelector('#chatgptStatus').textContent.includes('正在检查'), null, { timeout: 15000 });
    await page.locator('#chatgptSetup').evaluate(element => { element.hidden = false; element.open = true; });
    await page.locator('#connectionSettings').screenshot({ path: path.join(output, 'settings-chatgpt-0.9.1.png') });
    await worker.evaluate(() => chrome.storage.local.set({ qfChatgptInstallOffer: '0.9.1', apiStyle: 'auto-machine', chatgptAccount: '' }));
    const popup = await context.newPage();
    await useStoreId(popup);
    await popup.setViewportSize({ width: 440, height: 800 });
    await popup.goto(base + 'popup.html');
    await popup.locator('#chatgptInstallOffer').waitFor({ state: 'visible' });
    await popup.locator('.popup').screenshot({ path: path.join(output, 'popup-install-offer-0.9.1.png') });
    console.log(JSON.stringify({ browser: context.browser().version(), output, files: fs.readdirSync(output) }));
  } finally {
    await context?.close();
    if (!scratch.startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(scratch).startsWith('qudadflow-store-')) throw new Error('Unsafe temporary path');
    fs.rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
