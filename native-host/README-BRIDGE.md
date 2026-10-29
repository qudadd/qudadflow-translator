# QudadFlow Translator · ChatGPT 本地连接程序（Windows x64）

只有在扩展中主动选择“ChatGPT 计划（官方授权，预览）”时才需要安装此程序。默认机器翻译与自备 API 无需安装。此 ZIP 包含经 Node.js 官方 SHA256 校验的 Windows x64 运行时、QudadFlow 本机程序及按当前 Windows 用户安装的脚本。连接程序尚未签名，浏览器更新只会提示安装，不会代为执行。

1. 解压 ZIP，双击 `Install-Bridge.cmd`。安装器在当前用户目录保存程序并注册 Edge、Chrome 的正式扩展 ID，无需管理员权限。不要直接在 ZIP 内运行。
2. 回到 QudadFlow 设置页，点击“重新检测”，然后自行在 OpenAI 官方页面完成授权。账号密码、Cookie 和 API Key 不交给扩展。
3. 若需要卸载，请先在扩展设置页退出已授权账号，再双击 `Uninstall-Bridge.cmd`。卸载保留加密账号记录；也可在 ChatGPT 设置中撤销远程授权。

OpenAI 开源接入文档目前只明确列出符合资格的 Plus / Pro 可使用计划额度。Team / Business 成员自己的额度能否用于此接入尚未得到官方确认；若官方页面提示组织未启用应用，停止重复授权并保留错误码与 Request ID。详见[项目安装与限制说明](https://github.com/qudadd/qudadflow-translator/blob/main/docs/CHATGPT_LOGIN.md)。

连接程序将 OAuth 凭据保存在 Windows DPAPI 保护的当前用户文件中，通过官方 `https://api.openai.com/v1/responses` 请求模型。此包仅支持 Windows x64；安装包中的 Node.js 许可证见 `NODE_LICENSE.txt`。可用发布页的 SHA256 校验整个 ZIP；包内 `bridge-manifest.json` 记录各文件摘要。
