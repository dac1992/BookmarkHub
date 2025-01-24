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

interface RetryOptions {
  maxRetries: number;
  retryDelay: number;
  shouldRetry: (error: Error) => boolean;
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
      }, {
        maxAttempts: 3,
        delayMs: 1000,
        backoffFactor: 2,
        retryableErrors: [
          'rate limit exceeded',
          'network error',
          'timeout',
          'ETIMEDOUT',
          'ECONNRESET',
          'ECONNREFUSED'
        ]
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
        await this.configService.saveConfig({
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
    }, {
      maxAttempts: 3,
      delayMs: 1000,
      backoffFactor: 2,
      retryableErrors: [
        'rate limit exceeded',
        'network error',
        'timeout',
        'ETIMEDOUT',
        'ECONNRESET',
        'ECONNREFUSED'
      ]
    });
  }

  private async uploadToRepo(syncData: BookmarkSyncData): Promise<void> {
    const config = await this.configService.getConfig();
    const content = JSON.stringify(syncData, null, 2);
    
    return await RetryHelper.execute(async () => {
      this.notifyProgress({
        type: ProgressEventType.PROGRESS,
        message: '检查仓库状态...',
        progress: 30
      });

      // 确保仓库存在
      if (!config.gitConfig.owner || !config.gitConfig.repo) {
        throw new Error('仓库配置不完整');
      }

      // 确保仓库和分支存在
      const branch = config.gitConfig.branch || this.DEFAULT_BRANCH;
      await this.ensureRepository(config.gitConfig.owner, config.gitConfig.repo);
      await this.ensureBranch(config.gitConfig.owner, config.gitConfig.repo, branch);

      this.notifyProgress({
        type: ProgressEventType.PROGRESS,
        message: '检查文件状态...',
        progress: 50
      });

      // 获取当前文件（如果存在）
      let currentData: BookmarkSyncData | null = null;
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
          const content = Buffer.from(data.content, 'base64').toString('utf-8');
          currentData = JSON.parse(content);
        }
      } catch (error) {
        // 文件不存在，继续上传
      }

      // 如果文件存在，检查冲突
      if (currentData) {
        if (currentData.lastModified > syncData.lastModified) {
          // 远程版本更新，需要合并
          this.notifyProgress({
            type: ProgressEventType.PROGRESS,
            message: '检测到远程更新，正在合并...',
            progress: 60
          });
          
          syncData = await this.mergeBookmarks(currentData, syncData);
        }
      }

      this.notifyProgress({
        type: ProgressEventType.PROGRESS,
        message: '上传文件到仓库...',
        progress: 80
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
            message: `更新书签同步数据 [${new Date().toISOString()}]`,
            content: Buffer.from(JSON.stringify(syncData, null, 2)).toString('base64'),
            branch,
            ...(sha ? { sha } : {})
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`上传到仓库失败: ${errorData.message}`);
      }

      this.notifyProgress({
        type: ProgressEventType.PROGRESS,
        message: '更新完成',
        progress: 100
      });
    }, {
      maxAttempts: 3,
      delayMs: 1000,
      backoffFactor: 2,
      retryableErrors: [
        'rate limit exceeded',
        'network error',
        'timeout',
        'ETIMEDOUT',
        'ECONNRESET',
        'ECONNREFUSED'
      ]
    });
  }

  private async mergeBookmarks(remote: BookmarkSyncData, local: BookmarkSyncData): Promise<BookmarkSyncData> {
    // 创建书签映射以便快速查找
    const remoteMap = new Map<string, BookmarkNode>();
    const localMap = new Map<string, BookmarkNode>();
    
    const mapBookmarks = (nodes: BookmarkNode[], map: Map<string, BookmarkNode>) => {
      nodes.forEach(node => {
        map.set(node.id, node);
        if (node.children) {
          mapBookmarks(node.children, map);
        }
      });
    };

    mapBookmarks(remote.bookmarks, remoteMap);
    mapBookmarks(local.bookmarks, localMap);

    // 合并书签
    const mergedBookmarks = local.bookmarks.map(node => {
      const remoteNode = remoteMap.get(node.id);
      if (!remoteNode) {
        // 本地新增的节点
        return node;
      }

      // 比较修改时间，使用最新的版本
      if (remoteNode.dateAdded > node.dateAdded) {
        return remoteNode;
      }
      return node;
    });

    // 添加远程新增的节点
    remote.bookmarks.forEach(node => {
      if (!localMap.has(node.id)) {
        mergedBookmarks.push(node);
      }
    });

    return {
      ...local,
      bookmarks: mergedBookmarks,
      lastModified: Date.now(),
      metadata: {
        ...local.metadata,
        totalCount: this.countBookmarks(mergedBookmarks),
        folderCount: this.countFolders(mergedBookmarks),
        lastSync: Date.now()
      }
    };
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
      await this.configService.saveConfig({
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
    }, {
      maxAttempts: 3,
      delayMs: 1000,
      backoffFactor: 2,
      retryableErrors: [
        'rate limit exceeded',
        'network error',
        'timeout',
        'ETIMEDOUT',
        'ECONNRESET',
        'ECONNREFUSED'
      ]
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
    }, {
      maxAttempts: 3,
      delayMs: 1000,
      backoffFactor: 2,
      retryableErrors: [
        'rate limit exceeded',
        'network error',
        'timeout',
        'ETIMEDOUT',
        'ECONNRESET',
        'ECONNREFUSED'
      ]
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
      const config = await this.configService.getConfig();
      if (!config.gitConfig.token) {
        return null;
      }
      return {
        accessToken: config.gitConfig.token,
        tokenType: 'bearer',
        scope: 'repo,gist'
      };
    } catch (error) {
      this.logger.error('获取GitHub令牌失败:', error);
      return null;
    }
  }

  public async clearToken(): Promise<void> {
    try {
      await this.configService.saveConfig({
        gitConfig: {
          token: ''
        }
      });
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