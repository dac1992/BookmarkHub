# GitHub API 问题记录

## 问题描述

在使用 GitHub API 进行书签同步过程中遇到了多个问题，主要包括：

1. API 认证和授权问题
2. 请求限制和速率控制
3. 数据同步和冲突处理
4. 错误处理和重试机制

## 具体问题

### 1. API 认证问题

**问题表现**：
```typescript
// 认证失败
const response = await fetch('https://api.github.com/gists', {
  headers: {
    'Authorization': `token ${token}`
  }
});
// Error: Bad credentials
```

**原因分析**：
- Token 格式错误
- Token 权限不足
- Token 已过期
- Token 被撤销

**解决方案**：
```typescript
// 1. Token 验证器
class TokenValidator {
  static async validate(token: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      if (response.status === 401) {
        throw new AuthError('Invalid token', 'AUTH_001');
      }
      
      if (response.status === 403) {
        const data = await response.json();
        if (data.message.includes('rate limit')) {
          throw new RateLimitError('Rate limit exceeded', 'RATE_001');
        }
        throw new AuthError('Token scope error', 'AUTH_004');
      }
      
      return response.ok;
    } catch (error) {
      if (error instanceof AuthError || error instanceof RateLimitError) {
        throw error;
      }
      throw new NetworkError('Network error', 'NET_001');
    }
  }
}

// 2. Token 管理器
class TokenManager {
  private static readonly TOKEN_KEY = 'github_token';
  
  async saveToken(token: string): Promise<void> {
    if (!await TokenValidator.validate(token)) {
      throw new AuthError('Invalid token', 'AUTH_001');
    }
    await chrome.storage.sync.set({ [this.TOKEN_KEY]: token });
  }
  
  async getToken(): Promise<string | null> {
    const result = await chrome.storage.sync.get(this.TOKEN_KEY);
    return result[this.TOKEN_KEY] || null;
  }
  
  async clearToken(): Promise<void> {
    await chrome.storage.sync.remove(this.TOKEN_KEY);
  }
}
```

### 2. 请求限制问题

**问题表现**：
```typescript
// 请求频率限制
const response = await fetch('https://api.github.com/gists');
// Error: API rate limit exceeded
```

**原因分析**：
- 超出 API 调用限制
- 未正确处理限流
- 并发请求过多

**解决方案**：
```typescript
// 1. 请求限流器
class RateLimiter {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private lastRequestTime = 0;
  private static readonly MIN_INTERVAL = 1000; // 最小间隔1秒

  async add<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await this.executeWithBackoff(request);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  private async executeWithBackoff<T>(
    request: () => Promise<T>, 
    retries = 3
  ): Promise<T> {
    for (let i = 0; i < retries; i++) {
      try {
        const now = Date.now();
        const elapsed = now - this.lastRequestTime;
        
        if (elapsed < this.MIN_INTERVAL) {
          await new Promise(resolve => 
            setTimeout(resolve, this.MIN_INTERVAL - elapsed)
          );
        }
        
        this.lastRequestTime = Date.now();
        return await request();
      } catch (error) {
        if (error instanceof RateLimitError) {
          const waitTime = this.calculateWaitTime(i);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        throw error;
      }
    }
    throw new Error('Max retries exceeded');
  }

  private calculateWaitTime(retry: number): number {
    return Math.min(1000 * Math.pow(2, retry), 60000);
  }

  private async processQueue(): Promise<void> {
    this.processing = true;
    while (this.queue.length > 0) {
      const request = this.queue.shift();
      if (request) {
        await request();
      }
    }
    this.processing = false;
  }
}

// 2. API 客户端
class GitHubClient {
  private rateLimiter = new RateLimiter();
  
  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return this.rateLimiter.add(async () => {
      const response = await fetch(`https://api.github.com${endpoint}`, {
        ...options,
        headers: {
          ...options.headers,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      if (response.status === 403) {
        const resetTime = response.headers.get('X-RateLimit-Reset');
        throw new RateLimitError(
          'Rate limit exceeded',
          'RATE_001',
          { resetTime }
        );
      }
      
      return response.json();
    });
  }
}
```

### 3. 数据同步问题

**问题表现**：
```typescript
// 数据冲突
const localData = await getLocalBookmarks();
const remoteData = await downloadFromGitHub();
// 数据不一致，需要合并
```

**原因分析**：
- 多设备同步冲突
- 数据版本不一致
- 合并策略不明确

**解决方案**：
```typescript
// 1. 数据同步器
class DataSynchronizer {
  async sync(): Promise<void> {
    const local = await this.getLocalData();
    const remote = await this.getRemoteData();
    
    if (await this.needsSync(local, remote)) {
      const merged = await this.mergeData(local, remote);
      await this.saveData(merged);
    }
  }

