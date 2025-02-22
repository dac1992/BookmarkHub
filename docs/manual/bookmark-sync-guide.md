# 书签同步功能使用手册

## 功能概述
本功能允许用户将 Chrome 浏览器的书签同步到 GitHub，支持 Repository 和 Gist 两种存储模式。

## 使用前准备

### 1. GitHub 配置
1. 创建 GitHub 账号（如果没有）
2. 生成 Personal Access Token
   - 访问 GitHub Settings -> Developer settings -> Personal access tokens
   - 点击 "Generate new token"
   - 选择必要的权限：
     - 对于 Repository 模式：`repo`
     - 对于 Gist 模式：`gist`
   - 生成并保存 token

### 2. 同步模式选择
1. Repository 模式
   - 适合需要版本控制的用户
   - 支持完整的历史记录
   - 可以设置访问权限

2. Gist 模式
   - 适合简单备份需求
   - 操作更加简便
   - 支持快速访问

## 基本配置

### 1. 初始设置
1. 点击扩展图标，打开设置面板
2. 选择同步模式（Repository/Gist）
3. 输入 GitHub Token
4. 根据选择的模式填写其他信息：
   - Repository 模式：
     - 仓库所有者
     - 仓库名称
     - 分支名称
   - Gist 模式：
     - Gist ID（可选）

### 2. 高级设置
1. 自动同步
   - 启用/禁用自动同步
   - 设置同步间隔
2. 同步选项
   - 选择同步范围
   - 设置冲突处理策略
3. 备份设置
   - 配置备份选项
   - 设置保留版本数

## 使用说明

### 1. 手动同步
1. 点击扩展图标
2. 在主面板点击"同步"按钮
3. 等待同步完成
4. 查看同步结果

### 2. 自动同步
1. 在设置中启用自动同步
2. 设置同步间隔时间
3. 保存设置
4. 扩展会在后台自动同步

### 3. 查看同步状态
1. 点击扩展图标
2. 查看最近同步时间
3. 查看同步状态
4. 查看错误信息（如果有）

## 常见问题

### 1. 同步失败
- 检查网络连接
- 验证 GitHub Token
- 确认配置正确
- 查看错误日志

### 2. 配置问题
- Token 无效
  - 重新生成 Token
  - 检查 Token 权限
- 仓库访问失败
  - 检查仓库权限
  - 验证仓库存在

### 3. 数据问题
- 书签丢失
  - 检查同步日志
  - 恢复备份数据
- 数据冲突
  - 选择保留版本
  - 手动解决冲突

## 故障排除

### 1. 错误诊断
1. 查看错误提示
2. 检查错误日志
3. 分析错误原因
4. 按提示解决

### 2. 常见解决方案
1. 重新配置
   - 清除配置
   - 重新设置
2. 重置同步
   - 清除缓存
   - 重新同步
3. 恢复备份
   - 选择备份版本
   - 执行恢复

## 安全建议

### 1. Token 安全
- 妥善保管 Token
- 定期更换 Token
- 设置最小权限

### 2. 数据安全
- 定期备份
- 加密敏感数据
- 控制访问权限

### 3. 使用建议
- 及时更新扩展
- 定期检查同步
- 保持配置最新

## 联系支持
- GitHub Issues
- 电子邮件支持
- 在线文档 