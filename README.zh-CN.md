# QudadFlow Translator（Microsoft Edge 扩展）

这是一个以沉浸式双语阅读和划词翻译为核心的 Manifest V3 扩展，可在 Microsoft Edge 中侧载。它直接调用用户配置的 Google Cloud Translation、DeepL API、Microsoft Translator，也支持 OpenAI 兼容的 Chat Completions、Responses 和自定义 JSON 接口。0.6.0 开发预览版新增文档原位替换和底部 AI 图文工作流。传统接口与 AI 均可提供基础沉浸式翻译；支持图片输入的 AI 额外翻译图中文字、解释图表。0.6.0 尚未提交商店。0.5.0 已于 2026 年 10 月 21 日（北京时间）替换旧版待审提交，Partner Center 确认状态为 **In review**；尚未审核通过或在商店正式发布。见[提交记录](docs/STORE_SUBMISSION_0.5.0.md)。

## 当前功能

- 保存最多 20 个具名 API 配置方案，包括接口、端点、Key、模型、请求头和语言；可选择、编辑、另存、删除，并在弹窗快速切换。
- MyMemory 免 Key 基础试用：默认英译简中，可手动更改源语言，匿名额度通常为每天 5000 字符。

- 站点授权后，选中文字即可就近点击“翻译”，通过跟随选区的小浮窗查看结果、复制或重试；Esc 关闭。
- 保留扩展弹窗、右键菜单、`Alt+Shift+T` 快捷键划词入口。
- 翻译当前网页文本，并在页面右上角显示可复制的译文面板。
- 沉浸式翻译：译文紧随原段落，流式接口返回时逐步显示；优先翻译当前视区附近的段落，支持一键恢复原文。
- 沉浸式翻译也可通过右键菜单或 `Alt+Shift+I` 快捷键触发。
- 直接机器翻译：Google Cloud Translation v2、DeepL API、Microsoft Translator。
- 配置 API 端点、API Key、模型、源/目标语言、温度、自定义请求头。
- OpenAI 兼容模式支持 Chat Completions、Responses 和流式接收；保留自定义 JSON 模式。
- 显示等待时长和进度；划词请求优先使用下一个空闲请求位置，整个页面最多两个并发请求。关闭划词卡片不会中断沉浸式任务。
- 相同文本与配置的成功译文可在五分钟内复用，避免再次调用 API；修改配置后清空缓存，连接测试始终发出真实请求。
- API 域名使用可选权限：保存端点时只请求该端点所在的域名。
- 不加载远程脚本，不使用广告或遥测。

## 在 Edge 中测试

1. 打开 `edge://extensions`，开启“开发人员模式”。
2. 点击“加载解压缩的扩展”，选择本目录。
3. 打开扩展的“详细信息 → 扩展选项”，填入 API 端点、Key 和模型。
4. 保存设置并允许 API 域名权限；点击“测试连接”。
5. 打开普通网页，点击扩展图标，再点击“沉浸式翻译当前网页”。
6. 需要便捷划词时，勾选“在此网站启用划词翻译按钮”，允许本站访问权限。随后选中文字，点击附近的“翻译”按钮即可；Esc 关闭。仅选择文字不会发送请求。

站点开关会保留到下次访问，权限按当前 HTTP/HTTPS 协议和主机匹配，包括该主机的所有端口。关闭开关会停用已加载页面中的按钮，并取消后续自动加载；如需撤销保留的站点权限，可在 Edge 扩展设置中操作。

扩展无法向 `edge://` 页面、内置 PDF 阅读器、Edge 加载项商店等保护页面注入网页翻译界面。浏览器打开的 PDF 可以通过扩展弹窗的“PDF / 文档左右对照”进入独立文档阅读器。

## PDF、Word 和文本沉浸式翻译

### 配置方案与快速试用

在设置页的“保存的配置方案”中选择历史方案，修改后点击“保存设置”应用；“另存为新方案”会保留之前的方案。打开设置时，原有已配置的连接会先保留到方案列表。删除正在使用的方案也会清空其当前连接密钥，其他方案中的 Key 不受影响。所有方案及密钥仅保存在此浏览器本地，不同步到 GitHub，也不记录翻译内容历史。

