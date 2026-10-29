# QudadFlow Translator · ChatGPT 本地连接程序（Windows x64）

只有在扩展中主动选择“ChatGPT 计划（官方授权，预览）”时才需要安装此程序。默认机器翻译与自备 API 无需安装。0.9.1 提供独立 EXE 安装器和 ZIP 手动安装包，两者均包含经 Node.js 官方 SHA256 校验的 Windows x64 运行时。连接程序尚未签名。扩展更新后会征求用户是否下载，浏览器不能运行下载的程序。

1. 从 [v0.9.1 发布页](https://github.com/qudadd/qudadflow-translator/releases/tag/v0.9.1)核对 SHA256。若选择 EXE，下载完成后在浏览器下载列表打开它；安装器会验证内置文件、自动解压并安装到当前用户目录，注册 Edge 和 Chrome 的正式扩展 ID，无需管理员权限。Windows 可能要求安全确认。若选择 ZIP，完整解压后双击 `Install-Bridge.cmd`，不要直接在 ZIP 内运行。
2. 回到 QudadFlow 设置页，点击“重新检测”，然后自行在 OpenAI 官方页面完成授权。账号密码、Cookie 和 API Key 不交给扩展。
3. 若需要卸载，请先在扩展设置页退出已授权账号，再从 ZIP 包运行 `Uninstall-Bridge.cmd`。卸载保留加密账号记录；也可在 ChatGPT 设置中撤销远程授权。

OpenAI 开源接入文档目前只明确列出符合资格的 Plus / Pro 可使用计划额度。Team / Business 成员自己的额度能否用于此接入尚未得到官方确认；若官方页面提示组织未启用应用，停止重复授权并保留错误码与 Request ID。详见[项目安装与限制说明](https://github.com/qudadd/qudadflow-translator/blob/main/docs/CHATGPT_LOGIN.md)。

连接程序将 OAuth 凭据保存在 Windows DPAPI 保护的当前用户文件中，通过官方 `https://api.openai.com/v1/responses` 请求模型。此包仅支持 Windows x64；安装包中的 Node.js 许可证见 `NODE_LICENSE.txt`。发布页列出 EXE 与 ZIP 的 SHA256；内置 `bridge-manifest.json` 记录各文件摘要。
