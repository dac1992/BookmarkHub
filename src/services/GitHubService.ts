import { Logger } from '../utils/logger';
import { ConfigService } from './ConfigService';
import { RetryHelper } from '../utils/retry';
import { BookmarkNode, ProgressNotification, ProgressEventType, BookmarkSyncData } from '../types/bookmark';

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
  private readonly API_BASE = 'https://api.github.com';
  private readonly DEFAULT_BRANCH = 'main';
  private readonly SYNC_FILE = 'bookmarks.json';
  private readonly SYNC_VERSION = '1.0.0';

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
        const response = await fetch(`${this.API_BASE}/user`, {
          headers: {
            'Authorization': `token ${this.token}`,
            'Accept': 'application/vnd.github.v3+json'
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

      const normalizedBookmarks = bookmarks.map((node, index) => this.normalizeBookmark(node, index));
      const deviceId = await this.configService.getDeviceId();
      const syncData: BookmarkSyncData = {
        version: this.SYNC_VERSION,
        lastModified: Date.now(),
        deviceId,
        bookmarks: normalizedBookmarks,
        metadata: {
          totalCount: this.countBookmarks(normalizedBookmarks),
          folderCount: this.countFolders(normalizedBookmarks),
          lastSync: Date.now(),
          syncVersion: this.SYNC_VERSION
        }
      };
      
      if (config.syncType === 'gist') {
        await this.uploadToGist(syncData);
      } else {
        await this.uploadToRepo(syncData);
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

  private async uploadToGist(syncData: BookmarkSyncData): Promise<void> {
    const config = await this.configService.getConfig();
    const content = JSON.stringify(syncData, null, 2);
    
    await RetryHelper.execute(async () => {
      if (!config.gitConfig.gistId) {
        this.notifyProgress({
          type: ProgressEventType.PROGRESS,
          message: '创建新的Gist...',
          progress: 30
        });
        // 创建新的Gist
        const response = await fetch(`${this.API_BASE}/gists`, {
          method: 'POST',
          headers: {
            'Authorization': `token ${this.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            description: 'Browser Bookmarks Sync',
            public: false,
            files: {
              [this.SYNC_FILE]: {
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
        const response = await fetch(`${this.API_BASE}/gists/${config.gitConfig.gistId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `token ${this.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            files: {
              [this.SYNC_FILE]: {
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

  private async uploadToRepo(syncData: BookmarkSyncData): Promise<void> {
    const config = await this.configService.getConfig();
    const content = JSON.stringify(syncData, null, 2);
    
    await RetryHelper.execute(async () => {
      this.notifyProgress({
        type: ProgressEventType.PROGRESS,
        message: '检查仓库状态...',
        progress: 30
      });

      // 确保仓库存在
      if (!config.gitConfig.owner || !config.gitConfig.repo) {
        throw new Error('仓库配置不完整');
      }
      await this.ensureRepository(config.gitConfig.owner, config.gitConfig.repo);

      // 确保分支存在
      const branch = config.gitConfig.branch || this.DEFAULT_BRANCH;
      await this.ensureBranch(config.gitConfig.owner, config.gitConfig.repo, branch);

      this.notifyProgress({
        type: ProgressEventType.PROGRESS,
        message: '检查文件状态...',
        progress: 50
      });

      // 获取文件SHA（如果存在）
      let sha: string | undefined;
      try {
        const response = await fetch(
          `${this.API_BASE}/repos/${config.gitConfig.owner}/${config.gitConfig.repo}/contents/${this.SYNC_FILE}?ref=${branch}`,
          {
            headers: {
              'Authorization': `token ${this.token}`,
              'Accept': 'application/vnd.github.v3+json'
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
        progress: 70
      });

      // 创建或更新文件
      const response = await fetch(
        `${this.API_BASE}/repos/${config.gitConfig.owner}/${config.gitConfig.repo}/contents/${this.SYNC_FILE}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `token ${this.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: '更新书签同步数据',
            content: Buffer.from(content).toString('base64'),
            branch,
            ...(sha ? { sha } : {})
          })
        }
      );

      if (!response.ok) {
        throw new Error('上传到仓库失败');
      }
    });
  }

  private async ensureRepository(owner: string, repo: string): Promise<void> {
    try {
      const response = await fetch(
        `${this.API_BASE}/repos/${owner}/${repo}`,
        {
          headers: {
            'Authorization': `token ${this.token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (!response.ok) {
        // 仓库不存在，创建新仓库
        const createResponse = await fetch(
          `${this.API_BASE}/user/repos`,
          {
            method: 'POST',
            headers: {
              'Authorization': `token ${this.token}`,
              'Accept': 'application/vnd.github.v3+json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: repo,
              private: true,
              auto_init: true,
              description: 'Browser Bookmarks Sync Repository'
            })
          }
        );

        if (!createResponse.ok) {
          throw new Error('创建仓库失败');
        }
      }
    } catch (error) {
      throw new Error(`确保仓库存在时出错: ${error}`);
    }
  }

  private async ensureBranch(owner: string, repo: string, branch: string): Promise<void> {
    try {
      const response = await fetch(
        `${this.API_BASE}/repos/${owner}/${repo}/branches/${branch}`,
        {
          headers: {
            'Authorization': `token ${this.token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (!response.ok) {
        // 分支不存在，创建新分支
        const defaultBranchResponse = await fetch(
          `${this.API_BASE}/repos/${owner}/${repo}`,
          {
            headers: {
              'Authorization': `token ${this.token}`,
              'Accept': 'application/vnd.github.v3+json'
            }
          }
        );

        if (!defaultBranchResponse.ok) {
          throw new Error('获取默认分支失败');
        }

        const repoInfo = await defaultBranchResponse.json();
        const defaultBranch = repoInfo.default_branch;

        // 获取默认分支的最新commit
        const refResponse = await fetch(
          `${this.API_BASE}/repos/${owner}/${repo}/git/refs/heads/${defaultBranch}`,
          {
            headers: {
              'Authorization': `token ${this.token}`,
              'Accept': 'application/vnd.github.v3+json'
            }
          }
        );

        if (!refResponse.ok) {
          throw new Error('获取默认分支引用失败');
        }

        const refData = await refResponse.json();
        
        // 创建新分支
        const createBranchResponse = await fetch(
          `${this.API_BASE}/repos/${owner}/${repo}/git/refs`,
          {
            method: 'POST',
            headers: {
              'Authorization': `token ${this.token}`,
              'Accept': 'application/vnd.github.v3+json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ref: `refs/heads/${branch}`,
              sha: refData.object.sha
            })
          }
        );

        if (!createBranchResponse.ok) {
          throw new Error('创建分支失败');
        }
      }
    } catch (error) {
      throw new Error(`确保分支存在时出错: ${error}`);
    }
  }

  public async downloadBookmarks(): Promise<BookmarkNode[]> {
    this.notifyProgress({
      type: ProgressEventType.START,
      message: '开始下载书签...'
    });
    
    try {
      await this.authenticate();
      const config = await this.configService.getConfig();
      
      let syncData: BookmarkSyncData;
      if (config.syncType === 'gist') {
        syncData = await this.downloadFromGist();
      } else {
        syncData = await this.downloadFromRepo();
      }
      
      this.notifyProgress({
        type: ProgressEventType.SUCCESS,
        message: '书签下载完成'
      });

      // 更新最后同步时间
      await this.configService.updateConfig({
        lastSyncTime: Date.now()
      });

      return syncData.bookmarks;
    } catch (error: any) {
      this.notifyProgress({
        type: ProgressEventType.ERROR,
        message: `下载书签失败: ${error.message}`
      });
      throw error;
    }
  }

  private async downloadFromGist(): Promise<BookmarkSyncData> {
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
      
      const response = await fetch(
        `${this.API_BASE}/gists/${config.gitConfig.gistId}`,
        {
          headers: {
            'Authorization': `token ${this.token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('从Gist下载失败');
      }

      const data = await response.json();
      const content = data.files[this.SYNC_FILE].content;
      return JSON.parse(content);
    });
  }

  private async downloadFromRepo(): Promise<BookmarkSyncData> {
    const config = await this.configService.getConfig();
    if (!config.gitConfig.owner || !config.gitConfig.repo) {
      throw new Error('仓库配置不完整');
    }
    const branch = config.gitConfig.branch || this.DEFAULT_BRANCH;

    return await RetryHelper.execute(async () => {
      this.notifyProgress({
        type: ProgressEventType.PROGRESS,
        message: '从仓库下载书签...',
        progress: 50
      });
      
      const response = await fetch(
        `${this.API_BASE}/repos/${config.gitConfig.owner}/${config.gitConfig.repo}/contents/${this.SYNC_FILE}?ref=${branch}`,
        {
          headers: {
            'Authorization': `token ${this.token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('从仓库下载失败');
      }

      const data = await response.json();
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      return JSON.parse(content);
    });
  }

  private countBookmarks(bookmarks: BookmarkNode[]): number {
    let count = 0;
    const countNodes = (nodes: BookmarkNode[]) => {
      for (const node of nodes) {
        if (node.url) {
          count++;
        }
        if (node.children) {
          countNodes(node.children);
        }
      }
    };
    countNodes(bookmarks);
    return count;
  }

  private countFolders(bookmarks: BookmarkNode[]): number {
    let count = 0;
    const countNodes = (nodes: BookmarkNode[]) => {
      for (const node of nodes) {
        if (!node.url) {
          count++;
        }
        if (node.children) {
          countNodes(node.children);
        }
      }
    };
    countNodes(bookmarks);
    return count;
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

  private normalizeBookmark(node: chrome.bookmarks.BookmarkTreeNode, index: number): BookmarkNode {
    return {
      id: node.id,
      title: node.title || '',
      url: node.url,
      parentId: node.parentId || undefined,
      dateAdded: node.dateAdded || Date.now(),
      index: node.index || index,
      children: node.children?.map((child, idx) => this.normalizeBookmark(child, idx))
    };
  }
}

export default GitHubService; 