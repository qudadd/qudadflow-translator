# QudadFlow Translator 0.9.1 三平台发布记录

记录日期：2026-10-29。用户要求在 Windows 用户同意后尽量减少连接程序安装步骤，同时继续更新 GitHub、Microsoft Edge Add-ons 与 Chrome Web Store。各平台的包准备、上传、提交审核和公开可用状态按实际观察分别记录。

| 平台 | 当前已确认状态 |
| --- | --- |
| GitHub | [v0.9.1 release](https://github.com/qudadd/qudadflow-translator/releases/tag/v0.9.1) 已公开，包含运行 ZIP、源码 ZIP、Windows x64 连接程序 ZIP、独立 EXE、两份校验报告及完整 SHA256 清单。七个附件的服务端大小和摘要均与本地文件一致。 |
| Microsoft Edge Add-ons | 0.9.1 包和中英文商店资料已准备；尚未确认发布者后台状态或提交。 |
| Chrome Web Store | 0.9.1 包和中英文商店资料已准备；尚未确认开发者后台状态或提交。 |

0.9.1 商店版的首次弹窗仅对 Windows x64 询问，用户明确选择才打开安装器下载。浏览器不会运行下载文件，用户还须自己打开；安装器自动校验、解压并注册当前 Windows 用户的 Edge／Chrome 正式扩展 ID。侧载开发版会改为显示针对当前 ID 的命令，避免误装不适用的商店包。安装器未签名，ZIP 手动方式继续提供。默认机器翻译无需本机程序或 AI 账号。OpenAI 开源计划接入文档只明确列出符合资格的 Plus／Pro；Business／Team 成员自己的额度是否可通过此方式使用尚未获官方确认。

商店运行 ZIP 不含 EXE、Node.js 或本机安装脚本；本机程序是单独的 GitHub 附件。审核员资料明确披露 `nativeMessaging` 的可选用途、安装步骤和限制。0.9.1 全套回归位于本地 `outputs/dev-runs/20261029-220700-bb195b4e`：21 份报告、513 项通过、0 项失败。隔离 Edge 的 ChatGPT 界面检查 22／22（包含模拟商店 ID 同意下载分支）、Native Host 测试 29／29、独立安装器自检与负面样本 4／4，全部零失败；安装器自检不运行真实安装 UI 或修改注册。最终 Windows 连接程序 ZIP SHA256 为 `05513281489d0038596aa84b0092a4f74ac8d29659134a436f13c0f321e276c3`，EXE 为 `51f7503622d1034e9271341617b0d28368d89a6e345f5f0fb9acb5d51cf67011`。内置 Node.js 24.18.0 x64 发行 ZIP 与官方 SHA256 `0ae68406b42d7725661da979b1403ec9926da205c6770827f33aac9d8f26e821` 比对通过。隔离测试使用生成页面与合成接口；不证明所有网站或账号可用。

版本标签指向提交 `17c7ae945ab66026e0aea458a534f8c84a9300d0`。发布运行 ZIP SHA256 为 `45ad4b614fbef4d8a7e584f021beb351c52cb6b8b8c35501d29fb7f7c12685a5`，源码 ZIP 为 `78e73ea886391ae8ddbaf319cebfd7a9df2cb0a4c18404d23e584ed07dbac727`。GitHub Pages 对该提交的构建显示 `built`，英文主页、中文主页和隐私页面经隔离 Edge 请求均返回 HTTP 200 且包含 0.9.1。隔离 Edge 从公开 EXE 地址触发了正确文件名的下载事件；文件仍需用户自行打开。版本标签内的发布记录保留准备阶段状态，此处后续提交记录实际发布结果。

[0.9.1 更新说明](RELEASE_NOTES_0.9.1.md) · [安装说明](CHATGPT_LOGIN.md) · [审核员指南](REVIEWER_GUIDE.md) · [商店展示](STORE_PRESENTATION_0.9.1.md)。
