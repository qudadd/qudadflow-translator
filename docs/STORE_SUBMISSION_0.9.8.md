# 0.9.8 三平台发布记录

后续记录（2026-11-10）：用户提供 Chrome **Red Titanium** 代码可读性拒绝邮件，指出 PDF.js worker 的协议拼接写法；该写法亦存在于主模块。Edge 后台本次刷新后确认 **0.9.8 Live**。修复及新一轮同步发布见 [0.9.9](STORE_SUBMISSION_0.9.9.md)。下文保留首次提交时的观察。

2026-11-10，实际发布观察。GitHub 已公开发布；Chrome 与 Edge 均已上传同一份 0.9.8 运行包并提交审核。提交成功与商店公开上线分别记录。

| 平台 | 0.9.8 状态 | 本次观察到的公开版本 |
| --- | --- | --- |
| [GitHub Release](https://github.com/qudadd/qudadflow-translator/releases/tag/v0.9.8) | 已公开发布；四个附件远端 digest 与本地 SHA256 逐一一致 | 0.9.8 |
| [Chrome Web Store](https://chromewebstore.google.com/detail/dfecnbleolbeddoflpfmailolehhnaih) | 已提交，后台显示“待审核”；审核通过后自动发布，包修订号 00009 | 0.9.7 |
| [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/nichpjndbjbcfkcbanfcfogpkdhblghh) | 已提交，概览显示 UPDATE Version 0.9.8、In review | 0.9.7 |

内部版本和显示版本均为 0.9.8。三个平台使用同一份运行 ZIP；源码 ZIP、包审计及 SHA256 清单一起发布到 GitHub。正式构建目录为源码仓库外 `outputs/dev-builds/release-0.9.8-20261110-final/`，发布后冻结附件，不移动标签或替换历史附件。后续实际结果仅在主分支更新。

| 附件 | SHA256 |
| --- | --- |
| qudadflow-translator-v0.9.8.zip（278 文件，3,263,380 字节） | 925aeab53470dc7b50ce368ed5a3fcded75d5d4c3d2f95321c53c2d28f502aad |
| qudadflow-translator-source-v0.9.8.zip（938 文件，37,753,598 字节） | 84958f2c0ab25e8be3d68ef3417e7c3de737267c2cc5dd847f7486c6a0c12e75 |
| qudadflow-package-validation-v0.9.8.json | 2d40785304585e88b9377d1c85ea4135b91b208f2d1de80ce3b1c5cf1b8c1e8f |
| SHA256SUMS-v0.9.8.txt | d4b942d064ad5fd9c97a179a669749ccc30b0921ce2ff5c1a947569651042e16 |

发布标签固定指向 `3327e6d32aa3f626177c20ba83b07e0e694f35d6`。冻结源码包包含提交前的准备记录；最新提交结果以主分支本页为准。本地解压插件亦已逐文件同步到同一份 0.9.8 运行代码。

本版采用一次性 HTTP/HTTPS 网站授权，沿用既有可选权限，不增加 manifest 权限或运行依赖。授权后仍由用户主动发起翻译或分析；划词按钮保持按站点开关。缺失、拒绝或撤销授权时保留可见重试入口。

网页翻译失败、断流或手动停止后，可点击“继续翻译”，保留完整段落及长段落已完成分块，只重试未完成内容；不自动循环重试。修改服务配置可继续，改变语言或恢复原文会重置对应进度。翻译进度仅存于当前网页内存，刷新或关闭后丢失，区别于既有论文问答的本地工作区保存。恢复原文直接移除译文与翻译面板，不弹出额外结果框。

论文深度阅读、PDF 对照翻译、图表学习及 Python/R 代码仍为介绍重点。两家商店已保存同一份 [英文简介](store-description-en-0.9.8.txt)（8,277 字符）和[中文简介](store-description-zh-0.9.8.txt)（2,885 字符），在 0.9.5 基础上补充网站授权、翻译继续和既有论文窗口恢复说明。两家权限说明均补充一次性授权与内存续译，并区分既有论文工作区存储。Chrome 保存 459 字符测试说明；Edge 提交 1,681 字符认证说明。独立 Windows 连接程序沿用 0.9.2。

中英文项目网站及隐私页均实际返回 HTTP 200，远端内容与本地对应文件逐字节一致，网站已显示 0.9.8。Chrome 后台确认草稿 0.9.8、已发布 0.9.7；Edge 确认新版本 0.9.8 In review、0.9.7 Live。审核完成时间由平台决定。

基线验证及范围见 [VERIFICATION_0.9.8.md](VERIFICATION_0.9.8.md)。发布前恢复检查 14 项、快速检查 56 项分别通过，0 失败；不与既有重叠检查累加。隔离 Edge 与本地模拟 API 验证行为，不代表真实服务商质量或可用性。私有发布截图、校验报告保存在源码仓库外 `outputs/dev-runs/store-submission-0.9.8-20261110/`。
