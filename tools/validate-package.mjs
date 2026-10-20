import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

assert(manifest.manifest_version === 3, "manifest_version 必须为 3");
assert(manifest.background?.service_worker, "缺少 background.service_worker");
assert(fs.existsSync(path.join(root, manifest.background.service_worker)), "service worker 文件不存在");
assert(Array.isArray(manifest.optional_host_permissions), "必须显式声明可选 API 域名权限");
assert(manifest.permissions?.includes("activeTab"), "缺少 activeTab 权限");
assert(manifest.permissions?.includes("scripting"), "缺少 scripting 权限");
assert(manifest.permissions?.includes("storage"), "缺少 storage 权限");
assert(manifest.commands?.["translate-immersive"], "缺少沉浸式翻译快捷键");

assert(manifest.default_locale === "en", "默认语言必须为 en");
for (const locale of ["en", "zh_CN"]) {
  const file = path.join(root, "_locales", locale, "messages.json");
  assert(fs.existsSync(file), `缺少语言文件：${locale}`);
  if (!fs.existsSync(file)) continue;
  const messages = JSON.parse(fs.readFileSync(file, "utf8"));
  assert(messages.extensionName?.message === "QudadFlow Translator", `${locale} 必须保留统一英文名称`);
  for (const [, key] of JSON.stringify(manifest).matchAll(/__MSG_(\w+)__/g)) {
    assert(Boolean(messages[key]?.message), `${locale} 缺少 manifest 消息：${key}`);
  }
  assert(messages.extensionDescription?.message.length <= 132, `${locale} 简介超过 132 个字符`);
}

const backgroundSource = fs.readFileSync(path.join(root, manifest.background.service_worker), "utf8");
const contentSource = fs.readFileSync(path.join(root, "src/content.js"), "utf8");
for (const provider of ["google-translate-v2", "microsoft-translator", "deepl", "custom-json"]) {
  assert(backgroundSource.includes(provider), `service worker 缺少接口类型：${provider}`);
}
for (const feature of ["TRANSLATE_IMMERSIVE", "RESTORE_IMMERSIVE", "data-edge-wt-immersive-translation"]) {
  assert(contentSource.includes(feature), `内容脚本缺少功能标记：${feature}`);
}

for (const file of ["popup.html", "options.html", "reader.html"]) {
  const html = fs.readFileSync(path.join(root, file), "utf8");
  for (const match of html.matchAll(/<(?:script|link)[^>]+(?:src|href)=["']([^"']+)["']/gi)) {
    const resource = match[1];
    if (/^https?:/i.test(resource)) continue;
    assert(fs.existsSync(path.join(root, resource)), `${file} 引用的资源不存在：${resource}`);
  }
}

for (const [size, icon] of Object.entries(manifest.icons || {})) {
  assert(fs.existsSync(path.join(root, icon)), `manifest.icons.${size} 文件不存在：${icon}`);
  if (fs.existsSync(path.join(root, icon))) {
    const bytes = fs.readFileSync(path.join(root, icon));
    assert(bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), `${icon} 不是 PNG`);
    if (bytes.length >= 24) assert(bytes.readUInt32BE(16) === Number(size) && bytes.readUInt32BE(20) === Number(size), `${icon} 尺寸必须是 ${size}×${size}`);
  }
}

for (const file of ["popup.html", "options.html", "privacy.html", "reader.html"]) {
  const html = fs.readFileSync(path.join(root, file), "utf8");
  assert(!/<script[^>]+src=["']https?:/i.test(html), `${file} 不得加载远程脚本`);
}

assert(manifest.content_security_policy?.extension_pages === "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'", "文档阅读器仅允许本地脚本与本地 WASM");
for (const file of ['reader.js','src/document-format.mjs','src/docx-worker.js','vendor/pdfjs/legacy/build/pdf.mjs','vendor/pdfjs/legacy/build/pdf.worker.mjs','vendor/pdfjs/wasm/openjpeg.wasm','vendor/pdfjs/standard_fonts/LiberationSans-Regular.ttf','vendor/pdfjs/cmaps/Adobe-GB1-UCS2.bcmap','vendor/pdfjs/LICENSE','vendor/fflate/umd/index.js','vendor/fflate/LICENSE','vendor/dependencies.json','THIRD_PARTY_NOTICES.md']) {
  assert(fs.existsSync(path.join(root,file)), `缺少文档运行资源：${file}`);
}
for(const file of ['src/profile-store.js','src/my-memory.js'])assert(fs.existsSync(path.join(root,file)),`缺少配置/基础翻译资源：${file}`);
assert(!manifest.host_permissions?.length, '生产包不得预先请求全部网站权限');

if (failures.length) {
  console.error(failures.map((item) => `✗ ${item}`).join("\n"));
  process.exit(1);
}

console.log("✓ Manifest、图标、本地资源和远程脚本检查通过");