无需 Key 的体验入口是“启用 MyMemory 基础试用”，首次需允许其 API 域名。默认 English → 简体中文，其他语言需手动设置源语言。它提供翻译记忆匹配与机器翻译，匿名额度通常为每天 5000 字符；请求会按单段、480 UTF-8 字节拆分，段落标记在本地保留，不调用公开贡献/上传接口，也不会在失败时暗中切换服务。文字通过 HTTPS 查询参数发送，服务商可能长期保留，请使用非私密短文试用。没有承诺完全不限量的免费公共 API。长文请使用自己的 API 或自托管兼容服务。详见 [MyMemory 额度](https://mymemory.translated.net/doc/usagelimits.php)和[条款/隐私说明](https://mymemory.translated.net/terms-and-conditions)。

### 文档阅读步骤

1. 在浏览器打开 PDF 后，点击扩展图标 → **PDF / 文档左右对照**，再打开预填的文档链接并允许来源域名。也可使用右键文档入口。登录下载或 blob 临时链接无法加载时，先下载文件，再点击 **打开文件** 或拖入阅读器。
2. 默认 **沉浸原位**：PDF 保持原页比例、图片和图表位置，在原文本区域显示译文。放不下或特殊排版的段落保留原文，点击 ↗ 查看完整译文。点击译文可查看对应原文，**查看原文** 可切换整页。
3. **原版左右对照** 同比例显示原页和译页；**段落对照** 重新排版文字，适合优先阅读内容。DOCX 保留浏览器渲染的页边距、表格、嵌入位图和段落位置；TXT、Markdown 固定阅读段落的位置，Markdown 按纯文本显示。
4. 正文使用当前已配置的传统机器翻译或 AI，选择目标语言后点击 **翻译当前页** 或 **翻译全文**。支持流式显示、同步滚动、停止续译，每个阅读器最多两个并发请求。打开文件本身不发送翻译请求。
5. **导出双语 TXT** 保存正文原文和译文，未翻译部分明确标注。当前不导出保留版式的译后 PDF/DOCX。

### 底部 AI 图文工作流

1. 在 API 设置中保存一个支持图片输入的 OpenAI 兼容配置。正文仍可使用 Google、DeepL、Microsoft、MyMemory 等传统接口。
2. 展开最下方 **AI 图文工作流**，点击 **提取本页图片**。PDF 矢量图表可使用 **框选图表**，也可以 **提取整页**。先预览图片，按需下载或移除；本地提取不调用 API。
3. 在 **图表 AI** 中单独选择已保存的视觉模型配置，点击 **翻译图文并解释** 或 **分析未完成图片**。此时才向所选 AI 发送图片、目标语言和分析指令。结果逐步显示，可停止、重试。

图片最长边限制为 1600 像素，单张编码不超过 4 MB，最多暂存 20 张/24 MB。图片和分析结果只存于当前标签页内存，不进入正文缓存；下载图片和导出 TXT 会保留在下载目录。AI 可能误读文字或数值，请核对原图。此工作流展示文字翻译和解释，不重绘图表，也不把扫描页自动变成原位译文。

最大 25 MB、300 页/阅读分段、100 万提取字符。TXT/Markdown 支持 UTF-8 或带 BOM 的 UTF-16。Word 仅支持 DOCX；浏览器字体和复杂 Word 排版可能与 Microsoft Word 不同，严格保真请先另存 PDF。旧 DOC 请先转为 DOCX。扫描 PDF 的正文原位替换需先 OCR，当前无内置整页 OCR 替换；可将整页图片交给视觉 AI 阅读。复杂多栏、重叠文字、公式及特殊字体可能需段落模式或人工核对。

PDF.js、fflate、docx-preview 和 JSZip 随包提供，在浏览器本地解析文件，无远程可执行代码。正文翻译发送提取文字；底部 AI 分析只在点击后发送所选图片，不上传原始 PDF/DOCX 文件或密码。远程文档下载需来源域名权限，可能携带该站点登录 Cookie。最低要求 Chromium 内核 Edge 125，集成测试使用 Edge 155。许可见 THIRD_PARTY_NOTICES.md。

已有侧载安装更新时，在原目录替换运行文件后，到 `edge://extensions` 点击扩展的“重新加载”，再刷新需要翻译的网页。浏览器中的 API 配置会保留。

## API 配置示例

### Google Cloud Translation v2

```text
接口类型：Google Cloud Translation v2（机器翻译）
端点：https://translation.googleapis.com/language/translate/v2
API Key：Google Cloud API Key（启用 Cloud Translation API）
```

扩展会把 Key 作为 `key` 参数发送，并从 `data.translations[0].translatedText` 读取结果。

### DeepL API

```text
接口类型：DeepL API（机器翻译）
端点：https://api-free.deepl.com/v2/translate
API Key：DeepL API Key
```

免费版使用 `api-free.deepl.com`，专业版通常使用 `api.deepl.com`。扩展使用 `Authorization: DeepL-Auth-Key ...` 请求头和 `translations[0].text` 响应路径。

### Microsoft Translator

```text
接口类型：Microsoft Translator（Azure 机器翻译）
端点：https://api.cognitive.microsofttranslator.com/translate
API Key：Azure Translator Key
Azure 区域：例如 eastus（多区域资源可能需要）
```

### OpenAI 兼容接口

```text
端点：https://api.openai.com/v1/chat/completions
模型：gpt-4o-mini
```

DeepSeek、Moonshot、智谱、通义、硅基流动等服务通常可以填写其 OpenAI 兼容端点和模型名。具体地址、模型名和鉴权方式以服务商文档为准。

如果服务商要求 Responses 协议，请填写完整的 `https://你的服务商域名/v1/responses`。只填写域名或 `/v1` 时，扩展默认使用 Chat Completions，不会自动切换协议。

默认启用流式接收；网关不支持时可以在设置中关闭。Temperature 可留空；仅在接口明确拒绝此参数时去除后重试一次。单次请求超时默认 45 秒，可设置为 10–180 秒。增加超时不会提高模型速度，建议先用“测试连接”检查短文本，再翻译长网页。模型反复破坏段落标记时会停止额外重试，避免大量逐段调用。真实速度仍取决于你使用的模型和网关。

自定义 JSON 示例：

```json
{
  "model": {{model}},
  "prompt": {{text}},
  "source": {{sourceLanguage}},
  "target": {{targetLanguage}}
}
```

响应路径可以填写 `data.translation`、`result` 或 `choices[0].message.content`。模板占位符必须作为 JSON 值使用，扩展会负责 JSON 转义。

## 打包

在 PowerShell 中运行：

```powershell
.\package.ps1
```

打包脚本会先验证 Manifest，再生成 `outputs/qudadflow-translator-v0.6.0.zip` 和独立源码包。可以用 `-OutputDirectory` 指定输出目录。文档库已放入 `vendor/`，不需额外安装依赖；`tools/vendor-document-libs.mjs` 可按固定版本与 SHA512 校验重新下载这些依赖。

## 项目与上架信息

- GitHub 仓库：https://github.com/qudadd/qudadflow-translator
- 项目网站：https://qudadd.github.io/qudadflow-translator/
- 中文使用指南：https://qudadd.github.io/qudadflow-translator/zh-CN.html
- 英文隐私政策：https://qudadd.github.io/qudadflow-translator/privacy.html
- 中文隐私政策：https://qudadd.github.io/qudadflow-translator/privacy.zh-CN.html
- 支持邮箱：lcf1249288484@outlook.com；商店截图位于 `branding/screenshots`。
- 按目标 API 服务商的条款确认用户文本和 Key 的处理方式。
- 使用真实 API 在干净的 Edge 配置中完成侧载验收，再提交商店审核。

详细步骤和审核说明见 `docs/STORE_SUBMISSION.md`。

## 自动功能验证

安装 Playwright（不需要下载额外浏览器），使用本机 Edge：

```powershell
npm install --no-save playwright
node tools/functional-check.cjs functional-results.json
node tools/document-check.cjs document-results.json
node tools/configuration-check.cjs configuration-results.json
node tools/layout-check.cjs layout-results.json
```

0.6.0 的自动检查覆盖网页/接口、文档、配置方案、原位翻译和底部 AI 工作流。测试使用生成文档、虚构 Key、本地模拟接口及独立 Edge 配置，不读取真实用户 API 设置。检查结果不能代表真实服务商速度、额度、可用性或翻译质量。具体结果见 [验证记录](docs/VERIFICATION.md)。

网页面板每次最多翻译 12000 个字符并显示截断提示。沉浸式模式对正文进行有界扫描，每次最多处理视区附近的 80 个正文块，长段落自动拆分。滚动后重新翻译会替换上一轮译文。编辑区域、不可见内容和 translate=no 内容不会被自动提取。

双语阅读会增加段落高度。固定高度、虚拟滚动、内嵌框架、Shadow DOM 等复杂页面仍可能需要专门适配；本版本没有承诺所有网站都保持原高度或布局完全不变。

缓存仅位于服务工作线程内存中，最多 128 条、合计 250000 个字符，复用有效期五分钟；更改配置、缓存淘汰或工作线程退出时移除。不会写入磁盘翻译历史，浏览器可随时结束空闲工作线程，所以缓存不保证保持完整五分钟。连接测试绕过缓存。
