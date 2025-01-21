import { Logger } from '../utils/logger';
import { ConfigService } from './ConfigService';
import { RetryHelper } from '../utils/retry';
import { ProgressNotification, ProgressEventType, BookmarkNode } from '../types/bookmark';

export interface GitHubConfig {
  clientId: string;
  clientSecret: string;
  scopes: string[];
  gistId?: string;
  owner?: string;
  repo?: string;
  branch?: string;
}

export interface GitHubToken {
  accessToken: string;
  tokenType: string;
  scope: string;
}

export class GitHubService {
  private static instance: GitHubService;
  private token: string | null = null;
  private logger: Logger;
  private configService: ConfigService;
  private progressListeners: ((notification: ProgressNotification) => void)[] = [];

  private constructor() {
    this.logger = Logger.getInstance();
    this.configService = ConfigService.getInstance();
  }

  public static getInstance(): GitHubService {
    if (!GitHubService.instance) {
      GitHubService.instance = new GitHubService();
    }
    return GitHubService.instance;
  }

  public addProgressListener(listener: (notification: ProgressNotification) => void): void {
    this.progressListeners.push(listener);
  }

  public removeProgressListener(listener: (notification: ProgressNotification) => void): void {
    const index = this.progressListeners.indexOf(listener);
    if (index !== -1) {
      this.progressListeners.splice(index, 1);
    }
  }

  private notifyProgress(notification: ProgressNotification): void {
    this.progressListeners.forEach(listener => listener(notification));
  }

  public async authenticate(): Promise<void> {
    this.notifyProgress({
      type: ProgressEventType.START,
      message: '正在验证GitHub认证...'
    });
    try {
      const config = await this.configService.getConfig();
      if (!config.gitConfig.token) {
        throw new Error('GitHub Token未设置');
      }
      this.token = config.gitConfig.token;
      
      // 验证token有效性
      await RetryHelper.execute(async () => {
        const response = await fetch('https://api.github.com/user', {
          headers: {
            'Authorization': `token ${this.token}`,
          }
        });
        
        if (!response.ok) {
          throw new Error('GitHub Token无效');
        }
      });
      
      this.notifyProgress({
        type: ProgressEventType.SUCCESS,
        message: 'GitHub认证成功'
      });
    } catch (error: any) {
      this.notifyProgress({
        type: ProgressEventType.ERROR,
        message: `GitHub认证失败: ${error.message}`
      });
      throw error;
    }
  }

  public async uploadBookmarks(bookmarks: BookmarkNode[]): Promise<void> {
    try {
      await this.authenticate();
      const config = await this.configService.getConfig();
      
      this.notifyProgress({
        type: ProgressEventType.START,
        message: '开始上传书签...'
      });
      
      if (config.syncType === 'gist') {
        await this.uploadToGist(bookmarks);
      } else {
        await this.uploadToRepo(bookmarks);
      }
      
      this.notifyProgress({
        type: ProgressEventType.SUCCESS,
        message: '书签上传完成'
      });
    } catch (error: any) {
      this.notifyProgress({
        type: ProgressEventType.ERROR,
        message: `上传书签失败: ${error.message}`
      });
      this.logger.error('上传书签失败:', error);
      throw error;
    }
  }

