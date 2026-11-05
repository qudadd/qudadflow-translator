# QudadFlow Translator 0.9.6 网页沉浸翻译验证

日期：2026-11-05（Asia/Shanghai）。本轮为本地开发与侧载升级，未提交商店审核或发布 GitHub Release。运行变更限于 `src/content.js` 与 manifest 的两个版本字段；未新增权限或第三方运行依赖。

## 回归结果

以下六份有效报告合计 **254 项通过，0 项失败**。原始报告、网页快照、隔离浏览器配置和截图仅保存在便携工作区 `outputs/dev-runs/immersive-web-20261105/`，不进入源码或运行包。

| 检查 | 报告 | 通过 | 失败 |
| --- | --- | ---: | ---: |
| 网页场景、动态行为与公开网页快照 | `web-validated.json` | 75 | 0 |
| 完整翻译功能回归 | `functional-validated.json` | 126 | 0 |
| 原有沉浸布局回归 | `layout-final.json` | 32 | 0 |
| 浏览器本地翻译模型生命周期 | `offscreen-final.json` | 8 | 0 |
| 缓存、并发去重、取消与权限 | `performance-final.json` | 11 | 0 |
| 真实默认服务与窄屏缓存重译 | `live-final.json` | 2 | 0 |

最后的长段落切分修改后，重新执行了 75 项网页检查和 126 项功能回归。其余报告来自本轮此前完成的相关检查；真实短文均低于切分上限。本轮未重复执行 PDF/图表工作流的完整测试。

另通过 manifest、图标、276 个运行文件、43 个运行脚本语法及本地依赖验证，以及 `git diff --check`。构建与侧载同步使用便携入口，其 ZIP 审计、SHA256 与逐文件比对记录另保存在当次输出目录，历史资产保持原样。

## 网页覆盖

受控布局场景以 390、768、1440 px 三种宽度运行。下列 8 个公开页面保存完整 DOM 后，在 390、1440 px 两种宽度回放，共 16 次；保留样式资源，等待样式及字体加载后检查，不执行捕获的网站脚本。动态网站行为另由受控夹具验证，不能把静态回放称为整站在线测试。

| 网站 | 公开页面 | 主要覆盖 |
| --- | --- | --- |
| MDN | [JavaScript Introduction](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Introduction) | 技术文档、链接、代码 |
| Python | [An Informal Introduction to Python](https://docs.python.org/3/tutorial/introduction.html) | 代码块、行内代码、解释器输出 |
| Wikipedia | [Linear regression](https://en.wikipedia.org/wiki/Linear_regression) | 公式、正文、引用 |
| PubMed | [PMID 42472916](https://pubmed.ncbi.nlm.nih.gov/42472916/) | 论文标题、摘要、元数据 |
| Springer Nature | [s40001-026-04947-z](https://link.springer.com/article/10.1186/s40001-026-04947-z) | 长论文、图注、表格和参考文献 |
| Hacker News | [首页](https://news.ycombinator.com/) | 密集条目与表格布局；嵌套评论另用夹具验证 |
| BBC | [News](https://www.bbc.com/news) | 新闻卡片、多栏、响应式布局 |
| GitHub | [qudadflow-translator](https://github.com/qudadd/qudadflow-translator) | README、代码、交互控件 |

验证内容包括原文/译文配对、原 Text 节点身份、恢复后的完整原始标记、代码/公式/编辑器保护、表格标题、深浅主题、链接和双向文字、隐藏内容、开放 Shadow DOM、同源 iframe、动态展开、节点复用/重排/跨容器移动、状态收起及停止提示。所有回放均未增加原页面的横向溢出；Wikipedia 窄屏原有公式溢出不视为本轮消除。

布局与行为回归使用本地模拟服务，验证扩展行为，不对译文语义评分。长段落新增检查先在旧实现复现截句与 Unicode 代理对拆分，再验证中英文句末、词边界、长度上限及原文不丢失、不重复。中途发现的测试夹具问题（截图对 input 空 style 的影响、长 DOM 截断、字体异步加载）已分别修正，旧报告仍保留。

## 真实翻译抽样

隔离 Edge 使用实际扩展的默认 `auto-machine` 路径，不读取日常浏览器配置或用户 API Key。以上 8 个网页各取一段公开节选，合计 **1,341 字符**；观察到 MyMemory **8 次 HTTP 200**，均返回非空中文且没有批处理标记泄漏。记录耗时约 **3.9 秒**，仅适用于本次小样本，不作为整站或所有服务的性能保证。

第二轮恢复原文，改为 390 px 窄屏再翻译：结果与第一轮一致，**新增 MyMemory 请求为 0**，截图无横向溢出。桌面和窄屏截图已人工查看，完成状态小条正常展示。

抽样仍发现上游语义限制：GitHub 文本中的 `learning from their figures` 被译为“从他们的数据中学习”，`Reflux Finding Score` 的术语表达不理想，纯文本节选中的 `>>>` 被插入空格。本轮未用全局字符串替换掩盖这些问题，也未声称更换翻译模型。真实页面中的代码节点会保留原样；公式保留在原文，译文不会重建公式。

跨域 iframe、关闭的 Shadow DOM 和受保护页面保持原样。测试方法与重跑命令见[网页测试指南](IMMERSIVE_WEB_TESTING.md)，产品变化见[更新说明](RELEASE_NOTES_0.9.6.md)。
