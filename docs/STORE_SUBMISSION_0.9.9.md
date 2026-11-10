# 0.9.9 三平台发布记录

2026-11-10，实际发布观察。此版修复 Chrome **Red Titanium** 指出的 PDF.js 协议拼接写法，主模块与 worker 同步改为完整字符串与可读变量。GitHub 已公开；Chrome 和 Edge 已使用同一份运行 ZIP 提交审核。提交与审核通过分别记录。

| 平台 | 0.9.9 状态 | 本次观察到的公开版本 |
| --- | --- | --- |
| [GitHub Release](https://github.com/qudadd/qudadflow-translator/releases/tag/v0.9.9) | 已公开；四个附件的远端 digest 与本地 SHA256 一致 | 0.9.9 |
| [Chrome Web Store](https://chromewebstore.google.com/detail/dfecnbleolbeddoflpfmailolehhnaih) | 重新提交成功；文件包页显示草稿 0.9.9、状态待审核、revision 00010；已勾选通过后自动发布 | 0.9.7 |
| [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/nichpjndbjbcfkcbanfcfogpkdhblghh) | 已提交；概览显示 UPDATE Version 0.9.9、In review | 0.9.8 Live |

内部版本和显示版本均为 0.9.9。三个平台使用同一份经过审计的运行 ZIP；GitHub 附带源码 ZIP、审计和 SHA256 清单。正式资产位于源码仓库外 `outputs/dev-builds/release-0.9.9-20261110-final/`，发布后冻结；历史 0.9.8 标签与附件保持原样。

| 文件 | SHA256 |
| --- | --- |
| qudadflow-translator-v0.9.9.zip（278 文件，3,264,176 字节） | 655bd0501152487ff5270550ebc1350ecefca70408d2a1a5729c9575ab5b4a97 |
| qudadflow-translator-source-v0.9.9.zip（946 文件，37,764,770 字节） | aa157a35cd244c4ea75d9d2ec2609f693517d31e2c3a700d0c84ff02d3db861f |
| qudadflow-package-validation-v0.9.9.json | 96d0301c56ee48ea19020ece5d1963abb5b26f7ca1b6e112d4437f1535c894b4 |
| SHA256SUMS-v0.9.9.txt | be07b6a6e63051965459d4e12ec719dc73e31ad61e2e9040c17ad7de7814aa05 |

发布标签固定在修复提交 `d7160d5`。冻结源码 ZIP 包含提交前的准备记录；本页主分支补充实际结果，不移动标签或替换历史附件。本地解压插件亦已同步并逐文件核对为相同 0.9.9。

Chrome 后台在用户重新验证身份后确认 0.9.8 已于 2026-11-10 被拒；用户邮件提供具体 Red Titanium 引用和被标记代码。修复来源、完整字符串、双模块改动、依赖补丁与回归防护见[代码可读性说明](CHROME_READABILITY_0.9.9.md)。原 PDF.js 版本和许可证保留，PDF 脚本限制与 CSP 不变。

中英文商店简介沿用[0.9.8 英文](store-description-en-0.9.8.txt)和[中文](store-description-zh-0.9.8.txt)，论文深度处理仍为定位。Chrome 已保存 469 字符修复／测试说明；Edge 已填写并提交 1,731 字符认证说明。独立 Windows 连接程序沿用 0.9.2。

[70 项验证](VERIFICATION_0.9.9.md)全部通过，0 失败；另通过 278 个运行文件、45 个自有脚本及两处 PDF.js 模块语法检查。测试使用隔离 Edge 和模拟 API，验证软件行为而非真实模型质量或商店批准。私有截图、发布记录及附件校验保存在 `outputs/dev-runs/pdfjs-readability-0.9.9-20261110/`，不进入公开 Git。
