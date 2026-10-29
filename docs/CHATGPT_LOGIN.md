# ChatGPT 官方订阅登录 · 0.9.0 预览

0.9.0 增加官方 Sign in with ChatGPT 接入。流程是浏览器扩展 → 本机 Native Messaging 程序 → OpenAI 授权和 Responses API。每位用户通过自己的账号授权；只有获准使用此接入的计划额度时才会调用，不共用管理员账号或 API Key。原有 API 配置仍可在设置中选择。**默认机器翻译无需安装连接程序或登录 ChatGPT**；只有主动选择 ChatGPT 计划时才使用本机程序。

## 为什么需要本机连接程序

官方开源应用授权流程使用 `127.0.0.1` 回调、PKCE 和受保护的本地凭据；访问与刷新令牌不能放在浏览器存储中。Edge 不替扩展安装或管理 Native Messaging 宿主，Windows 需要由安装程序注册宿主清单和允许访问的扩展 ID。因此，当前纯浏览器扩展不能在用户选择 ChatGPT 计划后静默完成宿主安装，也不应读取 ChatGPT 网页 Cookie 或调用内部 `backend-api`。本机程序把令牌留在 Windows DPAPI 保护的文件中，正式推理由官方 `POST /v1/responses` 完成。

0.9.0 提供独立的 Windows x64 连接程序 ZIP，内含经 Node.js 官方 SHA256 核对的运行时，不要求用户预装 Node.js 或从源码运行命令。解压并双击安装脚本即可为当前 Windows 用户注册 Edge、Chrome 正式扩展 ID，无需管理员权限。此 ZIP 尚未进行代码签名；浏览器商店安装扩展后不会自动安装它。参考：[OpenAI 账号与会话](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions)、[OpenAI 模型与推理](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference)、[Edge Native Messaging](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/native-messaging)。

## 当前验证范围

