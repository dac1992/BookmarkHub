# GitHub 同步功能 API 文档

## 服务类

### GitHubService

#### 认证相关
```typescript
class GitHubService {
  /**
   * 验证 GitHub Token
   * @throws {AuthError} 当 token 无效时
   */
  public async authenticate(): Promise<void>;

  /**
   * 获取当前 token
   * @returns {GitHubToken | null} token 信息或 null
   */
  public async getToken(): Promise<GitHubToken | null>;

  /**
   * 清除 token
   */
  public async clearToken(): Promise<void>;
}
```

#### 同步相关
```typescript
class GitHubService {
  /**
   * 上传书签到 GitHub
   * @param bookmarks 书签数据
   * @throws {SyncError} 同步失败时
   */
  public async uploadBookmarks(bookmarks: BookmarkNode[]): Promise<void>;

  /**
   * 从 GitHub 下载书签
   * @returns {BookmarkNode[]} 书签数据
   * @throws {SyncError} 同步失败时
   */
  public async downloadBookmarks(): Promise<BookmarkNode[]>;
}
```

#### 进度监听
```typescript
class GitHubService {
  /**
   * 添加进度监听器
   * @param listener 进度监听函数
   */
  public addProgressListener(listener: (notification: ProgressNotification) => void): void;

  /**
   * 移除进度监听器
   * @param listener 要移除的监听函数
   */
  public removeProgressListener(listener: (notification: ProgressNotification) => void): void;
}
```

### ConfigService

#### 配置管理
```typescript
class ConfigService {
  /**
   * 获取配置
   * @returns {SyncConfig} 当前配置
   */
  public async getConfig(): Promise<SyncConfig>;

  /**
   * 更新配置
   * @param config 部分配置
   */
  public async updateConfig(config: Partial<SyncConfig>): Promise<void>;

  /**
   * 验证配置
   * @returns {string[]} 错误信息列表
   */
  public async validateConfig(): Promise<string[]>;

  /**
   * 清除配置
   */
  public async clearConfig(): Promise<void>;
}
```

### SyncService

#### 同步管理
```typescript
class SyncService {
  /**
   * 执行同步
   * @throws {SyncError} 同步失败时
   */
  public async sync(): Promise<void>;

  /**
   * 启动自动同步
   */
  public async startAutoSync(): Promise<void>;

  /**
   * 停止自动同步
   */
  public stopAutoSync(): void;

  /**
   * 处理书签变更
   * @param change 变更信息
   */
  public async handleBookmarkChange(change: BookmarkChange): Promise<void>;
}
```

## 类型定义

### 配置类型
```typescript
interface SyncConfig {
  syncType: 'gist' | 'repo';
  syncInterval: number;
  autoSync: boolean;
  deviceId: string;
  lastSyncTime?: number;
  gitConfig: {
    token: string;
    gistId?: string;
    owner?: string;
    repo?: string;
    branch?: string;
  };
}
```

### 书签类型
```typescript
interface BookmarkNode {
  id: string;
  title: string;
  url?: string;
  parentId?: string;
  dateAdded: number;
  index: number;
  children?: BookmarkNode[];
}

interface BookmarkSyncData {
  version: string;
  lastModified: number;
  deviceId: string;
  bookmarks: BookmarkNode[];
  metadata: {
    totalCount: number;
    folderCount: number;
    lastSync: number;
    syncVersion: string;
  };
}
```

### 事件类型
```typescript
interface BookmarkChange {
  type: 'create' | 'remove' | 'move' | 'update';
  id: string;
  bookmark: chrome.bookmarks.BookmarkTreeNode;
  oldParentId?: string;
  oldIndex?: number;
}

interface ProgressNotification {
  type: ProgressEventType;
  message: string;
  progress?: number;
}

enum ProgressEventType {
  START = 'start',
  PROGRESS = 'progress',
  SUCCESS = 'success',
  ERROR = 'error'
}
```

### 错误类型
```typescript
class SyncError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: any
  ) {
    super(message);
  }
}

class AuthError extends SyncError {
  constructor(message: string) {
    super(message, 'AUTH_001');
  }
}

class NetworkError extends SyncError {
  constructor(message: string) {
    super(message, 'NET_001');
  }
}
```

## 使用示例

### 基本同步流程
```typescript
const syncService = SyncService.getInstance();

try {
  // 开始同步
  await syncService.sync();
} catch (error) {
  if (error instanceof AuthError) {
    // 处理认证错误
  } else if (error instanceof NetworkError) {
    // 处理网络错误
  } else {
    // 处理其他错误
  }
}
```

### 配置管理
```typescript
const configService = ConfigService.getInstance();

// 更新配置
await configService.updateConfig({
  syncType: 'repo',
  autoSync: true,
  syncInterval: 3600,
  gitConfig: {
    token: 'your-token',
    owner: 'your-name',
    repo: 'your-repo',
    branch: 'main'
  }
});

// 验证配置
const errors = await configService.validateConfig();
if (errors.length > 0) {
  console.error('配置错误:', errors);
}
```

### 进度监听
```typescript
const githubService = GitHubService.getInstance();

// 添加进度监听
const progressListener = (notification: ProgressNotification) => {
  console.log(`${notification.type}: ${notification.message}`);
  if (notification.progress) {
    console.log(`Progress: ${notification.progress}%`);
  }
};

githubService.addProgressListener(progressListener);

// 执行同步...

// 移除监听
githubService.removeProgressListener(progressListener);
``` 