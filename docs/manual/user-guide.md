# 书签同步功能用户手册

## 功能概述

SyncTags 是一个 Chrome 扩展，可以帮助你将 Chrome 书签同步到 GitHub。支持两种存储模式：
- **Repository 模式**：将书签保存在 GitHub 仓库中
- **Gist 模式**：将书签保存在 GitHub Gist 中

主要功能：
- 手动/自动同步书签
- 多设备书签合并
- 冲突检测和解决
- 同步历史记录
- 书签变更监控

## 使用前准备

### 1. GitHub 配置

1. 登录 GitHub 账号
2. 创建访问令牌：
   - 访问 Settings -> Developer settings -> Personal access tokens
   - 点击 "Generate new token"
   - 选择权限：
     - Repository 模式：需要 `repo` 权限
     - Gist 模式：需要 `gist` 权限
   - 生成并保存 token

### 2. 选择同步模式

根据需求选择合适的同步模式：

**Repository 模式**：
- 优点：
  - 完整的版本控制
  - 可以查看历史记录
  - 支持分支管理
- 适合：
  - 需要详细同步历史
  - 团队共享书签
  - 大量书签管理

**Gist 模式**：
- 优点：
  - 设置简单
  - 轻量级存储
  - 快速同步
- 适合：
  - 个人使用
  - 书签数量较少
  - 简单同步需求

## 基本配置

### 1. 初始设置

1. 点击扩展图标，打开设置面板
2. 输入 GitHub token
3. 选择同步模式：
   - Repository 模式：
     - 输入仓库所有者
     - 输入仓库名称
     - 选择分支（默认 main）
   - Gist 模式：
     - 输入已有 Gist ID 或创建新的 Gist

### 2. 同步设置

配置同步选项：
- 自动同步：开启/关闭
- 同步间隔：设置检查更新的时间间隔
- 冲突处理：选择默认的冲突解决策略
  - 使用本地版本
  - 使用远程版本
  - 手动合并

## 使用说明

### 1. 手动同步

1. 点击扩展图标
2. 点击"立即同步"按钮
3. 等待同步完成
4. 查看同步结果

### 2. 自动同步

1. 在设置中开启自动同步
2. 设置同步间隔时间
3. 扩展会在后台自动执行同步
4. 可以通过图标状态查看同步状态

### 3. 查看同步状态

图标状态说明：
- 🟢 绿色：同步正常
- 🟡 黄色：正在同步
- 🔴 红色：同步错误
- ⚪ 灰色：未配置

### 4. 处理冲突

当检测到冲突时：
1. 会弹出冲突解决对话框
2. 显示本地和远程的差异
3. 选择解决方案：
   - 使用本地版本
   - 使用远程版本
   - 手动合并
4. 确认后完成同步

## 常见问题

### 1. 同步失败

可能原因：
- Token 无效或过期
- 网络连接问题
- 权限不足
- 配置错误

解决方法：
1. 检查 Token 是否有效
2. 确认网络连接
3. 验证权限设置
4. 重新配置同步设置

### 2. 数据丢失

预防措施：
- 定期备份
- 保持同步记录
- 使用版本控制

恢复方法：
1. 查看同步历史
2. 选择要恢复的版本
3. 执行恢复操作

### 3. 同步很慢

优化建议：
- 减少同步频率
- 清理无用书签
- 选择合适的存储模式
- 检查网络状况

## 故障排除

### 1. 诊断步骤

1. 检查配置
   - Token 是否有效
   - 权限是否正确
   - 模式配置是否完整

2. 查看错误日志
   - 打开开发者工具
   - 查看 Console 面板
   - 分析错误信息

3. 网络诊断
   - 测试网络连接
   - 检查 GitHub API 访问
   - 验证代理设置

### 2. 常见错误码

| 错误码 | 说明 | 解决方法 |
|-------|------|---------|
| AUTH_001 | Token 无效 | 重新配置 Token |
| AUTH_002 | Token 过期 | 更新 Token |
| NET_001 | 网络错误 | 检查网络连接 |
| NET_003 | 请求限制 | 稍后重试 |
| SYNC_001 | 数据冲突 | 手动解决冲突 |

## 安全建议

### 1. Token 管理

- 定期更新 Token
- 使用最小权限
- 不要分享 Token
- 及时撤销无用 Token

### 2. 数据安全

- 开启自动备份
- 定期检查同步状态
- 保护敏感书签
- 注意权限设置

## 联系支持

如果遇到问题：
1. 查看在线文档
2. 提交 Issue
3. 发送邮件到支持邮箱
4. 加入用户群获取帮助

项目地址：[GitHub Repository](https://github.com/your-username/synctags)

## 更新日志

### v1.0.0
- 初始版本发布
- 支持基本同步功能
- 实现 Repository 和 Gist 模式

### v1.1.0
- 添加自动同步
- 优化冲突处理
- 改进错误提示

### v1.2.0
- 添加多设备支持
- 优化同步性能
- 改进用户界面 