- Windows + Microsoft Edge 的真实本机桥接已连通；独立 Edge 环境已从本地插件目录读取连接状态。官方授权页此前已打开到“欢迎回来 - OpenAI”。
- 已尝试真实组织账号与个人免费账号授权：组织账号在官方页面被工作区策略拒绝；个人免费账号的授权码兑换两次返回 `invalid_grant`。此代码只表示兑换失败，尚不能判断是账号资格、回调、应用注册还是服务端状态所致。随后一个符合资格的个人账号完成授权。本机通过官方模型目录读取到 8 个模型，并使用固定短句完成一次真实文本推理；这不代表已验证图片质量、长期可用性或实际额度上限。
- 0.9.0-dev.7 的回调失败页显示经过筛选的错误码与请求 ID；设置页保留登录错误，并把授权码兑换失败说明为一次未完成的授权。首次注册的授权码兑换失败时，本机加密保存已签发的 client ID；重开设置页会自动选中唯一的“待完成授权”记录，且尊重用户手动选择“添加账号”。再次点击 Continue with ChatGPT 会生成新的 state、nonce、PKCE 和授权码，复用该注册。上一版本失败时没有保存的注册 ID 无法从旧授权码找回。
- 0.9.0-dev.8 修复了真实推理响应缺少 `Content-Type` 时被误判为 `INVALID_RESPONSE` 的问题：按实际 SSE 事件解析，并仍要求 `response.completed` 才算成功。模型目录中输出能力未声明时，文本筛选保留声明了文本输入的模型；读取后将列表滚动到可见位置。ChatGPT 账号和普通 API 都需在列表中手动选中模型，再点击“填入此模型”修改当前模型。
- 0.9.0-dev.9 将 Team / Business 成员的组织策略错误和计划额度资格错误分开提示。设置页的原有账号分区直接解释一次组织级审核、成员各自授权和默认机器翻译的可用性；两种错误均会展开帮助并保留错误码、请求 ID。界面没有按套餐名称提前拦截 Team 账号，是否获准使用此接入以 OpenAI 授权与真实连接测试为准。
- 0.9.0-dev.10 在授权按钮之前醒目说明 Team / Business 额度资格尚无官方确认，并把“应用未列出 External access”的处理写进设置页。组织策略拒绝时提示停止重复授权、保留诊断信息；未修改登录协议、组织策略或默认机器翻译。
- **身份登录与计划额度不同：**[OpenAI 帮助中心](https://help.openai.com/en/articles/20001542-using-your-chatgpt-plan-in-other-apps-and-sites)说明参与应用的 ChatGPT 身份登录不要求 Plus / Pro；[开源接入快速入门](https://developers.openai.com/siwc/quickstart)目前将通过 ChatGPT 计划完成 AI 请求列为符合资格的 Plus / Pro 账号。商业应用的 Go 规则不等同于本开源接入方式。`invalid_grant` 不是明确的会员资格错误码；明确的计划资格错误包括 `subscription_sharing_user_not_eligible`。免费账号可继续使用默认机器翻译。
- 授权协议、凭据保护、流式错误和界面流程通过本地合成数据测试；原有网页、文档、论文与图表功能另做回归验证。
- Chrome 原生桥接、其他操作系统以及签名安装包未做本轮实机验证。GitHub 与两家商店的发布状态分别见 [0.9.0 发布记录](STORE_SUBMISSION_0.9.0.md)，提交审核不代表已上架。

## Team / Business 成员使用自己的额度

ChatGPT Business 成员拥有各自的 ChatGPT Work / Codex 使用额度；这与第三方开源客户端获准调用其额度是两个不同的资格判断。[ChatGPT 定价说明](https://learn.chatgpt.com/docs/pricing)列出 Business 的成员使用限额，[Sign in with ChatGPT 快速入门](https://developers.openai.com/siwc/quickstart)目前只明确列出符合资格的 Plus / Pro 可在开源客户端使用计划额度。因此不能仅凭“Team 成员有个人额度”就宣称本插件已可扣用该额度，也不在客户端按套餐名称直接拒绝成员。

若官方授权页显示 `3p_delegated_access_policy_denied` 或“组织尚未为此应用启用访问权限”，这只表明上游策略阻止本次授权，不能据此判定 Team 套餐一律不具备额度资格。普通成员应停止重复授权，记下错误码、Request ID 和时间；若官方错误页没有返回本地程序，在扩展设置中点击“取消登录”。默认机器翻译仍可使用。

有组织级权限的管理员可在 OpenAI Admin Console 的 **External access** 查看组织默认设置和应用列表。当前用户提供的管理台截图中，“身份”和“已连接的应用”默认已允许，QudadFlow 却不在应用列表；页面没有可直接批准该应用的项目，也没有显示“第三方开源客户端使用成员计划额度”的单独开关。“ChatGPT Ads”设置与此授权无关。此时不要仅为 QudadFlow 放宽全组织默认权限，也不要告知成员管理台已经完成放行。

[动态注册说明](https://developers.openai.com/siwc/token-sharing-open-source/sign-in)指出，首次授权成功后才会签发该用户与工作区绑定的客户端 ID。因此，授权前受阻可能导致应用未出现在列表中；这是推测，不能用截图证明具体拒绝规则。管理员应向 OpenAI 支持确认 Business 成员个人 ChatGPT Work / Codex 额度是否支持这条开源授权路径，以及在应用未列出时如何审核；只有官方确认可用并给出具体设置方式后，再按最小范围配置。每位成员届时仍需自行授权。

提交支持请求时可附上以下信息，不要附密码、Cookie、访问令牌或完整授权网址：

> 应用：QudadFlow Translator，本地开源浏览器扩展及 Native Messaging 程序。使用 Sign in with ChatGPT 动态注册 `dynamic_agent_client`，请求 `openid profile email offline_access resource.invoke chatgpt.tokens.use.direct`。Business / Team 成员希望使用自己的 ChatGPT Work / Codex 额度。官方授权页返回 `3p_delegated_access_policy_denied`；Request ID：`<实际 ID>`；发生时间与时区：`<时间>`。External access 列表未见 QudadFlow；组织默认“身份”和“已连接的应用”为允许。请确认：(1) Business 成员个人额度是否支持此开源接入；(2) 本次请求由哪项策略拒绝；(3) 应用未列出时，管理员应如何以最小范围审批。

若 OpenAI 确认此工作区可用并解决策略拒绝，再让一位普通成员选择“添加账号或工作区并授权”，完成模型读取和固定短句连接测试。只有官方授予计划权限且 Responses 请求成功，才算该成员的额度在此插件可用。若官方返回 `subscription_sharing_user_not_eligible`，按[错误恢复说明](https://developers.openai.com/siwc/token-sharing-open-source/errors-and-recovery)停止重试，不把请求暗中转到付费 API。默认机器翻译仍可免配置使用。已签发的客户端 ID 绑定原工作区；更换工作区时须新建注册，而不是对旧注册反复重新授权。[注册与登录说明](https://developers.openai.com/siwc/token-sharing-open-source/sign-in)

本地代码无法更改 OpenAI 组织策略，也无法把 ChatGPT Work / Codex 中的成员额度自动变成第三方接入权限。本轮未登录组织管理台修改策略，也未用普通 Team 成员账号完成真实额度测试。

## 安装和使用

1. 安装 Edge 或 Chrome 商店版扩展，或从 [GitHub v0.9.0](https://github.com/qudadd/qudadflow-translator/releases/tag/v0.9.0) 获取运行版 ZIP 并加载解压文件夹。设置页选择 **ChatGPT 计划（官方授权，预览）**。默认机器翻译无需继续以下步骤。
2. 仅首次使用 ChatGPT 计划时，点击设置页的[本地连接程序下载](https://github.com/qudadd/qudadflow-translator/releases/download/v0.9.0/qudadflow-chatgpt-bridge-win-x64-v0.9.0.zip)，核对[发布包 SHA256](https://github.com/qudadd/qudadflow-translator/releases/tag/v0.9.0)，完整解压后双击 `Install-Bridge.cmd`。安装程序在当前 Windows 用户目录注册 Edge 与 Chrome 商店版扩展 ID，不需要管理员权限。它是尚未签名的独立 ZIP，浏览器扩展无法替你静默安装。安装或更新前请结束正在进行的登录及翻译。

   从源码侧载时扩展 ID 可能不同。开发者可在源码根目录运行 `powershell -NoProfile -ExecutionPolicy Bypass -File ".\native-host\Install-Bridge.ps1" -ExtensionIds <设置页显示的扩展ID>`；该开发方式需要已有 Node.js 22.14 或更新版本，并保留原安装流程。
3. 返回设置页后点击“重新检测”。连接成功后点击 **Continue with ChatGPT**，在 `auth.openai.com` 官方页面完成登录及额度授权；密码和验证码只在官方页面输入。

   Team / Business 成员授权前先读按钮上方的资格说明。若看到组织策略拒绝页，可返回设置展开“Team / Business 授权失败怎么办？”；官方拒绝页不一定会回调本地程序，此时可取消等待中的登录。不要重复授权，普通成员无需改动管理设置。
   如果页面提示 `invalid_grant`，关闭失败回调页，回到设置确认账号列表已选中“待完成授权”，再点击 **Continue with ChatGPT** 发起一次新授权。不要刷新或重复提交旧回调地址；若使用该记录再次失败，停止重复尝试，保留错误码与请求 ID 供 OpenAI 支持排查。
4. 返回设置后，在同一个“API 方案与模型”分区读取模型，明确选择模型并“填入此模型”，然后点击分区底部的“测试连接”和“保存设置”。连接测试会发送一条固定短句并消耗实际可用额度。阅读页只切换当前账号的模型。
5. 遇到额度限制时，打开 [ChatGPT 用量设置](https://chatgpt.com/settings/usage) 查看额度和应用访问。确认可以继续后点击“管理用量后继续”。扩展不会自动切到 API Key 付费连接。

## 账号和凭据

本机程序位于 `%USERPROFILE%\.qudadflow\Bridge`，加密账号记录位于同级 `ChatGPT\accounts.dpapi`。程序使用 Windows DPAPI CurrentUser 加密，不降级为明文；扩展仅保存账号引用和非敏感模型目录。账号密码、访问令牌及刷新令牌不进入扩展存储、项目源码、日志或发布包。浏览器的官方登录页面由用户自行管理。

多个注册分别保存，首次兑换失败后的待完成注册也保留 client ID；重新登录已有注册会复用该 ID。待完成注册退出时删除本机注册记录；已授权账号退出后清除本机令牌并尝试撤销远程访问。撤销未确认时会明确提示到 ChatGPT 设置断开应用。已授权账号的注册元数据保留用于再次授权。Edge 和 Chrome 的同账号请求通过文件锁串行化；退出账号会中断该注册正在执行的请求。

卸载连接程序：先在设置中退出账号，再打开已解压的连接程序文件夹，双击 `Uninstall-Bridge.cmd`。卸载保留加密账号记录；远程授权可在 ChatGPT 设置中撤销。

## 实现边界

- 官方 OAuth 授权码流程，使用 PKCE S256、state、nonce、本机回调和 JWKS 身份签名验证；本机回调绑定 `127.0.0.1` 随机端口。已登录但只获身份权限的账号重新授权时请求额度授权；明确失效的刷新令牌会清除并要求重新授权，暂时性错误保留凭据。
- 官方模型目录保留服务器顺序，显示 `display_name`，请求使用 `slug`。账号切换会隔离模型目录并取消旧配置下的阅读任务。
- 推理只发送到 `https://api.openai.com/v1/responses`，使用数组形式 input、`store:false`、`stream:true`。不继承自定义端点、API Key、请求头或 temperature。
- 按 SSE 事件解析流式响应，即使上游未提供 `Content-Type`；只把 `response.completed` 视为成功。中断、拒绝授权和额度耗尽均为错误。额度错误后暂停后续同账号任务，手动继续。上游错误保留实际 HTTP 状态、结构化代码、参数、响应体形状和请求 ID 供排查。
- 文本和已支持工作流中的图片走同一接口；最多 4 张图片、合计 12 MB，实际能力以官方模型和服务响应为准。尚未实测真实图片模型质量。
- 当前订阅模式未启用译文缓存，重复翻译可能再次计入额度。模型目录缓存仍按账号隔离。未实现云端账号同步或自动跨账号切换。
- 需要后续验证其他目标账号及应用资格、Chrome 原生桥接、运行时升级和签名安装流程。公开 ZIP 包含经官方校验的 Node.js 24.18.0 Windows x64 运行时。

## 可重复验证

在源码目录执行：

```powershell
node --test tools/chatgpt-host.test.mjs
$env:PLAYWRIGHT_MODULE = '<本地 playwright 模块目录>'
node tools/chatgpt-browser-check.cjs '<项目外测试报告路径>'
node tools/chatgpt-launcher-check.cjs
```

前两项使用合成身份及模拟模型响应；DPAPI、回调 HTTP、本地文件锁和 Edge 界面为真实组件。最后一项只检查已安装启动程序的状态和二进制协议，不登录账号或发起模型请求。另在本机对一个已授权的个人账号读取了真实模型目录，并用固定短句完成一次真实文本推理；不记录账号标识、凭据或译文。

本轮依据的官方协议：[注册与登录](https://developers.openai.com/siwc/token-sharing-open-source/sign-in)、[账号与会话](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions)、[模型与推理](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference)、[流式响应](https://developers.openai.com/api/docs/guides/streaming-responses)、[预览限制](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations)。文档及资格可能调整；其他账号和长期稳定性仍待验证。
