# QudadFlow Translator 0.7.1

Settings can now read the model list from your OpenAI-compatible provider. Search IDs, filter reported text/image capabilities, inspect returned metadata and explicitly choose a model. Missing metadata stays unknown; the extension does not guess vision support, speed, cost or quality from names, select the first entry, or overwrite your existing model.

The responsive settings layout adds section navigation, a clear unsaved-change state and accessible save/test controls. Connection tests use the current draft and a fixed short sentence, bypass the cache and report elapsed time without saving or enabling the draft. Tests do not validate image input. Model discovery requests support cancellation; changing the connection invalidates previous discovery and verification results. API-host grants may persist independently of saving.

Model discovery uses the same-origin models route, with a 15-second deadline, 2 MB response limit and at most 1,000 unique entries. Lists remain only in the settings tab. Error text hides configured credentials. Root-domain endpoint construction now produces valid model and translation routes.

The popup, Settings, English/Chinese READMEs and website include **QQ community: 1048123205**. Search the group number in QQ to join. English and Chinese privacy policies describe model discovery and draft testing. Chrome Web Store submission text is included alongside the Edge update materials; the runtime ZIP is shared by both targets.

Validation: **191 Edge checks passed, zero failures**: 22 model/settings, 87 webpage/provider, 34 document, 13 configuration, 17 layout/figure and 18 research checks. Tests use isolated profiles, synthetic keys and local fixtures. An installed-Chrome attempt timed out waiting for an extension service worker; Chrome behavior and store acceptance remain unverified. Live-provider speed, vision quality and scientific reproduction are not established by these tests.

## 中文说明

设置页新增上游模型读取、ID 搜索、上游已声明的文本/图片能力筛选及元数据详情。必须明确选择模型，不自动选第一项、不覆盖已有模型；缺失信息显示未知，不凭名字猜读图、速度或价格。

设置界面改为分区导航，增加未保存状态、保存/测试操作栏及窄屏布局。连接测试用当前草稿发送固定短句，显示耗时，绕过缓存，不保存或启用草稿，也不验证图片能力。模型读取可取消，连接更改后旧的模型读取和验证结果失效。API 域名授权可独立保留。

模型列表仅保存在当前设置页内存；接口同源、15 秒超时、响应上限 2 MB、最多 1000 个去重模型。错误提示隐藏配置密钥。修复仅填写根域名时模型/翻译路径出现双斜杠的问题。

产品和 GitHub 中英文资料加入 **QQ 交流群：1048123205**，在 QQ 搜索群号加入。同步准备 Edge 更新与 Chrome 商店资料，并补充双语隐私说明。

Edge **191 项检查通过、0 失败**。独立 Chrome 检查未能加载扩展服务工作线程，不能宣称 Chrome 已验收或已上架。模拟接口结果不代表真实服务商速度、质量或图表精确复现。详情见 [验证记录](VERIFICATION.md)。