  private async uploadToGist(bookmarks: BookmarkNode[]): Promise<void> {
    const config = await this.configService.getConfig();
    const content = JSON.stringify(bookmarks, null, 2);
    
    await RetryHelper.execute(async () => {
      if (!config.gitConfig.gistId) {
        this.notifyProgress({
          type: ProgressEventType.PROGRESS,
          message: '创建新的Gist...',
          progress: 30
        });
        // 创建新的Gist
        const response = await fetch('https://api.github.com/gists', {
          method: 'POST',
          headers: {
            'Authorization': `token ${this.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            description: 'Browser Bookmarks Sync',
            public: false,
            files: {
              'bookmarks.json': {
                content
              }
            }
          })
        });

        if (!response.ok) {
          throw new Error('创建Gist失败');
        }

        const data = await response.json();
        await this.configService.updateConfig({
          gitConfig: {
            ...config.gitConfig,
            gistId: data.id
          }
        });
      } else {
        this.notifyProgress({
          type: ProgressEventType.PROGRESS,
          message: '更新已有Gist...',
          progress: 50
        });
        // 更新已有的Gist
        const response = await fetch(`https://api.github.com/gists/${config.gitConfig.gistId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `token ${this.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            files: {
              'bookmarks.json': {
                content
              }
            }
          })
        });

        if (!response.ok) {
          throw new Error('更新Gist失败');
        }
      }
    });
  }

  private async uploadToRepo(bookmarks: BookmarkNode[]): Promise<void> {
    const config = await this.configService.getConfig();
    const content = JSON.stringify(bookmarks, null, 2);
    const path = 'bookmarks.json';
    
    await RetryHelper.execute(async () => {
      this.notifyProgress({
        type: ProgressEventType.PROGRESS,
        message: '检查仓库文件状态...',
        progress: 30
      });
      // 获取文件SHA（如果存在）
      let sha: string | undefined;
      try {
        const response = await fetch(
          `https://api.github.com/repos/${config.gitConfig.owner}/${config.gitConfig.repo}/contents/${path}?ref=${config.gitConfig.branch}`,
          {
            headers: {
              'Authorization': `token ${this.token}`,
            }
          }
        );
        if (response.ok) {
          const data = await response.json();
          sha = data.sha;
        }
      } catch (error) {
        // 文件不存在，忽略错误
      }

      this.notifyProgress({
        type: ProgressEventType.PROGRESS,
        message: '上传文件到仓库...',
        progress: 60
      });
      // 创建或更新文件
      const response = await fetch(
        `https://api.github.com/repos/${config.gitConfig.owner}/${config.gitConfig.repo}/contents/${path}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `token ${this.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: '更新书签',
            content: Buffer.from(content).toString('base64'),
            branch: config.gitConfig.branch,
            ...(sha ? { sha } : {})
          })
        }
      );

      if (!response.ok) {
        throw new Error('上传到仓库失败');
      }
    });
  }

  public async downloadBookmarks(): Promise<BookmarkNode[]> {
    this.notifyProgress({
      type: ProgressEventType.START,
      message: '开始下载书签...'
    });
    
    try {
      await this.authenticate();
      const config = await this.configService.getConfig();
      
      let bookmarks: BookmarkNode[];
      if (config.syncType === 'gist') {
        bookmarks = await this.downloadFromGist();
      } else {
        bookmarks = await this.downloadFromRepo();
      }
      
      this.notifyProgress({
        type: ProgressEventType.SUCCESS,
        message: '书签下载完成'
      });
      return bookmarks;
    } catch (error: any) {
      this.notifyProgress({
        type: ProgressEventType.ERROR,
        message: `下载书签失败: ${error.message}`
      });
      throw error;
    }
  }

  private async downloadFromGist(): Promise<BookmarkNode[]> {
    const config = await this.configService.getConfig();
    if (!config.gitConfig.gistId) {
      throw new Error('Gist ID未设置');
    }

    return await RetryHelper.execute(async () => {
      this.notifyProgress({
        type: ProgressEventType.PROGRESS,
        message: '从Gist下载书签...',
        progress: 50
      });
      
      const response = await fetch(`https://api.github.com/gists/${config.gitConfig.gistId}`, {
        headers: {
          'Authorization': `token ${this.token}`,
        }
      });

      if (!response.ok) {
        throw new Error('从Gist下载失败');
      }

      const data = await response.json();
      const content = data.files['bookmarks.json'].content;
      const bookmarks = JSON.parse(content);
      return this.normalizeBookmarks(bookmarks);
    });
  }

  private async downloadFromRepo(): Promise<BookmarkNode[]> {
    const config = await this.configService.getConfig();
    const path = 'bookmarks.json';

    return await RetryHelper.execute(async () => {
      this.notifyProgress({
        type: ProgressEventType.PROGRESS,
        message: '从仓库下载书签...',
        progress: 50
      });
      
      const response = await fetch(
        `https://api.github.com/repos/${config.gitConfig.owner}/${config.gitConfig.repo}/contents/${path}?ref=${config.gitConfig.branch}`,
        {
          headers: {
            'Authorization': `token ${this.token}`,
          }
        }
      );

      if (!response.ok) {
        throw new Error('从仓库下载失败');
      }

      const data = await response.json();
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      const bookmarks = JSON.parse(content);
      return this.normalizeBookmarks(bookmarks);
    });
  }

  private normalizeBookmarks(bookmarks: any[]): BookmarkNode[] {
    const normalize = (node: any, index: number): BookmarkNode => {
      return {
        id: node.id || String(Date.now() + index),
        title: node.title || '',
        url: node.url,
        parentId: node.parentId,
        dateAdded: node.dateAdded || Date.now(),
        index: node.index || index,
        children: node.children?.map((child: any, idx: number) => normalize(child, idx))
      };
    };
    
    return bookmarks.map((node, index) => normalize(node, index));
  }

  public async getToken(): Promise<GitHubToken | null> {
    try {
      const result = await chrome.storage.local.get(['github_token', 'token_timestamp']);
      if (!result.github_token) {
        return null;
      }
      
      // 检查token是否过期（默认24小时）
      const tokenAge = Date.now() - (result.token_timestamp || 0);
      if (tokenAge > 24 * 60 * 60 * 1000) {
        this.logger.info('Token已过期');
        await this.clearToken();
        return null;
      }
      
      return result.github_token;
    } catch (error) {
      this.logger.error('获取GitHub令牌失败:', error);
      return null;
    }
  }

  public async clearToken(): Promise<void> {
    try {
      await chrome.storage.local.remove(['github_token', 'token_timestamp']);
      this.logger.info('GitHub令牌已清除');
    } catch (error) {
      this.logger.error('清除GitHub令牌失败:', error);
      throw error;
    }
  }
}

export default GitHubService; 