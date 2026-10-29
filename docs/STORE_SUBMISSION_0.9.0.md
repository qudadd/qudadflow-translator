# QudadFlow Translator 0.9.0 三平台发布记录

记录日期：2026-10-29。用户授权将 ChatGPT 官方登录预览与翻译改进一起发布到 GitHub、Microsoft Edge Add-ons 和 Chrome Web Store。各平台的“准备完成”“已上传”“已提交审核”“已公开上架”须按实际观察分别记录。

| 平台 | 当前已确认状态 |
| --- | --- |
| GitHub | 正在准备 v0.9.0 代码、运行 ZIP、源码 ZIP、可选 Windows x64 连接程序 ZIP、逐文件审计与 SHA256。尚未创建 release。 |
| Microsoft Edge Add-ons | 正在准备 0.9.0 包、英文／中文简介与认证说明；尚未确认本轮后台状态或提交。 |
| Chrome Web Store | 正在准备 0.9.0 包、英文／中文简介与审核员说明；尚未确认本轮后台状态或提交。 |

0.9.0 的默认机器翻译不需要 AI 账号。浏览器本地模型不可用时回退到 MyMemory，后者的匿名额度可能按共享网络计数，不承诺每位用户独享。ChatGPT 计划登录是可选预览，Windows x64 用户需要自行安装独立的 Native Messaging 连接程序；浏览器更新无法替用户安装。OpenAI 的开源计划额度文档目前只明确列出符合资格的 Plus／Pro，Business／Team 经此路径的资格尚未确认。个人 Pro 账号曾读取 8 个真实模型并完成一次固定短句推理；这不证明其他账号、真实翻译质量或长期可用性。

本轮本地全套回归位于私有工作包 `outputs/dev-runs/20261029-213156-213313f3`：21 份结果、513 项通过、0 项失败。隔离 Edge 的弹窗与连接设置另有 21／21 项通过；隔离 Chromium 的默认翻译与设置 25／25 项通过，其中包含两次真实 MyMemory 固定短句请求。Chromium 151 的全新配置报告本地英译中模型为 `downloadable`，点击下载后等待 180 秒仍未完成，故本版未验证真实本地模型译文；未准备好的语言方向会立即回退 MyMemory。上述测试不代表每个网站、用户额度或网络条件下的速度与成功率。

商店包新增 `offscreen` 权限：浏览器 Translator API 不能在后台 Worker 中使用，故以扩展隐藏页面处理已准备好的本地模型；该页面的 localStorage 只缓存语言方向可用性。首次下载本地模型需用户在设置页主动点击。新增的 `nativeMessaging` 权限仅用于用户主动选择 ChatGPT 计划后的本地连接。独立连接程序包含官方 Node.js Windows x64 运行时，其发行 ZIP 在打包前与 Node.js 官方 SHA256 对照；本机令牌由 Windows DPAPI 保护。运行版浏览器扩展不含 `node.exe` 或本机可执行文件。商店审核资料明确披露独立安装、额度限制与默认模式。

[更新说明](RELEASE_NOTES_0.9.0.md) · [安装与限制](CHATGPT_LOGIN.md) · [审核员指南](REVIEWER_GUIDE.md) · [商店展示资料](STORE_PRESENTATION_0.9.0.md)。
