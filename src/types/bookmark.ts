// 书签节点类型定义
export interface BookmarkNode {
  id: string;
  parentId?: string;
  title: string;
  url?: string;
  children?: BookmarkNode[];
  dateAdded?: number;
  dateModified?: number;
  index?: number;
}

// 添加 Chrome API 相关类型
export interface ChromeBookmarkNode extends chrome.bookmarks.BookmarkTreeNode {
  dateAdded: number;
  dateGroupModified?: number;
  children?: ChromeBookmarkNode[];
}

// 转换函数
export function convertToBookmarkNode(node: ChromeBookmarkNode): BookmarkNode {
  const bookmarkNode: BookmarkNode = {
    id: node.id,
    title: node.title,
    index: node.index || 0
  };

  if (node.parentId) bookmarkNode.parentId = node.parentId;
  if (node.url) bookmarkNode.url = node.url;
  if (node.dateAdded) bookmarkNode.dateAdded = node.dateAdded;
  if (node.dateGroupModified) bookmarkNode.dateModified = node.dateGroupModified;
  if (node.children) {
    bookmarkNode.children = node.children.map(convertToBookmarkNode);
  }

  return bookmarkNode;
}

// 操作类型定义
export type BookmarkOperationType = 'create' | 'update' | 'delete' | 'move' | 'error';

export interface BookmarkOperation {
  type: BookmarkOperationType;
  timestamp: number;
  bookmark: BookmarkNode;
  previousState?: BookmarkNode;
  error?: string; // 添加错误信息字段
}

// Git配置类型
export interface GitConfig {
  platform: 'github' | 'gitee';
  token: string;
  owner: string;
  repo: string;
  branch: string;
}

// 同步状态类型
export interface SyncStatus {
  lastSync: number;
  status: 'success' | 'error' | 'syncing';
  error?: string;
} 