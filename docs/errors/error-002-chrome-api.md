# Chrome API 错误记录

## 错误类型
1. 权限错误 (PERM)
2. API 调用错误 (API)
3. 事件处理错误 (EVENT)
4. 存储错误 (STORAGE)

## 详细说明

### 1. 权限错误
- **错误码**: PERM_001
- **描述**: 缺少必要权限
- **原因**:
  - manifest 配置不完整
  - 权限声明错误
  - CSP 配置问题
- **解决方案**:
  - 检查 manifest.json
  - 更新权限声明
  - 配置正确的 CSP

### 2. API 调用错误
- **错误码**: API_001
- **描述**: API 调用失败
- **原因**:
  - API 初始化问题
  - 参数类型错误
  - 异步调用问题
- **解决方案**:
  - 确保正确初始化
  - 验证参数类型
  - 使用 Promise 包装

### 3. 事件处理错误
- **错误码**: EVENT_001
- **描述**: 事件监听异常
- **原因**:
  - 重复注册监听器
  - 内存泄漏
  - 生命周期问题
- **解决方案**:
  - 统一事件管理
  - 及时清理监听器
  - 正确处理生命周期

### 4. 存储错误
- **错误码**: STORAGE_001
- **描述**: 存储操作失败
- **原因**:
  - 配额超限
  - 数据格式错误
  - 并发访问问题
- **解决方案**:
  - 实现数据分片
  - 验证数据格式
  - 添加并发控制

## 实现方案

### 1. 权限管理
```typescript
class PermissionManager {
  static readonly REQUIRED_PERMISSIONS = [
    'bookmarks',
    'storage',
    'alarms'
  ];

  async checkPermissions(): Promise<boolean> {
    const permissions = await chrome.permissions.getAll();
    return this.REQUIRED_PERMISSIONS.every(
      p => permissions.permissions?.includes(p)
    );
  }

  async requestPermissions(): Promise<boolean> {
    return chrome.permissions.request({
      permissions: this.REQUIRED_PERMISSIONS
    });
  }
}
```

### 2. 事件管理
```typescript
class EventManager {
  private listeners = new Map<string, Set<Function>>();

  addListener(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  removeListener(event: string, callback: Function): void {
    this.listeners.get(event)?.delete(callback);
  }

  clearListeners(event: string): void {
    this.listeners.delete(event);
  }
}
```

### 3. 存储管理
```typescript
class StorageManager {
  private static readonly CHUNK_SIZE = 8192;

  async saveData(key: string, data: any): Promise<void> {
    const chunks = this.splitIntoChunks(JSON.stringify(data));
    const updates: { [key: string]: string } = {};
    
    chunks.forEach((chunk, index) => {
      updates[`${key}_${index}`] = chunk;
    });
    
    await chrome.storage.sync.set(updates);
    await chrome.storage.sync.set({
      [`${key}_meta`]: { chunks: chunks.length }
    });
  }

  private splitIntoChunks(str: string): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < str.length; i += this.CHUNK_SIZE) {
      chunks.push(str.slice(i, i + this.CHUNK_SIZE));
    }
    return chunks;
  }
}
```

## 预防措施

### 1. 开发阶段
- 权限检查
- 类型验证
- 错误处理

### 2. 测试阶段
- 功能测试
- 边界测试
- 性能测试

### 3. 运行阶段
- 错误监控
- 性能监控
- 用户反馈

## 最佳实践

1. **权限管理**
   - 最小权限原则
   - 动态请求权限
   - 权限状态检查

2. **事件处理**
   - 统一管理监听器
   - 防止内存泄漏
   - 错误边界处理

3. **存储优化**
   - 数据分片存储
   - 缓存机制
   - 定期清理 