import { BookmarkNode } from '../types/bookmark';

export class BookmarkService {
  /**
   * 获取所有书签
   */
  async getAllBookmarks(): Promise<BookmarkNode[]> {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.getTree((results) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(this.normalizeBookmarks(results));
        }
      });
    });
  }

  /**
   * 标准化书签数据
   */
  private normalizeBookmarks(nodes: chrome.bookmarks.BookmarkTreeNode[]): BookmarkNode[] {
    return nodes.map(node => ({
      id: node.id,
      parentId: node.parentId,
      title: node.title,
      url: node.url,
      dateAdded: node.dateAdded || Date.now(),
      dateModified: node.dateGroupModified,
      index: node.index || 0,
      children: node.children ? this.normalizeBookmarks(node.children) : undefined
    }));
  }
} 