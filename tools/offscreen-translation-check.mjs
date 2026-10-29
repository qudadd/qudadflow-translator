import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'src/offscreen-translation.js'), 'utf8');
const reportPath = process.argv[2];
const results = [];

function harness(translator) {
  let listener;
  const messages = [];
  const values = new Map();
  const runtime = {
    id: 'test-extension',
    onMessage: { addListener(value) { listener = value; } },
    async sendMessage(message) { messages.push(message); }
  };
  const context = vm.createContext({
    chrome: { runtime }, Translator: translator, AbortController,
    navigator: { userActivation: { isActive: false } },
    localStorage: {
      getItem(key) { return values.get(key) ?? null; },
      setItem(key, value) { values.set(key, value); }
    }
  });
  vm.runInContext(source, context, { filename: 'src/offscreen-translation.js' });
  function send(message, sender = { id: runtime.id }) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Offscreen response timed out')), 1000);
      const respond = value => { clearTimeout(timer); resolve(value); };
      listener(message, sender, respond);
    });
  }
  return { send, messages, values };
}

async function check(name, run) {
  try {
    await run();
    results.push({ name, passed: true });
    console.log('PASS ' + name);
  } catch (error) {
    results.push({ name, passed: false, error: error.stack || String(error) });
    console.error('FAIL ' + name + ': ' + error.message);
  }
}

await check('Window Translator preserves markers, ordering and progress', async () => {
  const translated = [];
  let destroyed = 0;
  const test = harness({
    async availability() { return 'available'; },
    async create() {
      return {
        async translate(value) { translated.push(value); return 'ZH:' + value; },
        destroy() { destroyed++; }
      };
    }
  });
  const result = await test.send({
    target: 'QF_BROWSER_TRANSLATOR', action: 'translate', requestId: 'a',
    pair: { sourceLanguage: 'en', targetLanguage: 'zh' },
    chunks: [
      { text: '__QF_DOC_1__', translate: false },
      { text: '\n', translate: false },
      { text: ' Hello ', translate: true },
      { text: '\n\n', translate: false },
      { text: '__QF_DOC_2__', translate: false },
      { text: ' world', translate: true }
    ]
  });
  assert.equal(result.status, 'ok');
  assert.equal(result.translation, '__QF_DOC_1__\n ZH:Hello \n\n__QF_DOC_2__ ZH:world');
  assert.deepEqual(translated, ['Hello', 'world']);
  assert.equal(destroyed, 1);
  assert.equal(test.messages.length, 2);
  assert.equal(test.messages.at(-1).translation, result.translation);
});

await check('Downloadable model falls back without an invisible download', async () => {
  let creates = 0;
  const test = harness({
    async availability() { return 'downloadable'; },
    async create() { creates++; throw new Error('must not download'); }
  });
  const result = await test.send({
    target: 'QF_BROWSER_TRANSLATOR', action: 'translate', requestId: 'b',
    pair: { sourceLanguage: 'en', targetLanguage: 'zh' },
    chunks: [{ text: 'Hello', translate: true }]
  });
  assert.equal(result.status, 'downloadable');
  assert.equal(creates, 0);
  assert.equal(test.values.size, 1);
});

await check('Unavailable pairs use local availability cache', async () => {
  let checks = 0;
  const test = harness({ async availability() { checks++; return 'unavailable'; }, async create() {} });
  const request = {
    target: 'QF_BROWSER_TRANSLATOR', action: 'translate',
    pair: { sourceLanguage: 'en', targetLanguage: 'zh' },
    chunks: [{ text: 'Hello', translate: true }]
  };
  assert.equal((await test.send({ ...request, requestId: 'c' })).status, 'unavailable');
  assert.equal((await test.send({ ...request, requestId: 'd' })).status, 'unavailable');
  assert.equal(checks, 1);
});

await check('Cancellation destroys an active browser translator', async () => {
  let destroyed = 0;
  const test = harness({
    async availability() { return 'available'; },
    async create() {
      return {
        translate(_value, { signal }) {
          return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
        },
        destroy() { destroyed++; }
      };
    }
  });
  const request = test.send({
    target: 'QF_BROWSER_TRANSLATOR', action: 'translate', requestId: 'e',
    pair: { sourceLanguage: 'en', targetLanguage: 'zh' },
    chunks: [{ text: 'Hello', translate: true }]
  });
  await new Promise(resolve => setTimeout(resolve, 0));
  const cancel = await test.send({ target: 'QF_BROWSER_TRANSLATOR', action: 'cancel', requestId: 'e' });
  assert.equal(cancel.status, 'cancelled');
  assert.equal((await request).status, 'cancelled');
  assert.equal(destroyed, 1);
});

await check('Web content cannot send work to the hidden translation document', async () => {
  const test = harness({ async availability() { throw new Error('forbidden'); }, async create() {} });
  const result = await test.send(
    { target: 'QF_BROWSER_TRANSLATOR', action: 'translate', requestId: 'f' },
    { id: 'test-extension', tab: { id: 1 } }
  );
  assert.equal(result.status, 'unavailable');
});

const report = { passed: results.filter(item => item.passed).length, failed: results.filter(item => !item.passed).length, results };
if (reportPath) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify({ passed: report.passed, failed: report.failed }));
if (report.failed) process.exitCode = 1;
