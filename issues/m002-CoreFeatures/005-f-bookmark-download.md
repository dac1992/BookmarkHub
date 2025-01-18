# Title
书签下载功能实现

# Introduction
实现从GitHub/Gitee下载书签数据并更新到本地浏览器的功能。

# Status
- 优先级：高
- 开发阶段：等待上传功能完成
- 依赖项：[003-f-bookmark-read.md, 004-f-bookmark-upload.md]
- 计划开始：书签上传功能完成后

# Tasks
- [ ] 远程数据获取
  ```typescript
  class SyncService {
    constructor(
      private gitService: GitService,
      private bookmarkService: BookmarkService
    ) {}

    async downloadBookmarks(): Promise<BookmarkNode[]> {
      const encryptedData = await this.gitService.fetchLatestBookmarks();
      return this.encryptionService.decrypt(encryptedData);
    }
  }
  ```

- [ ] 本地书签更新
  ```typescript
  class BookmarkUpdater {
    async updateLocalBookmarks(bookmarks: BookmarkNode[]): Promise<void> {
      // 实现书签更新逻辑
      for (const bookmark of bookmarks) {
        await this.createOrUpdateBookmark(bookmark);
      }
    }

    private async createOrUpdateBookmark(node: BookmarkNode): Promise<void> {
      // 实现单个书签更新逻辑
    }
  }
  ```

- [ ] 增量同步策略
  ```typescript
  interface SyncStrategy {
    shouldSync(local: BookmarkNode, remote: BookmarkNode): boolean;
    merge(local: BookmarkNode, remote: BookmarkNode): BookmarkNode;
  }

  class IncrementalSyncStrategy implements SyncStrategy {
    shouldSync(local: BookmarkNode, remote: BookmarkNode): boolean {
      return local.dateModified < remote.dateModified;
    }
  }
  ```

# Implementation Plan
1. 第一阶段：数据获取
   - 实现远程数据拉取
   - 数据解密处理
   - 错误处理机制

2. 第二阶段：本地更新
   - 书签更新逻辑
   - 批量操作优化
   - 进度显示

3. 第三阶段：同步策略
   - 增量更新实现
   - 冲突处理
   - 性能优化

# Notes
- 需要考虑大量书签更新的性能
- 添加同步进度提示
- 实现中断恢复机制
- 考虑添加回滚功能 