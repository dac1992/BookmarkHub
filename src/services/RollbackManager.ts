import { BookmarkNode, BookmarkOperation } from '../types/bookmark';
import { RollbackResult } from '../types/history';
import { HistoryManager } from './HistoryManager';

export class RollbackManager {
  constructor(
    private historyManager: HistoryManager
  ) {}

  /**
   * 回滚到指定历史记录
   */
  async rollbackTo(historyId: string): Promise<RollbackResult> {
    try {
      const entry = await this.historyManager.getEntry(historyId);
      if (!entry) {
        return {
          success: false,
          error: '未找到历史记录'
        };
      }

      const affectedBookmarks = await this.performRollback(entry.operation);
      
      // 记录回滚操作
      await this.historyManager.recordOperation({
        type: 'update',
        timestamp: Date.now(),
        bookmark: entry.operation.previousState!,
        previousState: entry.operation.bookmark
      });

      return {
        success: true,
        affectedBookmarks
      };
    } catch (error) {
      console.error('回滚失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '回滚失败'
      };
    }
  }

  /**
   * 执行回滚操作
   */
  private async performRollback(operation: BookmarkOperation): Promise<string[]> {
    const affectedIds: string[] = [];

    switch (operation.type) {
      case 'create':
        // 删除创建的书签
        await chrome.bookmarks.remove(operation.bookmark.id);
        affectedIds.push(operation.bookmark.id);
        break;

      case 'update':
      case 'move':
        if (operation.previousState) {
          // 恢复到之前的状态
          const createInfo: chrome.bookmarks.BookmarkCreateArg = {
            parentId: operation.previousState.parentId,
            title: operation.previousState.title,
            url: operation.previousState.url,
            index: operation.previousState.index
          };
          await chrome.bookmarks.create(createInfo);
          affectedIds.push(operation.bookmark.id);
        }
        break;

      case 'delete':
        if (operation.previousState) {
          // 重新创建被删除的书签
          const createInfo: chrome.bookmarks.BookmarkCreateArg = {
            parentId: operation.previousState.parentId,
            title: operation.previousState.title,
            url: operation.previousState.url,
            index: operation.previousState.index
          };
          await chrome.bookmarks.create(createInfo);
          affectedIds.push(operation.previousState.id);
        }
        break;
    }

    return affectedIds;
  }

  /**
   * 检查是否可以回滚
   */
  async canRollback(historyId: string): Promise<boolean> {
    const entry = await this.historyManager.getEntry(historyId);
    if (!entry) return false;

    // 检查是否有必要的状态信息
    return (
      entry.status === 'success' &&
      entry.operation.previousState !== undefined
    );
  }
} 