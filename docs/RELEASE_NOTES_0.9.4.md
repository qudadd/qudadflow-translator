# QudadFlow Translator 0.9.4

0.9.3 的 `manifest.version` 是 0.9.3，但 `version_name` 遗留为 0.9.2，导致 Chrome 开发者后台仍显示 0.9.2。0.9.4 将内部版本和显示版本统一为 0.9.4，保留此前已发布的 0.9.3 标签和附件。

- 源码验证及 ZIP 审计均拒绝与内部版本不一致的显示版本。
- 构建回归加入旧显示版本场景，验证会在覆盖已有安装包之前拒绝错误版本。
- 包含 0.9.3 的原生图表解析浮窗、Python/R 分页、独立代码框、共享图形规格与样式试跑；不新增权限，Windows 连接程序仍使用 0.9.2。

[图表流程](FIGURE_REPRODUCTION.md) · [验证记录](VERIFICATION_0.9.4.md) · [发布状态](STORE_SUBMISSION_0.9.4.md)
