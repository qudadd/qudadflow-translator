# 0.9.2 性能与回归验证

对比基线为 Git 标签 `v0.9.1`，测试不读取真实账号或密钥，不调用真实模型。以下数据来自同一 Windows 机器，耗时受机器负载影响；请求数与资源创建次数比毫秒值更适合重复核对。

| 场景 | 0.9.1 | 0.9.2 |
| --- | --- | --- |
| 后台唤醒，已打开 50 个标签页 | 查询全部标签并注入 50 次 | 不查询、不重复注入 |
| 8 个相同翻译并发请求 | 8 次上游调用、8 次配置读取，204 ms | 1 次上游调用、1 次配置读取，73 ms |
| 同一文本在中、日、中目标语言间切换 | 3 次上游请求 | 2 次上游请求 |
| 网页与文档同时翻译相同 MyMemory 片段 | 2 次请求 | 1 次请求 |
| 同语言方向连续 5 个本地模型任务 | 每次创建、销毁实例 | 创建 1 次并复用 |
| Windows DPAPI 单次读取，中位数（3 次） | PowerShell 辅助进程 1,137 ms | 编译辅助进程 52 ms |
| 相同凭据连续读取 10 次，均使用编译辅助进程 | 解密 10 次，569 ms | 解密 1 次，72 ms |

翻译并发对比使用 40 ms 响应延迟、两个上游处理槽位和 8 ms 配置读取延迟的本地模拟服务。上述翻译耗时不代表真实服务商的推理、网络或限额表现。DPAPI 测试使用真实 Windows 加密机制和合成文字；它测量本机凭据开销，不代表模型响应时间。

## 回归重点

- 重复任务合并后，单个调用方取消不会影响其他调用方；全部取消会中止上游请求。
- 配置、模型、凭据、语言与上下文变化保持隔离；失败和不完整流式结果不缓存，连接测试始终访问上游，权限撤销仍阻止读取缓存结果。
- 模型实例不在两个活动任务间共享；取消、失败及空闲淘汰会释放实例。
- DPAPI 新旧辅助程序双向兼容；损坏和过大输入被拒绝；凭据缓存不共享可变对象，另一进程修改或删除文件会被识别。
- 安装流程验证拒绝下载权限、下载中断、停止等待、兼容连接器复用和安装后自动继续。浏览器测试使用隔离 Edge、模拟商店 ID 和模拟原生端口；没有实际运行下载的 EXE，也未替代商店安装后的现场验收。
- OAuth 身份验证、PKCE、本机回调、刷新轮换、配额暂停和跨浏览器退出由原生宿主回归覆盖。
- 网页布局覆盖深层 DOM、动态内容、Shadow DOM 和 iframe 重载；PDF 连续阅读覆盖原文／译文两侧的快速滚动、页面高度调整和异步布局重建。检查中发现的旧文档节点与滚动事件竞态均已修复。

## 复现

在仓库根目录运行，报告路径选择仓库外的新目录：

```powershell
node tools/performance-check.mjs <baseline-report.json> --baseline
node tools/performance-check.mjs <current-report.json>
node tools/credential-performance-check.mjs <credential-report.json>
node tools/offscreen-translation-check.mjs <local-model-report.json>
node --test tools/chatgpt-host.test.mjs
$env:PLAYWRIGHT_MODULE = '<Playwright 模块目录>'
node tools/chatgpt-browser-check.cjs <browser-report.json>
```

完整网页、沉浸式布局、文档、模型、论文、PDF 和打包回归由便携工作区的 `development/Run-Checks.ps1 -Suite all` 执行。最终完成状态和构建标识见三平台发布记录。
