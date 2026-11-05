# QudadFlow Translator 0.9.6 扩展网页测试

日期：2026-11-05（Asia/Shanghai）。本轮在[第一轮 254 项检查](VERIFICATION_0.9.6.md)后，扩大网站、语言、屏幕宽度和压力场景，并修复新增发现。本版仍为本地开发版本，未发布 GitHub Release 或提交商店审核。

## 结果与范围

本轮选取的有效报告合计 **643 项通过，0 项失败**。覆盖 22 个公开页面快照、66 次三视口回放，另访问 12 个真实在线页面：**11 页通过，PubMed 因 HTTP 403 无法测试**。网页获取阶段另有 10 个来源不可用，均保留失败原因，不计入通过项。

| 检查 | 通过 | 失败 | 本地报告 |
| --- | ---: | ---: | --- |
| Edge 受控布局与动态行为 | 224 | 0 | `edge-fixtures-navigation.json` |
| 22 页快照 × 3 视口 | 66 | 0 | `navigation-corpus/report.json` |
| Chrome 内容脚本 DOM 兼容性 | 144 | 0 | `chrome-dom-navigation.json` |
| 完整翻译功能回归 | 126 | 0 | `functional-navigation.json` |
| 原有沉浸布局回归 | 32 | 0 | `layout-navigation.json` |
| 缓存、并发、取消与权限 | 11 | 0 | `performance-final.json` |
| 本地模型生命周期 | 8 | 0 | `offscreen-final.json` |
| 默认服务的语言分流与并发 | 17 | 0 | `machine-language-concurrency.json` |
| 多语言扩展集成（模拟响应） | 2 | 0 | `multilingual-mock-concurrency/report.json` |
| 八语言真实服务与缓存重译 | 2 | 0 | `multilingual-live-concurrency/report.json` |
| 真实在线页面（模拟译文） | 11 | 0 | `online-validated.json` |

同一测试场景的中途失败与定点重测不重复计入以上汇总。BBC 在线检查先复现 390 → 464 px 的横向溢出，并通过恢复原文回到 390 px 确认与扩展有关；修复后真实在线复测通过。完整原始失败报告与诊断仍保留，最终在线汇总注明来源报告。

受控布局在 320、390、768、1440、1920 px 下运行；状态小条另覆盖 280 px。快照在 320、768、1440 px 下使用约原字符数 1.6 倍的模拟中文译文，检验文本增长。测试还包括 1,100 段含链接/代码的长文、快速复用评论节点、在途请求变化、重复恢复与重译、Shadow DOM、iframe、Ruby 注音、代码、公式、隐藏内容及表格跨度。

Edge 使用实际 MV3 扩展和后台，Chrome 使用真实内容脚本配合模拟消息桥，仅验证 DOM/布局兼容性。已安装 Chrome 在该隔离测试方式下没有产生扩展 worker，失败探测单独保留，不能声称 Chrome 完整扩展集成通过。观察版本：Edge 156.0.4314.58，Chrome 156.0.8078.80。

## 公开页面

