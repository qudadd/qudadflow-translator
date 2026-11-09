# 0.9.8 三平台发布记录

2026-11-10，发布准备。实际上传、公开发布与商店审核结果将在操作完成后记录；本文件不将准备状态视为提交成功。

| 平台 | 0.9.8 状态 | 发布前观察到的公开版本 |
| --- | --- | --- |
| [GitHub Release](https://github.com/qudadd/qudadflow-translator/releases/tag/v0.9.8) | 准备发布 | 0.9.7 |
| [Chrome Web Store](https://chromewebstore.google.com/detail/dfecnbleolbeddoflpfmailolehhnaih) | 准备上传、提交审核 | 0.9.7 |
| [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/nichpjndbjbcfkcbanfcfogpkdhblghh) | 准备上传、提交审核 | 0.9.7 |

内部版本和显示版本均为 0.9.8。三个平台使用同一份运行 ZIP；源码 ZIP、包审计及 SHA256 清单一起发布到 GitHub。正式构建目录为源码仓库外 `outputs/dev-builds/release-0.9.8-20261110-final/`，发布后冻结附件，不移动标签或替换历史附件。后续实际结果仅在主分支更新。

本版采用一次性 HTTP/HTTPS 网站授权，沿用既有可选权限，不增加 manifest 权限或运行依赖。授权后仍由用户主动发起翻译或分析；划词按钮保持按站点开关。缺失、拒绝或撤销授权时保留可见重试入口。

网页翻译失败、断流或手动停止后，可点击“继续翻译”，保留完整段落及长段落已完成分块，只重试未完成内容；不自动循环重试。修改服务配置可继续，改变语言或恢复原文会重置对应进度。翻译进度仅存于当前网页内存，刷新或关闭后丢失，区别于既有论文问答的本地工作区保存。恢复原文直接移除译文与翻译面板，不弹出额外结果框。

论文深度阅读、PDF 对照翻译、图表学习及 Python/R 代码仍为介绍重点。0.9.8 中英文简介在 0.9.5 基础上补充网站授权、翻译继续和既有论文窗口恢复说明；独立 Windows 连接程序沿用 0.9.2。

基线验证及范围见 [VERIFICATION_0.9.8.md](VERIFICATION_0.9.8.md)。发布前恢复检查 14 项、快速检查 56 项分别通过，0 失败；不与既有重叠检查累加。隔离 Edge 与本地模拟 API 验证行为，不代表真实服务商质量或可用性。私有发布截图、校验报告保存在源码仓库外 `outputs/dev-runs/store-submission-0.9.8-20261110/`。
