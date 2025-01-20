# OAuth重定向错误记录

## 问题描述
在GitHub OAuth认证过程中遇到重定向URI不匹配的问题。GitHub提示"The redirect_uri is not associated with this application"。

## 错误原因
1. OAuth应用配置中的重定向URL与实际使用的URL不匹配
2. 扩展ID在不同环境下可能变化，导致重定向URL不一致
3. manifest.json中的权限配置不完整

## 解决方案

1. OAuth配置修正
   - 在GitHub OAuth应用设置中更新重定向URL
   - 使用正确的扩展ID构建URL：`https://<extension-id>.chromiumapp.org/`

2. 代码改进
   - 动态获取扩展ID：`chrome.runtime.id`
   - 构建正确的重定向URL
   - 添加错误重试机制
   - 完善错误处理和日志

3. 权限配置
   - manifest.json中添加identity权限
   - 配置正确的CSP策略

## 最终解决
1. 动态构建重定向URL：
   ```typescript
   this.redirectUrl = `https://${chrome.runtime.id}.chromiumapp.org/`;
   ```

2. 添加重试机制：
   ```typescript
   let retryCount = 0;
   const maxRetries = 3;
   while (retryCount < maxRetries) {
     try {
       // 认证流程
     } catch (error) {
       retryCount++;
       // 等待后重试
     }
   }
   ```

3. 完善错误处理：
   - 添加详细的错误日志
   - 实现token验证
   - 改进错误提示

## 经验总结
1. OAuth应用配置需要随环境变化而更新
2. 扩展ID应该动态获取而不是硬编码
3. 认证流程需要完善的错误处理和重试机制
4. 详细的日志记录对调试至关重要

## 相关文档
- 功能任务：001-f-bookmark-sync.md
- 检查点：checkpoint-007.md
- GitHub文档：Chrome Identity API 