| 页面 | 来源 | 回放宽度（px） |
| --- | --- | --- |
| mdn | [公开来源](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Introduction) | 320 / 768 / 1440 |
| python | [公开来源](https://docs.python.org/3/tutorial/introduction.html) | 320 / 768 / 1440 |
| wikipedia | [公开来源](https://en.wikipedia.org/wiki/Linear_regression) | 320 / 768 / 1440 |
| pubmed | [公开来源](https://pubmed.ncbi.nlm.nih.gov/42472916/) | 320 / 768 / 1440 |
| springer | [公开来源](https://link.springer.com/article/10.1186/s40001-026-04947-z) | 320 / 768 / 1440 |
| hackernews | [公开来源](https://news.ycombinator.com/) | 320 / 768 / 1440 |
| bbc | [公开来源](https://www.bbc.com/news) | 320 / 768 / 1440 |
| github | [公开来源](https://github.com/qudadd/qudadflow-translator) | 320 / 768 / 1440 |
| numpy | [公开来源](https://numpy.org/doc/stable/user/absolute_beginners.html) | 320 / 768 / 1440 |
| scikit | [公开来源](https://scikit-learn.org/stable/modules/linear_model.html) | 320 / 768 / 1440 |
| pandas | [公开来源](https://pandas.pydata.org/docs/user_guide/10min.html) | 320 / 768 / 1440 |
| scipy | [公开来源](https://docs.scipy.org/doc/scipy/tutorial/stats.html) | 320 / 768 / 1440 |
| mathjax | [公开来源](https://docs.mathjax.org/en/latest/basic/mathematics.html) | 320 / 768 / 1440 |
| jupyter | [公开来源](https://docs.jupyter.org/en/latest/) | 320 / 768 / 1440 |
| rfc | [公开来源](https://www.rfc-editor.org/rfc/rfc9110.html) | 320 / 768 / 1440 |
| whatwg | [公开来源](https://html.spec.whatwg.org/multipage/tables.html) | 320 / 768 / 1440 |
| w3c | [公开来源](https://www.w3.org/WAI/tutorials/tables/) | 320 / 768 / 1440 |
| nature | [公开来源](https://www.nature.com/articles/s41586-021-03819-2?error=cookies_not_supported&code=1c572308-f7ff-4b5c-b758-003f3a0549eb) | 320 / 768 / 1440 |
| plos | [公开来源](https://journals.plos.org/plosone/) | 320 / 768 / 1440 |
| pmc | [公开来源](https://pmc.ncbi.nlm.nih.gov/articles/PMC7092803/) | 320 / 768 / 1440 |
| mdn-fr | [公开来源](https://developer.mozilla.org/fr/docs/Web/JavaScript/Guide/Introduction) | 320 / 768 / 1440 |
| mdn-ja | [公开来源](https://developer.mozilla.org/ja/docs/Web/JavaScript/Guide/Introduction) | 320 / 768 / 1440 |

快照不执行网站脚本，保留已序列化样式及远端样式资源；CSSOM 动态样式可能缺失，BBC 第一轮 DOM 快照即有此限制。因此另对 MDN 英/法/日、Python、NumPy、pandas、scikit-learn、MathJax、W3C、GitHub、BBC 等进行实际在线验证，保留各站脚本与样式。BBC 首访存在条款/隐私浮层，测试没有接受条款，检查针对其公开页面背景内容；不能视为已验证该浮层的翻译或交互。

## 发现并修复

- 多行省略和固定高度卡片挡住译文时，临时释放高度/行数限制，并按引用关系撤销标记；原来的水平裁切和可滚动容器保留，作者期间修改的样式在恢复后保留。
- flex/grid 译文所属元素可收缩。页脚中超出视口且比父容器宽的 flex/grid 祖先按需限制宽度，避免 BBC 不收缩的页脚项被译文撑宽；不对所有祖先强制改宽。
- Ruby 的 `rt/rp` 注音不发送给整页翻译，正文仍成句；对 `clip:rect(...)` 与 `clip-path:inset(50%)` 等视觉隐藏标签保持原样，避免将屏幕阅读器专用文字展开到可见页面。
- NumPy 截图发现固定高度导航加入译文后把原菜单文字挤出可见区域。具有固定/吸附定位的语义导航及含导航的页头保留原布局；普通文档流导航、文章标题继续参与翻译。回归检查固定导航的原始标记及几何完全一致，也检查切换定位后能移除/恢复译文。
- 原文插入新短语后使旧记录失效，旧请求的迟到响应不能重新插入。网页删除已完成译文时重新生成，恢复不残留孤立节点。
- 默认机器翻译对同批多语言段落分别识别源语言，保持标记、进度、顺序、取消和缓存；同语言批次及显式指定源语言保持批处理。发现两个页面请求各自并行拆分会产生 4 个提供方操作后，改为每个请求内依次处理多语段落，沿用页面最多两个请求的限制。将浏览器返回的 `iw/in/ji` 规范为 `he/id/yi`。

最后补充固定导航保护后，重跑 Edge/Chrome 扩展矩阵、22 页快照矩阵、12 个在线页面、完整 126 项功能检查和 32 项原有布局检查。未重复执行 PDF/图表流程完整测试。

## 真实翻译

8 个明确标记的生成样例，英语、法语、德语、日语、韩语、阿拉伯语、希伯来语、俄语合计 **858 字符**。新隔离 Edge 走真实默认 auto-machine 服务，观察到 8 次 MyMemory HTTP 200，源语言对分别正确；均返回非空中文并保留配对，没有批处理标记泄漏。整轮抽测约 8.0 秒，包含恢复和窄屏重译，仅代表这些短句。

恢复后在 390 px 重译，结果一致，新增 MyMemory 请求为 0。另两项模拟响应集成检查使用实际浏览器语言检测，17 项本地路由检查验证分流、进度、错误、取消与两个父请求的并发。最后调整仅涉及多语拆分的执行顺序，已重跑这些检查及八语言真实抽测；网页采集/布局实现未再变更。生成样例不是论文原文，中文存在和请求成功不等于专业术语、所有语言或复杂语义已通过评审；第一轮记录的术语限制仍成立。

## 本地交付

生产运行文件变更为 manifest 的两个版本字段、`src/content.js` 和 `src/machine-translation.js`；权限、第三方运行依赖、PDF/图表实现与独立连接程序版本未增加或升级。构建和侧载使用便携入口，旧资产和旧侧载目录先保留/备份，新运行包仍为 276 项。新构建目录为 `outputs/dev-builds/release-v0.9.6-20261105-expanded/`，审计和 SHA256 随包保存。

私有快照、截图、浏览器配置与诊断均在源码仓库外的 `outputs/dev-runs/immersive-expanded-20261105/`。`index.html` 为可读报告，`summary.json` 提供报告哈希和构建清单。重跑方式见[网页测试指南](IMMERSIVE_WEB_TESTING.md)。
