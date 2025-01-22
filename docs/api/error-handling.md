# 错误处理文档

## 错误类型定义

### 基础错误类型

```typescript
/**
 * 同步错误基类
 */
class SyncError extends Error {
  constructor(
    message: string,    // 错误消息
    public code: string,// 错误代码
    public context?: any// 错误上下文
  ) {
    super(message);
  }
}
```

### 认证错误

```typescript
/**
 * GitHub 认证相关错误
 * 错误代码格式: AUTH_XXX
 */
class AuthError extends SyncError {
  static readonly INVALID_TOKEN = 'AUTH_001';  // Token 无效
  static readonly TOKEN_EXPIRED = 'AUTH_002';  // Token 已过期
  static readonly NO_TOKEN = 'AUTH_003';       // 未设置 Token
  static readonly SCOPE_ERROR = 'AUTH_004';    // Token 权限不足
}
```

### 网络错误

```typescript
/**
 * 网络请求相关错误
 * 错误代码格式: NET_XXX
 */
class NetworkError extends SyncError {
  static readonly REQUEST_FAILED = 'NET_001';  // 请求失败
  static readonly TIMEOUT = 'NET_002';         // 请求超时
  static readonly RATE_LIMIT = 'NET_003';      // 请求频率限制
  static readonly API_ERROR = 'NET_004';       // API 调用错误
}
```

### 配置错误

```typescript
/**
 * 配置相关错误
 * 错误代码格式: CFG_XXX
 */
class ConfigError extends SyncError {
  static readonly INVALID_CONFIG = 'CFG_001';  // 配置无效
  static readonly MISSING_FIELD = 'CFG_002';   // 缺少必填字段
  static readonly TYPE_ERROR = 'CFG_003';      // 字段类型错误
  static readonly VALUE_ERROR = 'CFG_004';     // 字段值错误
}
```

### 同步错误

```typescript
/**
 * 同步过程相关错误
 * 错误代码格式: SYNC_XXX
 */
class SyncError extends SyncError {
  static readonly CONFLICT = 'SYNC_001';       // 数据冲突
  static readonly MERGE_FAILED = 'SYNC_002';   // 合并失败
  static readonly DATA_ERROR = 'SYNC_003';     // 数据错误
  static readonly VERSION_ERROR = 'SYNC_004';  // 版本不兼容
}
```

## 错误处理示例

### 基本错误处理

```typescript
try {
  await syncService.sync();
} catch (error) {
  if (error instanceof AuthError) {
    switch (error.code) {
      case AuthError.INVALID_TOKEN:
        // 处理无效 token
        break;
      case AuthError.TOKEN_EXPIRED:
        // 处理过期 token
        break;
      default:
        // 处理其他认证错误
    }
  } else if (error instanceof NetworkError) {
    switch (error.code) {
      case NetworkError.TIMEOUT:
        // 处理超时
        break;
      case NetworkError.RATE_LIMIT:
        // 处理频率限制
        break;
      default:
        // 处理其他网络错误
    }
  } else {
    // 处理其他错误
  }
}
```

### 配置验证错误处理

```typescript
try {
  await configService.validateConfig();
} catch (error) {
  if (error instanceof ConfigError) {
    switch (error.code) {
      case ConfigError.MISSING_FIELD:
        const field = error.context.field;
        console.error(`缺少必填字段: ${field}`);
        break;
      case ConfigError.TYPE_ERROR:
        const { field, expected, actual } = error.context;
        console.error(`字段 ${field} 类型错误: 期望 ${expected}, 实际 ${actual}`);
        break;
      default:
        console.error(`配置错误: ${error.message}`);
    }
  }
}
```

### 同步冲突处理

```typescript
try {
  await syncService.sync();
} catch (error) {
  if (error instanceof SyncError && error.code === SyncError.CONFLICT) {
    const { local, remote } = error.context;
    // 显示冲突解决对话框
    const resolution = await showConflictDialog(local, remote);
    if (resolution === 'useLocal') {
      await syncService.sync({ force: true });
    } else if (resolution === 'useRemote') {
      await syncService.sync({ pull: true });
    } else {
      // 取消同步
    }
  }
}
```

### 全局错误处理

```typescript
class ErrorHandler {
  static handle(error: Error): void {
    if (error instanceof SyncError) {
      // 记录错误日志
      console.error(`[${error.code}] ${error.message}`, error.context);
      
      // 显示错误通知
      chrome.notifications.create({
        type: 'basic',
        title: '同步错误',
        message: error.message,
        iconUrl: 'icons/error.png'
      });
      
      // 更新状态
      syncService.updateStatus({
        status: 'error',
        lastError: error
      });
    }
  }
}

// 注册全局错误处理
window.onerror = (message, source, line, column, error) => {
  ErrorHandler.handle(error);
};

// 注册未捕获的 Promise 错误处理
window.onunhandledrejection = (event) => {
  ErrorHandler.handle(event.reason);
};
```

## 错误代码表

| 错误类型 | 错误代码 | 说明 | 处理建议 |
|---------|---------|------|---------|
| AuthError | AUTH_001 | Token 无效 | 重新获取 token |
| AuthError | AUTH_002 | Token 过期 | 刷新 token |
| AuthError | AUTH_003 | 未设置 Token | 提示用户配置 |
| AuthError | AUTH_004 | Token 权限不足 | 检查 token 权限 |
| NetworkError | NET_001 | 请求失败 | 检查网络连接 |
| NetworkError | NET_002 | 请求超时 | 重试或增加超时时间 |
| NetworkError | NET_003 | 请求频率限制 | 降低请求频率 |
| NetworkError | NET_004 | API 调用错误 | 检查 API 参数 |
| ConfigError | CFG_001 | 配置无效 | 检查配置格式 |
| ConfigError | CFG_002 | 缺少必填字段 | 补充必填信息 |
| ConfigError | CFG_003 | 字段类型错误 | 修正字段类型 |
| ConfigError | CFG_004 | 字段值错误 | 修正字段值 |
| SyncError | SYNC_001 | 数据冲突 | 解决冲突 |
| SyncError | SYNC_002 | 合并失败 | 手动合并 |
| SyncError | SYNC_003 | 数据错误 | 检查数据格式 |
| SyncError | SYNC_004 | 版本不兼容 | 升级版本 | 