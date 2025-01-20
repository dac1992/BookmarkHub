import { GitConfig, BookmarkNode } from '../types/bookmark';

export class GitService {
  constructor(private config: GitConfig) {}

  public async uploadBookmarks(bookmarks: BookmarkNode[]): Promise<void> {
    // TODO: 实现上传逻辑
    console.log('上传书签:', bookmarks);
  }
} 