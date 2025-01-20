# Chrome扩展开发中的CSP和日志记录问题

## 问题描述

在开发过程中遇到了以下主要问题：

1. 内容安全策略（CSP）错误
   - 最初在 `manifest.json` 中使用了不安全的CSP设置：`unsafe-inline` 和 `unsafe-eval`
   - 在HTML中使用了内联脚本，违反了Chrome扩展的安全策略
   - webpack配置中尝试修改CSP，导致扩展无法加载

2. 日志输出问题
   - 最初使用了过于复杂的日志系统（Logger类）
   - 日志输出不稳定，没有考虑到Chrome扩展的特殊环境
   - 多次修改日志实现方式，导致代码不稳定

## 尝试过的无效解决方案

1. 修改CSP配置
   - 尝试添加 'unsafe-inline'（失败：违反Chrome扩展策略）
   - 尝试添加 'unsafe-eval'（失败：违反Chrome扩展策略）
   - 尝试添加 'wasm-unsafe-eval'（失败：无效）

2. 修改Logger实现
   - 实现复杂的日志系统（失败：过度设计）
   - 添加时间戳和上下文信息（失败：增加复杂性）
   - 实现日志转发到background页面（失败：增加复杂性）
   - 简化为基础console API（失败：仍然无输出）

3. HTML和脚本修改
   - 添加内联脚本测试（失败：违反CSP）
   - 添加debug.js单独调试（失败：增加复杂性）
   - 修改脚本加载顺序（失败：无效）

4. webpack配置修改
   - 修改sourcemap配置（失败：无效）
   - 禁用代码压缩（失败：无效）
   - 修改脚本注入方式（失败：无效）

## 成功的解决方案

1. 创建专门的调试页面
   - 实现独立的debug/index.html页面
   - 使用DOM API直接显示日志
   - 重写console方法以捕获所有日志
   - 提供清除和自动滚动功能

2. 配置要点
   - manifest.json中添加debug页面到web_accessible_resources
   - webpack配置中添加debug入口和HTML插件
   - 保持基本的CSP配置：`script-src 'self'; object-src 'self'`

3. 使用方法
   - 通过 `chrome-extension://<扩展ID>/debug/index.html` 访问调试页面
   - 在调试页面中可以直接测试功能
   - 所有console输出都会显示在页面上
   - 支持查看详细的JSON数据

4. 优点
   - 不依赖Chrome开发者工具
   - 提供可视化的日志界面
   - 支持持久化查看
   - 便于分享和记录问题

## 经验教训

1. 遵循Chrome扩展的安全最佳实践
   - 避免使用内联脚本
   - 不使用不安全的CSP选项
   - 正确配置manifest.json

2. 保持简单原则
   - 在调试阶段使用简单直接的日志方式
   - 避免过度工程化的日志系统
   - 确保基础功能正常后再添加高级特性

3. 调试策略
   - 创建专门的调试工具和页面
   - 使用可视化的方式展示信息
   - 保持开发和调试环境的分离

## 后续改进方向

1. 添加日志级别过滤
2. 添加日志搜索功能
3. 支持日志导出和保存
4. 添加网络请求监控
5. 添加性能分析工具 