# 0.9.7 验证记录

2026-11-06。Windows，隔离的 Microsoft Edge MV3 扩展实例。本轮不访问用户浏览器配置或真实 AI 密钥，不向真实模型发送论文；模拟接口用于验证请求、取消、恢复和界面行为。未把 Chrome 完整扩展兼容性或商店上线计为通过。

共 **212 项通过，0 项失败**（浏览器集成 144 项、quick 56 项、构建 12 项）。运行包语法、依赖及本地英文隐私政策一致性检查通过：277 个运行文件、44 个脚本。

| 检查入口 | 通过 |
| --- | ---: |
| `research-recovery-check.cjs` | 18 |
| `research-companion-check.cjs` | 25 |
| `research-check.cjs` | 19 |
| `research-publisher-check.cjs` | 13 |
| `research-vision-check.cjs` | 25 |
| `research-linked-tables-check.cjs` | 19 |
| `figure-workflow-check.cjs` | 17 |
| `workbench-layout-check.cjs` | 8 |
| portable `Run-Checks.ps1 -Suite quick` | 56 |
| `build-check.mjs` | 12 |

实际打开 [PMC9529820](https://pmc.ncbi.nlm.nih.gov/articles/PMC9529820/)，读取 Figure 1 的可见 DOM 并核对[原始图像](https://cdn.ncbi.nlm.nih.gov/pmc/blobs/8b04/9529820/77b8aba2aadd/nihms-1829635-f0002.jpg)（1050×810）。原图可用；问题来自缩放查看器 HTML 链接查询参数中的 `.jpg` 被误判为图片。测试使用该图实际结构、图号和图注，加上本地生成的图片与模拟 API；未检查数值还原或真实模型图表解读质量。

改动前两项回归均失败：Figure 1 选成缩放查看器地址，勾选未加载图片使问答无法发送。改动后覆盖待载入、单图失败、有效图混合、原图重试、图号及完整图注、正文与可用图片继续发送，以及模型请求中的未提供图片声明。

恢复检查覆盖重复入口不新增窗口；刚输入即关闭可恢复最后草稿；关闭重开恢复材料编辑、草稿、对话、图片、选择和 Python 代码；中途关闭保留部分回答且不自动重试；不同查询参数不串页；原文刷新后重新绑定；完整浏览器重启恢复。保存失败仍可提问，恢复磁盘写入后可再次保存；本页清除后重新打开为空记录。另检查旧版临时提取缓存重新解析、无效快照拒绝、20 份容量淘汰和到期拒绝读取。其他测试覆盖图片 MIME/签名、原站权限、表格重试、流式错误、取消、脚本惰性处理和 PDF/Word/TXT/Markdown 共用工作台。

390、760、1440 像素问答布局及既有工作台视口检查无横向页面溢出。截图内容为模拟论文回答，保留在仓库外工作区 `outputs/dev-runs/pmc-recovery-20261105/`；最终 JSON 报告以 `0.9.7-` 为前缀，quick 报告由 portable 入口单独生成。旧失败报告保留用于对照，不合并计入最终通过数。

本版目前为本地修复，商店状态以 0.9.6 独立发布记录为准。已丢失的旧版窗口内容无法追溯恢复；网页自动恢复从本版开始保存，本地文档阅读器关闭后的完整会话尚不持久化。
