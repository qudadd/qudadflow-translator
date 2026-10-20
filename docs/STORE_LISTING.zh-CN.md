# Edge 商店简体中文说明

名称：QudadFlow Translator

语言：Chinese (Simplified) / zh-CN

## 简短描述

使用自己的 Google、DeepL、Microsoft 或兼容 API 翻译网页，支持划词翻译、沉浸式双语阅读与一键恢复原文。

## 详细描述

QudadFlow Translator 是一款适用于 Microsoft Edge 的网页翻译扩展。使用你自行配置的翻译 API，翻译选中文字、查看网页译文，或在原文段落下方显示译文，进行双语对照阅读。

主要功能：
• 划词翻译：选中文字后，通过扩展弹窗、右键菜单或快捷键发起翻译。
• 网页翻译面板：在页面中查看译文，支持复制结果。
• 沉浸式翻译：逐段在原文下方显示译文，支持一键恢复原文。
• 多种翻译接口：Google Cloud Translation v2、DeepL API、Microsoft Translator、OpenAI 兼容 Chat Completions 和自定义 JSON API。
• 自定义连接：按接口要求配置端点、API Key、模型、语言、区域、请求模板、请求头及响应路径。

使用方法：
1. 安装后打开扩展设置，选择接口类型，并填写服务商提供的端点与 API 凭据。
2. 保存设置并允许访问该 API 域名，点击“测试连接”。
3. 打开普通网页，使用弹窗或右键菜单翻译；沉浸式阅读结束后可恢复原文。

隐私与费用：
翻译仅在你主动操作后开始。API Key、端点、模型和语言设置保存在浏览器本地；待翻译文本及必要鉴权信息直接发送至你配置的 API。QudadFlow Translator 不运营翻译代理，不包含广告、分析、遥测或远程可执行代码。沉浸式译文插入网页后，网页脚本可能读取这些译文。

请自备有效的 API 凭据。扩展不附带翻译服务订阅；账号、额度、费用、数据保留和翻译质量由你选择的第三方服务商决定。使用前请阅读相应服务商的条款和隐私政策，并选择可信的 HTTPS 端点。当前扩展操作界面为简体中文。

使用范围：
浏览器内部页面及 Edge 商店等受保护页面无法翻译。网页面板每次最多提取 12,000 个字符并显示截断提示；沉浸式翻译每次最多处理 80 个正文块。

中文指南：https://qudadd.github.io/qudadflow-translator/zh-CN.html
隐私政策：https://qudadd.github.io/qudadflow-translator/privacy.zh-CN.html
支持邮箱：lcf1249288484@outlook.com

## 搜索关键词

网页翻译、沉浸式翻译、划词翻译、DeepL、自定义 API

## 0.4.2 更新说明

新增简体中文商店简介、中文使用指南与中文隐私政策。统一保留 QudadFlow Translator 英文名称，补充中英文本地化安装包元数据。
