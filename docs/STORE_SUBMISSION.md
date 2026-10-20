# Microsoft Edge 加载项上架清单

## 当前准备状态（2026 年 10 月 20 日）

0.4.2 运行包已上传至现有 Partner Center 扩展草稿并通过平台包校验。Packages、Availability、Properties、Privacy 和 Store listings 五项均显示完成；英文和简体中文条目均已保存说明、统一英文名称、图标和三张实际扩展截图。当前状态为 In draft，尚未提交审核或在商店发布。

GitHub 源码与网站已公开；中文指南位于 https://qudadd.github.io/qudadflow-translator/zh-CN.html 。0.4.2 已通过 44 项本地模拟 API 与 Edge 集成检查。真实服务商账号、额度、网络可达性、翻译质量及实体键盘快捷键仍需试用验证。

## 已在骨架中落实

- 使用 Manifest V3；新扩展应使用 MV3。官方迁移时间线：<https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/manifest-v3>。
- 使用本地 JavaScript/CSS/HTML，无远程脚本或动态代码执行。
- 页面文本只在用户操作后通过 `activeTab`/`scripting` 读取。
- API 端点使用可选主机权限，用户保存端点时才授权；服务工作线程检查权限后才发请求。
- 内置 Google Cloud Translation v2、DeepL API、Microsoft Translator 三种机器翻译连接器，并保留 OpenAI 兼容和自定义 JSON 接口。
- 沉浸式模式只在用户点击后读取正文段落，把译文作为本地 DOM 文本插入原段落下方，并支持恢复原文。
- 包含图标、选项页、隐私说明和版本号。

## Partner Center 提交流程

Microsoft 的发布文档列出的主流程是：准备可运行原型、创建开发者账号、创建 ZIP 包、检查 Manifest 字段、在 Partner Center 新建扩展、上传包、填写隐私信息、填写各语言商店信息并提交审核。

官方文档：<https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension>。

提交前逐项检查：

1. [x] 已使用登录的 Microsoft Edge Add-ons 开发者账号建立扩展草稿。
2. [x] 运行 `package.ps1`，确认 ZIP 根目录直接包含 `manifest.json`，没有多余的外层目录。
3. [ ] 在 Edge `edge://extensions` 侧载 ZIP 解压内容，验证弹出窗口、设置页、右键菜单、两个快捷键、机器翻译、沉浸式翻译、恢复原文和失败提示。
4. [x] 提供公开 HTTPS 隐私政策 URL：https://qudadd.github.io/qudadflow-translator/privacy.html ，已包含用户确认的联系邮箱。
5. [x] 在 Partner Center 的隐私部分解释：页面文本只在用户操作后发送到用户自己配置的 API；Key 只存于本地；扩展无广告、分析和遥测。
6. [x] 对 `activeTab`、`scripting`、`storage`、`contextMenus` 和可选 API 域名权限逐项写出功能用途。特别说明可选域名权限仅用于调用用户指定的翻译 API。
7. [x] 在远程代码声明中选择不使用远程代码；API 返回内容只作为数据处理，不作为脚本执行。
8. [x] 已准备实际扩展截图、图标、英文描述、支持邮箱及分类/语言资料。翻译截图标明本地模拟 API；不代表已测试真实服务商账号。
9. [x] 检查商店 listing 不包含无法兑现的“官方翻译”“保证准确”等表述；注明第三方 API 费用和隐私政策由服务商决定。
10. [ ] 提交后根据审核反馈更新版本号、变更说明和隐私政策；不要把 API Key、测试账号或真实用户内容放进 ZIP。

## 具体上传步骤

1. 在源代码目录打开 PowerShell，执行 `./package.ps1`，生成 `outputs/qudadflow-translator-v0.4.2.zip`。
2. 用解压工具检查 ZIP 根目录，确认第一层直接有 `manifest.json`、`src/`、`assets/`，不要再套一层项目目录。
3. 打开 Microsoft Edge Add-ons Partner Center，登录开发者账号，进入 Microsoft Edge 扩展管理页面，选择创建新的扩展/提交新包。页面名称可能随 Partner Center 更新略有变化。
4. 上传 `qudadflow-translator-v0.4.2.zip`，等待包校验完成；如果提示权限或 Manifest 问题，先修复后重新运行打包脚本。
5. 填写名称、简短/详细描述、语言、分类、支持邮箱、图标和截图；可直接参考 `docs/STORE_LISTING_DRAFT.md`。
6. 在隐私和数据使用页面填写公开 HTTPS 隐私政策 URL，并说明页面文本只在用户操作后发送到用户自己配置的 API，扩展不保存服务器端副本。
7. 对 `activeTab`、`scripting`、可选 API 域名权限分别填写用途，声明 API Key 只用于用户选择的 Google、DeepL、Microsoft 或其他配置端点。
8. 保存草稿并使用 Partner Center 的验证/预览功能检查 listing；确认没有真实 Key 后提交审核。
9. 审核通过后，后续版本必须递增 Manifest 的 `version`，重新生成新的 ZIP，再从 Partner Center 的现有扩展页面创建更新提交。

## API 与隐私审核注意点

扩展允许用户把翻译请求发送到 Google Cloud Translation、DeepL、Microsoft Translator 或其他自己选择的 HTTP(S) API，因此商店审核时要说明这是产品的核心功能，而不是收集浏览历史。建议在商店描述中明确“用户自行配置 API 端点和 Key；扩展不提供默认代理服务”。如要内置自有代理、账号系统或统计服务，应重新审查权限、隐私政策和数据安全说明。

## 提交包结构

`package.ps1` 只会把运行所需文件放进包：

```text
manifest.json
popup.html / popup.css / popup.js
options.html / options.css / options.js
privacy.html
src/background.js
src/content.js
assets/icon*.png
_locales/en/messages.json
_locales/zh_CN/messages.json
```

开发文档不会进入提交 ZIP，避免把未完成的说明或测试材料当成扩展资源提交。
