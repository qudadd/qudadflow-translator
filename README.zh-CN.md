# QudadFlow Translator（Microsoft Edge 扩展）

这是一个以沉浸式双语阅读和划词翻译为核心的 Manifest V3 扩展，可在 Microsoft Edge 中侧载。它直接调用用户配置的 Google Cloud Translation、DeepL API、Microsoft Translator，也支持 OpenAI 兼容的 Chat Completions、Responses 和自定义 JSON 接口。0.4.2 已提交商店审核；0.4.4 为独立试用更新，尚未替换审核中的提交。

## 当前功能

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

扩展无法注入 `edge://` 页面、内置 PDF 阅读器、Edge 加载项商店页面或其他浏览器内部页面。当前版本尚未实现专用 PDF 翻译。

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

打包脚本会先验证 Manifest，再生成 `outputs/qudadflow-translator-v0.4.4.zip` 和独立源码包。可以用 `-OutputDirectory` 指定输出目录。

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
```

0.4.4 已通过 87 项本地模拟 API 与 Edge 集成检查，包含嵌套段落、分栏与表格位置、划词浮窗定位、站点开关、流式显示、缓存、取消请求和并发上限。测试使用虚构 Key 和独立浏览器配置，只给测试副本加入 localhost 权限；正式 Manifest 另行验证，保留可选主机权限。真实服务商的账号、额度、网络可达性和翻译质量仍需使用自己的 Key 验证。详见 `docs/VERIFICATION.md`。

网页面板每次最多翻译 12000 个字符并显示截断提示。沉浸式模式对正文进行有界扫描，每次最多处理视区附近的 80 个正文块，长段落自动拆分。滚动后重新翻译会替换上一轮译文。编辑区域、不可见内容和 translate=no 内容不会被自动提取。

双语阅读会增加段落高度。固定高度、虚拟滚动、内嵌框架、Shadow DOM 等复杂页面仍可能需要专门适配；本版本没有承诺所有网站都保持原高度或布局完全不变。

缓存仅位于服务工作线程内存中，最多 128 条、合计 250000 个字符，复用有效期五分钟；更改配置、缓存淘汰或工作线程退出时移除。不会写入磁盘翻译历史，浏览器可随时结束空闲工作线程，所以缓存不保证保持完整五分钟。连接测试绕过缓存。