  private async needsSync(
    local: SyncData,
    remote: SyncData
  ): Promise<boolean> {
    if (!remote) return true;
    if (!local) return true;
    return local.version !== remote.version;
  }

  private async mergeData(
    local: SyncData,
    remote: SyncData
  ): Promise<SyncData> {
    if (!local) return remote;
    if (!remote) return local;
    
    // 使用时间戳比较
    if (local.timestamp > remote.timestamp) {
      return local;
    }
    
    // 处理冲突
    return {
      version: this.generateVersion(),
      timestamp: Date.now(),
      data: await this.mergeBookmarks(local.data, remote.data)
    };
  }

  private async mergeBookmarks(
    local: BookmarkNode[],
    remote: BookmarkNode[]
  ): Promise<BookmarkNode[]> {
    const merged = new Map<string, BookmarkNode>();
    
    // 处理远程数据
    remote.forEach(node => {
      merged.set(node.id, node);
    });
    
    // 合并本地数据
    local.forEach(node => {
      const existing = merged.get(node.id);
      if (!existing || node.dateAdded > existing.dateAdded) {
        merged.set(node.id, node);
      }
    });
    
    return Array.from(merged.values());
  }
}

// 2. 版本控制
class VersionControl {
  private static readonly VERSION_KEY = 'sync_version';
  
  async getCurrentVersion(): Promise<string> {
    const result = await chrome.storage.sync.get(this.VERSION_KEY);
    return result[this.VERSION_KEY] || this.generateInitialVersion();
  }
  
  async updateVersion(): Promise<string> {
    const version = this.generateNewVersion();
    await chrome.storage.sync.set({ [this.VERSION_KEY]: version });
    return version;
  }
  
  private generateNewVersion(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### 4. 错误处理问题

**问题表现**：
```typescript
// 网络错误
try {
  await syncBookmarks();
} catch (error) {
  // 未能正确处理和恢复
}
```

**原因分析**：
- 错误类型不明确
- 重试策略不完善
- 错误恢复机制缺失

**解决方案**：
```typescript
// 1. 错误处理器
class ErrorHandler {
  private static readonly MAX_RETRIES = 3;
  
  async handleError(error: Error): Promise<void> {
    if (error instanceof NetworkError) {
      await this.handleNetworkError(error);
    } else if (error instanceof AuthError) {
      await this.handleAuthError(error);
    } else if (error instanceof SyncError) {
      await this.handleSyncError(error);
    } else {
      this.logError(error);
      throw error;
    }
  }
  
  private async handleNetworkError(
    error: NetworkError,
    retryCount = 0
  ): Promise<void> {
    if (retryCount >= this.MAX_RETRIES) {
      throw error;
    }
    
    const waitTime = Math.pow(2, retryCount) * 1000;
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    try {
      await this.retryOperation(error.operation);
    } catch (retryError) {
      await this.handleNetworkError(retryError, retryCount + 1);
    }
  }
  
  private async handleAuthError(error: AuthError): Promise<void> {
    await tokenManager.clearToken();
    throw error;
  }
  
  private async handleSyncError(error: SyncError): Promise<void> {
    if (error.code === 'SYNC_001') {
      await this.handleConflict(error);
    } else {
      throw error;
    }
  }
  
  private logError(error: Error): void {
    console.error('[GitHub API Error]', {
      type: error.constructor.name,
      message: error.message,
      stack: error.stack
    });
  }
}

// 2. 重试装饰器
function retry(
  maxRetries: number = 3,
  backoff: number = 1000
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      let lastError: Error;
      
      for (let i = 0; i < maxRetries; i++) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          lastError = error;
          if (!(error instanceof NetworkError)) {
            throw error;
          }
          await new Promise(resolve => 
            setTimeout(resolve, backoff * Math.pow(2, i))
          );
        }
      }
      
      throw lastError;
    };
    
    return descriptor;
  };
}
```

## 最佳实践

1. **API 调用**
   - 使用 Token 认证
   - 实现请求限流
   - 处理错误重试

2. **数据处理**
   - 版本控制
   - 冲突解决
   - 增量同步

3. **错误处理**
   - 分类处理
   - 优雅降级
   - 日志记录

## 预防措施

1. **开发阶段**
   - 完整测试
   - 模拟错误
   - 验证重试

2. **运行时**
   - 监控状态
   - 记录日志
   - 自动恢复

3. **维护阶段**
   - 更新文档
   - 优化性能
   - 收集反馈 