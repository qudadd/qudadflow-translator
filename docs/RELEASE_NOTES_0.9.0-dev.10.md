# QudadFlow Translator 0.9.0-dev.10（本地开发版）

## Team / Business 授权前告知

- 在 Continue with ChatGPT 按钮前显示醒目的资格说明，不增加确认步骤。OpenAI 的开源接入文档目前只明确列出符合资格的 Plus / Pro 可使用计划额度；Team / Business 成员的个人 ChatGPT Work / Codex 额度能否经此授权用于本扩展，仍需官方确认。
- 用户提供的 External access 截图显示 QudadFlow 不在应用列表；组织默认“身份”和“已连接的应用”已允许。该页面没有针对 QudadFlow 的放行项或明确的第三方计划额度开关，因此不建议为此放宽全组织默认权限。官方错误页的 `3p_delegated_access_policy_denied` 是策略拒绝，不能单凭它断定 Team 套餐一律不合格。
- 授权错误提示和帮助改为保留错误码与 Request ID，建议停止重复授权，并由管理员向 OpenAI 确认具体策略、Business 成员额度资格及应用未列出时的审批方式。默认机器翻译保持免配置可用。没有修改 OAuth 协议、令牌存储或请求计费路径。

## 验证与边界

- 隔离 Edge 设置页 19/19 项通过，新增检查授权前告知可见且位于登录按钮之前；策略拒绝后帮助展开、诊断信息保留。桌面与窄屏截图已目视检查。
- 快速检查通过：269 个运行文件、37 个脚本语法、本地依赖校验，以及 18 项 PDF 图表与论文覆盖检查。
- 未修改 OpenAI 管理台策略，也未通过普通 Team / Business 成员账号完成真实第三方额度测试。个人 Pro 账号的真实模型读取和固定短句推理记录属于 0.9.0-dev.8。

这是本地开发版，尚未发布到浏览器商店。管理员排查与支持请求模板见 [ChatGPT 登录说明](CHATGPT_LOGIN.md)。
