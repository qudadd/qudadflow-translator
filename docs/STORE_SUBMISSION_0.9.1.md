# QudadFlow Translator 0.9.1 三平台发布记录

记录日期：2026-10-29。用户要求在 Windows 用户同意后尽量减少连接程序安装步骤，同时继续更新 GitHub、Microsoft Edge Add-ons 与 Chrome Web Store。各平台的包准备、上传、提交审核和公开可用状态按实际观察分别记录。

| 平台 | 当前已确认状态 |
| --- | --- |
| GitHub | 0.9.1 代码、运行 ZIP、源码 ZIP、Windows x64 连接程序 ZIP 与独立 EXE 安装器已完成本地审计；尚未创建 v0.9.1 release。[v0.9.0 release](https://github.com/qudadd/qudadflow-translator/releases/tag/v0.9.0) 已公开。 |
| Microsoft Edge Add-ons | 0.9.1 包和中英文商店资料已准备；尚未确认发布者后台状态或提交。 |
| Chrome Web Store | 0.9.1 包和中英文商店资料已准备；尚未确认开发者后台状态或提交。 |

0.9.1 商店版的首次弹窗仅对 Windows x64 询问，用户明确选择才打开安装器下载。浏览器不会运行下载文件，用户还须自己打开；安装器自动校验、解压并注册当前 Windows 用户的 Edge／Chrome 正式扩展 ID。侧载开发版会改为显示针对当前 ID 的命令，避免误装不适用的商店包。安装器未签名，ZIP 手动方式继续提供。默认机器翻译无需本机程序或 AI 账号。OpenAI 开源计划接入文档只明确列出符合资格的 Plus／Pro；Business／Team 成员自己的额度是否可通过此方式使用尚未获官方确认。

商店运行 ZIP 不含 EXE、Node.js 或本机安装脚本；本机程序是单独的 GitHub 附件。审核员资料明确披露 `nativeMessaging` 的可选用途、安装步骤和限制。0.9.1 全套回归位于本地 `outputs/dev-runs/20261029-220700-bb195b4e`：21 份报告、513 项通过、0 项失败。隔离 Edge 的 ChatGPT 界面检查 22／22（包含模拟商店 ID 同意下载分支）、Native Host 测试 29／29、独立安装器自检与负面样本 4／4，全部零失败；安装器自检不运行真实安装 UI 或修改注册。最终 Windows 连接程序 ZIP SHA256 为 `05513281489d0038596aa84b0092a4f74ac8d29659134a436f13c0f321e276c3`，EXE 为 `51f7503622d1034e9271341617b0d28368d89a6e345f5f0fb9acb5d51cf67011`。内置 Node.js 24.18.0 x64 发行 ZIP 与官方 SHA256 `0ae68406b42d7725661da979b1403ec9926da205c6770827f33aac9d8f26e821` 比对通过。隔离测试使用生成页面与合成接口；不证明所有网站或账号可用。

[0.9.1 更新说明](RELEASE_NOTES_0.9.1.md) · [安装说明](CHATGPT_LOGIN.md) · [审核员指南](REVIEWER_GUIDE.md) · [商店展示](STORE_PRESENTATION_0.9.1.md)。
