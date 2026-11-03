# QudadFlow Translator 0.9.5 发布记录

记录日期：2026-11-03（Asia/Shanghai）。用户授权将 GitHub、Chrome 与 Edge 的简介同步调整为论文深度阅读与图表学习定位。Chrome 的简短摘要来自安装包，因此版本与显示版本同步更新为 0.9.5，再上传同一份已审计的运行 ZIP。0.9.4 及以前的标签和发布附件保持原样。

| 平台 | 当前状态 |
| --- | --- |
| GitHub | [v0.9.5 已发布](https://github.com/qudadd/qudadflow-translator/releases/tag/v0.9.5)，发布提交 `24ba831`；四个远端附件的 SHA256 均与本地一致。仓库简介、中英文 README 已同步，双语项目网站已实际打开并确认新介绍上线。 |
| Chrome Web Store | 0.9.5 包及中英文简介已保存、提交审核；后台显示“待审核”，审核通过后自动发布。安装包中的中英文摘要已确认更新。当前线上版本为 0.9.4。 |
| Edge Add-ons | 同一份 0.9.5 包上传后显示 Complete、验证通过；中英文简介已保存并送审，后台显示“Version 0.9.5 / In review”。当前线上版本为 0.9.4。 |
| 本地解压版 | 0.9.5 已备份后同步，276 个运行文件逐文件哈希与正式运行包对应的源码一致。 |

英文完整简介 7,444 字符、简体中文 2,599 字符，均在两家商店保存后重新打开读取，与公开源码正文逐字相等。安装包中的英文摘要 115 字符、中文摘要 62 字符，均在 132 字符限制以内。新介绍突出 PDF 对照阅读、论文证据问答、图表精读和 Python/R 绘图学习，网页沉浸式与划词翻译列为基础能力。

| 正式资产 | 字节数 | SHA256 |
| --- | ---: | --- |
| `qudadflow-translator-v0.9.5.zip` | 3,246,989 | `9eb784eceee6b5ed1fe1a18c43b74be2e6e88d1202b3a3e79df2978b2bffd764` |
| `qudadflow-translator-source-v0.9.5.zip` | 37,638,813 | `d2c8188c4fb214cb3bc8d90d56abe93559a0244a43f20393790ddd1ba285ab66` |

运行包包含 276 个文件，源码包包含 910 个文件；两份 ZIP 的版本、清单、本地引用和逐文件审计均通过。GitHub 同时发布 `qudadflow-package-validation-v0.9.5.json` 与 `SHA256SUMS-v0.9.5.txt`。两家商店使用同一个已校验的运行 ZIP，并分别核对后台版本；商店没有提供可独立核验的原始上传 ZIP 哈希。

上述资产对应发布提交 `24ba831`；此后的实际送审记录更新仅提交到主分支，不改版本标签，也不覆盖附件。后台截图、两家商店说明读取比较、GitHub 资产哈希和本地同步凭据保存在工作区 `outputs/dev-runs/store-introduction-0.9.5-20261103/`，不进入公开仓库。提交审核不代表新版简介已经在商店公开页面上线。

本次只改说明与版本元数据，研究／翻译运行实现、权限和依赖不变。独立 Windows 连接程序沿用 [0.9.2](https://github.com/qudadd/qudadflow-translator/releases/tag/v0.9.2) 资产。[简介正文](STORE_PRESENTATION_0.9.5.md) · [验证范围](VERIFICATION_0.9.5.md)。
