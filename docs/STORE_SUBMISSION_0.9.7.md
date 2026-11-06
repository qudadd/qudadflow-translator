# 0.9.7 三平台发布记录

2026-11-06，实际发布观察。GitHub 已发布，Chrome 已提交审核，Edge 尚未上传本版。提交审核与公开上线分别记录。

| 平台 | 0.9.7 状态 | 本次观察到的公开版本 |
| --- | --- | --- |
| [GitHub Release](https://github.com/qudadd/qudadflow-translator/releases/tag/v0.9.7) | 已公开发布；四个附件远端 digest 与本地 SHA256 逐一一致 | 0.9.7 |
| [Chrome Web Store](https://chromewebstore.google.com/detail/dfecnbleolbeddoflpfmailolehhnaih) | 0.9.7 待审核；通过后自动发布已勾选，后台包修订号 00008 | 0.9.6 |
| [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/nichpjndbjbcfkcbanfcfogpkdhblghh) | 尚未上传 0.9.7；现有后台草稿包仍为 0.9.6，上传受浏览器连接器文件权限限制 | 0.9.6 |

Manifest 内部版本与显示版本均为 0.9.7。Chrome 上传与 GitHub 使用同一运行 ZIP；Edge 待使用同一文件，不另建平台变体。正式构建保存在本地 outputs/dev-builds/release-0.9.7-20261106/。

| 附件 | SHA256 |
| --- | --- |
| qudadflow-translator-v0.9.7.zip（277 文件，3,261,698 字节） | bbfb4c73d40259a68c80dfec5ebae94476a16c9b0aa75e18a41ef808e5251319 |
| qudadflow-translator-source-v0.9.7.zip（928 文件，37,727,153 字节） | 50a86d8c70374757c4a21e4f21599b6486cf7f20b94b44313b460643157e1efb |
| qudadflow-package-validation-v0.9.7.json | 9a1c8d6a52bb572bb79753ad028700781bddc85a54539c5d89cabe6c77f950c7 |
| SHA256SUMS-v0.9.7.txt | 5fdcea1d1c686fba60cc6595c7e24f03de195031b401e3330c180349bb681c2f |

发布标签指向 f6d20ed585aa7acbae03e9a9fe38ac323ed3079b。附件冻结为该次发布构建；后续仅在主分支补充实际观察记录，不移动标签或替换发布附件。源码包包含发布准备时的状态，最新结果以本页为准。独立 Windows 连接程序沿用 [0.9.2](https://github.com/qudadd/qudadflow-translator/releases/tag/v0.9.2)，本版不新增权限或第三方运行依赖。

论文深度处理的中英文商店简介沿用 [0.9.5 正文](STORE_PRESENTATION_0.9.5.md)。Chrome 英文正文仍显示 7,444 字符；本次审核说明已保存为 476 字符的 0.9.7 测试要点。Edge 1,476 字符审核说明已备好，尚未提交。中英文项目网站的 0.9.7 下载/功能介绍及两种语言隐私页均实际 HTTP 200，包含新增网页工作区存储范围。

本版包含 PMC Figure 1 原图提取、坏图与正文问答隔离、同一网页窗口复用及工作区恢复、可折叠且可调整高度的对话区、断流部分回答保留与显式重试，以及发送后立即清空提问框。恢复仅覆盖网页论文；完整文档会话不持久化。见[更新说明](RELEASE_NOTES_0.9.7.md)、[基线验证](VERIFICATION_0.9.7.md)和[问答补充验证](VERIFICATION_0.9.7_CHAT.md)。

基线 212 项、后续问答 180 项各自保留；最终输入框调整另复测 28 项，发布快速检查 56 项通过、0 失败，不与重叠报告累加。模拟 API 测试验证行为，不代表真实上游可用性或模型回答质量。源码及包审计覆盖 277 个运行文件、44 个自有脚本。

Edge 处理过程：内置后台重新验证会话时曾出现微软登录服务 ERR_CONNECTION_CLOSED。用户随后在现有 Edge 浏览器完成登录并打开 Packages 页面；点击 Replace 后，浏览器连接器拒绝 setFiles，要求在 ChatGPT 扩展详情开启 Allow access to file URLs。尝试正常系统文件选择框时，Computer Use 因无法足够可靠确认当前浏览器 URL 而停止；没有继续输入，也没有把文件选择或草稿当成成功提交。本版仍待 Edge 上传及提交审核。

私有账号截图、GitHub 附件校验、网站校验和本地发布记录位于源码仓库外 outputs/dev-runs/store-submission-0.9.7-20261106/。Chrome 截图显示“待审核”、草稿 0.9.7、已发布 0.9.6。本页不包含账号登录状态、令牌或密钥。
