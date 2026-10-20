# QudadFlow Translator（Microsoft Edge 扩展）

这是一个纯原生 Manifest V3 扩展，可在 Microsoft Edge 中侧载，也可整理后上传到 Microsoft Edge 加载项商店。它可以直接调用用户配置的 Google Cloud Translation、DeepL API、Microsoft Translator，也支持 OpenAI 兼容的 Chat Completions 和自定义 JSON 接口。

## 当前功能

- 翻译网页中的选中文本（弹出窗口、右键菜单、`Alt+Shift+T` 快捷键）。
- 翻译当前网页文本，并在页面右上角显示可复制的译文面板。
- 沉浸式翻译：按网页段落在原文下方插入译文，支持一键恢复原文。
- 沉浸式翻译也可通过右键菜单或 `Alt+Shift+I` 快捷键触发。
- 直接机器翻译：Google Cloud Translation v2、DeepL API、Microsoft Translator。
- 配置 API 端点、API Key、模型、源/目标语言、温度、自定义请求头。
- OpenAI 兼容模式和自定义 JSON 模式。
- API 域名使用可选权限：保存端点时只请求该端点所在的域名。
- 不加载远程脚本，不使用广告或遥测。

## 在 Edge 中测试

1. 打开 `edge://extensions`，开启“开发人员模式”。
2. 点击“加载解压缩的扩展”，选择本目录。
3. 打开扩展的“详细信息 → 扩展选项”，填入 API 端点、Key 和模型。
4. 保存设置并允许 API 域名权限；点击“测试连接”。
5. 打开普通网页，选中文本后点击扩展图标，或使用右键菜单翻译。

扩展无法注入 `edge://` 页面、Edge 加载项商店页面或其他浏览器内部页面，这是浏览器平台限制。

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

打包脚本会先验证 Manifest，再生成 `outputs/qudadflow-translator-v0.4.1.zip` 和独立源码包。可以用 `-OutputDirectory` 指定输出目录。

## 项目与上架信息

- GitHub 仓库：https://github.com/qudadd/qudadflow-translator
- 项目网站：https://qudadd.github.io/qudadflow-translator/
- 英文隐私政策：https://qudadd.github.io/qudadflow-translator/privacy.html
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

测试使用本地模拟 API、虚构 Key 和独立浏览器配置。浏览器集成测试只给测试副本加入 localhost 权限，正式 Manifest 保留可选主机权限。真实服务商的账号、额度、网络可达性和翻译质量仍需使用自己的 Key 验证。

网页面板每次最多翻译 12000 个字符并显示截断提示。沉浸式模式每次最多处理 80 个正文块，长段落自动拆分。编辑区域、不可见内容和 translate=no 内容不会被自动提取。
