# 网页沉浸翻译测试

便携开发包根目录提供专用入口：

```powershell
pwsh -NoProfile -File development/Run-Checks.ps1 -Suite immersive
```

该入口检查常规布局、新增网页场景与缓存/请求合并，使用隔离 Edge 配置和本地模拟翻译服务。不会读取日常浏览器配置、登录会话或用户 API 密钥。

完整公开网页回放可另外传入私有输出目录中的快照集：

```powershell
pwsh -NoProfile -File development/Run-Checks.ps1 -Suite immersive -WebCorpusDirectory outputs/dev-runs/immersive-web-20261105/corpus
```

快照目录的 `index.json` 是 `{id,url}` 数组，每项对应一个 `id.html`。保存完整 DOM 时要核对长度，长字符串可能被浏览器观察工具截断；分块保存并核对实际长度。回放不执行网站脚本，保留已序列化的样式资源；仅通过 CSSOM 动态插入且未序列化的样式可能缺失，不能代替完整在线页面验证。动态行为另用可控夹具验证。快照、浏览器配置、截图和诊断位于源码仓库外，运行安装包不包含它们。

覆盖论文正文/引用/图注、表格标题、文档代码、公式、新闻卡片、嵌套评论、深浅主题、双向文字、链接、编辑器、隐藏内容、开放 Shadow DOM、同源 iframe、展开和节点复用。另检验中英文长句切分、词边界、Unicode 字符、状态收起和任务停止提示。检查段落数量、原文/译文配对、标记清理、正文节点身份、布局宽度及恢复后的完整原始标记。固定/吸附语义导航检查原始标记及几何不变，定位切换后重新判断翻译资格，普通文章标题和文档流导航仍参与。默认新增布局场景在 390/768/1440 px 下运行，真实网页快照在 390/1440 px 下运行；比较宽度前等待样式与字体就绪。扩展测试采用更多宽度，见下表。

真实默认服务测试需要明确传入公开短文样本并加 `--live`，不会作为常规测试自动执行：

```powershell
$env:PLAYWRIGHT_MODULE = (Resolve-Path development/test-dependencies/node_modules/playwright).Path
node work/edge-web-translator/tools/immersive-live-check.cjs outputs/dev-runs/live-report.json outputs/dev-runs/immersive-web-20261105/corpus/live-samples.json --live
```

样本是 `{id,url,text}` 数组，最多 12 项、每项 400 字符、合计 4,000 字符；使用用户已选择的公开节选。通过实际扩展的默认 auto-machine 路径进行英译中，再恢复并在窄屏重译，检查完整结果能否复用缓存。测试不代表整站真实翻译、所有语言或真实 AI 提供方的质量评估。

生成的非敏感样例显式标记为 `{id,kind:"generated",language,text}`，可省略 URL；界面和报告会注明其来源。传 `--mock` 时拦截 MyMemory 响应并使本地模型不可用，仅验证实际扩展、浏览器语言检测、请求语言对及缓存，不消耗真实服务。`tools/machine-language-check.mjs` 另检查多语言分流、标记、进度顺序、错误及取消；常规回归不会自动发送真实翻译请求。

扩展矩阵可通过环境变量配置（均为当次进程选项）：

| 选项 | 用途 |
| --- | --- |
| `QF_WEB_WIDTHS=320,390,768,1440,1920` | 受控布局视口；状态控件额外覆盖 280 px |
| `QF_WEB_CORPUS_WIDTHS=320,768,1440` | 公开网页快照视口 |
| `QF_WEB_EXPANSION=1.6` | 快照使用约原字符数 1.6 倍的模拟译文，检验文本增长；不是语言质量评估 |
| `QF_WEB_CASE=正则表达式` | 定点重测名称匹配的场景 |
| `QF_WEB_BROWSER=chrome`、`QF_WEB_DOM_ONLY=1` | Chrome 实际内容脚本配合模拟消息桥，验证 DOM/布局；不验证其扩展装载或后台集成 |

独立在线检查显式访问提供的公开网站，使用新 Edge 配置和临时扩展权限，保留网站脚本/样式并由本地模拟服务提供译文。生产 manifest 不增加权限。来源不可用和访问挑战单独记录，不绕过，也不计为通过：

```powershell
$env:PLAYWRIGHT_MODULE = (Resolve-Path development/test-dependencies/node_modules/playwright).Path
node work/edge-web-translator/tools/immersive-online-check.cjs outputs/dev-runs/online-report.json path/to/public-sites.json --online
```

站点清单是 `{id,url,width?}` 数组，最多 24 项，仅 HTTPS；建议使用无登录的论文和技术文档。在线检查保存译文数量、样式表数、原始/翻译后宽度、保护节点及恢复结果。网站自身脚本可独立修改 DOM，恢复后的全量 markup 相等由受控场景与静态快照验证，在线页面不据此作保证。

翻译质量与页面适配分别记录。保留代码和公式、修复错位、避免重复发送，是扩展侧可以验证的行为；专业术语、句义、语气取决于服务与模型。0.9.6 的默认服务抽样仍发现 `figures` 译为“数据”、`Reflux Finding Score` 术语表达不理想，未用全局字符串替换掩盖这些问题。跨域 iframe、关闭的 Shadow DOM 和受保护页面保持原样。

作者名单专项用例通过 `QF_WEB_CASE='paper authors:'` 运行，可同时设置 `QF_WEB_WIDTHS`。模拟 PubMed/Springer/Wiley 及 schema.org 名单、单位上标、ORCID、共同/通讯作者标记、原作者链接、隐藏后展开、重排/移动、在途改动、240 位作者和中英文混合名单。检查原名单内不插入逐人块状译文，完整译文配在名单下方，并保持原始标记、源文本节点、链接及原来的作者行布局。

论文快照额外保存作者名单及各姓名相对位置，检查恢复前后原名单、可见性和行布局；不把隐藏节点的零面积矩形当作实际姓名位置。自适应容器末尾的空白宽度可随布局变化，实际姓名位置和行高需要保持。在线检查另核对原名单标记和内部译文数量。作者姓名的译名质量仍由提供方决定，本轮专项未使用真实服务评估人名译名，见[专项验证记录](VERIFICATION_0.9.6_AUTHORS.md)。
