# QudadFlow Translator 0.9.5 验证

日期：2026-11-03（Asia/Shanghai）。本版运行文件仅修改 `manifest.json` 的版本字段及 `_locales/en/messages.json`、`_locales/zh_CN/messages.json` 的产品摘要，其余为 README、网站及发布说明调整。

构建使用便携入口进行源码、暂存目录和 ZIP 的版本、清单、语法、依赖及逐文件审计；结果随正式资产公开。本地解压版通过备份后同步并逐文件核对。中英文完整说明和摘要分别检查长度，并在商店保存后读取核对。

本轮不重复执行研究／翻译功能的完整浏览器回归；运行代码和依赖未改动。已有功能检查及其模拟接口、真实模型质量的证据范围见 [0.9.4 验证](VERIFICATION_0.9.4.md)和 [0.9.3 验证](VERIFICATION_0.9.3.md)。正式构建、同步与实际送审结果见[发布记录](STORE_SUBMISSION_0.9.5.md)，未完成步骤不视为已通过。
