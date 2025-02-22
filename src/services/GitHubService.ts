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

interface GitHubError extends Error {
  message: string;
  response?: Response;
}

export class GitHubService {
  private static instance: GitHubService;
  private token: string | null = null;
  private logger: Logger;
  private configService: ConfigService;
  private progressListeners: ((notification: ProgressNotification) => void)[] = [];
  private readonly API_BASE = 'https://api.github.com';
  private readonly DEFAULT_BRANCH = 'main';
  private readonly SYNC_FILE_PREFIX = 'bookmarks';
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
      // 如果是重试错误，不显示错误提示
      if (error.message === 'RETRY_UPLOAD') {
        this.logger.debug('文件已存在，重新尝试上传');
        return;
      }
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
      try {
        // 生成新的文件名，使用时间戳
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `${this.SYNC_FILE_PREFIX}_${timestamp}.json`;

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
                [fileName]: {
                  content
                }
              }
            })
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`创建Gist失败: ${response.status} ${errorData.message || response.statusText}`);
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
            message: '更新Gist...',
            progress: 50
          });
          // 更新Gist，添加新文件
          const response = await fetch(`${this.API_BASE}/gists/${config.gitConfig.gistId}`, {
            method: 'PATCH',
            headers: {
              'Authorization': `token ${this.token}`,
              'Accept': 'application/vnd.github.v3+json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              files: {
                [fileName]: {
                  content
                }
              }
            })
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            if (response.status === 404) {
              // Gist不存在，清除gistId并重试
              await this.configService.saveConfig({
                gitConfig: {
                  ...config.gitConfig,
                  gistId: undefined
                }
              });
              throw new Error('Gist不存在，将重新创建');
            }
            throw new Error(`更新Gist失败: ${response.status} ${errorData.message || response.statusText}`);
          }

          // 清理旧文件
          await this.cleanupGistFiles(config.gitConfig.gistId);
        }
      } catch (error: any) {
        // 处理API限制错误
        if (error.message?.includes('API rate limit exceeded')) {
          const resetTime = new Date(parseInt(error.response?.headers?.get('x-ratelimit-reset') || '0') * 1000);
          throw new Error(`GitHub API限制已达上限，请等待至 ${resetTime.toLocaleString()} 后重试`);
        }
        throw error;
      }
    }, {
      maxAttempts: 2,
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

  private async cleanupGistFiles(gistId: string): Promise<void> {
    try {
      // 获取Gist内容
      const response = await fetch(
        `${this.API_BASE}/gists/${gistId}`,
        {
          headers: {
            'Authorization': `token ${this.token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (!response.ok) {
        this.logger.warn('获取Gist内容失败，跳过清理');
        return;
      }

      const data = await response.json();
      const files = Object.keys(data.files)
        .filter(name => name.startsWith(this.SYNC_FILE_PREFIX))
        .sort((a, b) => b.localeCompare(a));  // 按文件名降序排序

      // 保留最新的5个文件，删除其他的
      const filesToDelete = files.slice(5);
      if (filesToDelete.length === 0) return;

      // 创建更新对象，将要删除的文件标记为null
      const updateFiles: Record<string, null> = {};
      filesToDelete.forEach(file => {
        updateFiles[file] = null;
      });

      // 删除旧文件
      await fetch(
        `${this.API_BASE}/gists/${gistId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `token ${this.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            files: updateFiles
          })
        }
      );
    } catch (error) {
      this.logger.warn('清理Gist旧文件失败:', error);
    }
  }

  private async uploadToRepo(syncData: BookmarkSyncData): Promise<void> {
    const config = await this.configService.getConfig();
    
    // 验证数据完整性
    if (!this.validateSyncData(syncData)) {
      throw new Error('书签数据格式无效');
    }
    
    const content = JSON.stringify(syncData, null, 2);
    let retryCount = 0;
    const maxRetries = 3;

    // 使用固定的文件名
    const fileName = 'bookmarks.json';
    
    while (retryCount < maxRetries) {
      try {
        this.notifyProgress({
          type: ProgressEventType.PROGRESS,
          message: '检查仓库状态...',
          progress: 30
        });

        // 确保仓库配置完整
        if (!config.gitConfig.owner || !config.gitConfig.repo) {
          throw new Error('仓库配置不完整');
        }

        // 确保仓库和分支存在
        const branch = config.gitConfig.branch || this.DEFAULT_BRANCH;
        await this.ensureRepository(config.gitConfig.owner, config.gitConfig.repo);
        await this.ensureBranch(config.gitConfig.owner, config.gitConfig.repo, branch);

        // 获取文件的当前 SHA（如果存在）
        let sha: string | undefined;
        try {
          const fileResponse = await fetch(
            `${this.API_BASE}/repos/${config.gitConfig.owner}/${config.gitConfig.repo}/contents/${fileName}?ref=${branch}`,
            {
              headers: {
                'Authorization': `token ${this.token}`,
                'Accept': 'application/vnd.github.v3+json'
              }
            }
          );
          if (fileResponse.ok) {
            const fileData = await fileResponse.json();
            sha = fileData.sha;
          }
        } catch (error) {
          // 文件不存在，忽略错误
          this.logger.debug('文件不存在，将创建新文件');
        }

        // 创建或更新文件
        const uploadContent = btoa(unescape(encodeURIComponent(content)));
        const uploadResponse = await fetch(
          `${this.API_BASE}/repos/${config.gitConfig.owner}/${config.gitConfig.repo}/contents/${fileName}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `token ${this.token}`,
              'Accept': 'application/vnd.github.v3+json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: `更新书签同步数据 [${new Date().toISOString()}]`,
              content: uploadContent,
              branch,
              sha // 如果文件存在，包含 SHA
            })
          }
        );

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          if (uploadResponse.status === 422 && errorData.message?.includes('sha')) {
            retryCount++;
            this.logger.debug(`文件已被修改，重新获取SHA并重试 (${retryCount}/${maxRetries})`);
            // 等待一秒后重试
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
          throw new Error(`上传到仓库失败: ${errorData.message}`);
        }

        // 上传成功，不需要清理旧文件
        return;
      } catch (error: any) {
        if (error.message?.includes('API rate limit exceeded')) {
          throw error; // API 限制错误直接抛出
        }
        if (retryCount >= maxRetries - 1) {
          throw error; // 重试次数用完，抛出最后一次的错误
        }
        retryCount++;
        this.logger.debug(`上传失败，重新尝试 (${retryCount}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  private validateSyncData(data: any): data is BookmarkSyncData {
    try {
      if (!data || typeof data !== 'object') return false;
      
      // 验证基本结构
      if (!data.version || typeof data.version !== 'string' ||
          !data.lastModified || typeof data.lastModified !== 'number' ||
          !data.deviceId || typeof data.deviceId !== 'string' ||
          !Array.isArray(data.bookmarks)) {
        this.logger.warn('基本结构验证失败:', data);
        return false;
      }
      
      // 验证元数据
      if (!data.metadata || typeof data.metadata !== 'object') {
        this.logger.warn('元数据结构验证失败:', data.metadata);
        return false;
      }
      
      const { totalCount, folderCount, lastSync, syncVersion } = data.metadata;
      if (typeof totalCount !== 'number' || 
          typeof folderCount !== 'number' || 
          typeof lastSync !== 'number' || 
          typeof syncVersion !== 'string') {
        this.logger.warn('元数据字段验证失败:', data.metadata);
        return false;
      }
      
      // 验证书签数组
      const isValid = data.bookmarks.every((bookmark: any) => this.validateBookmarkNode(bookmark));
      if (!isValid) {
        this.logger.warn('书签数据验证失败:', data.bookmarks);
      }
      return isValid;
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error('数据验证过程出错:', error.message);
      } else {
        this.logger.error('数据验证过程出错:', String(error));
      }
      return false;
    }
  }

  private validateBookmarkNode(node: any): boolean {
    try {
      if (!node || typeof node !== 'object') {
        this.logger.warn('节点不是对象:', node);
        return false;
      }
      
      // 验证必需字段
      if (!node.id || typeof node.id !== 'string') {
        this.logger.warn('节点ID无效:', node);
        return false;
      }
      
      if (!node.title || typeof node.title !== 'string') {
        this.logger.warn('节点标题无效:', node);
        return false;
      }
      
      if (typeof node.index !== 'number') {
        this.logger.warn('节点索引无效:', node);
        return false;
      }
      
      // url是可选的，但如果存在必须是字符串
      if (node.url !== undefined && typeof node.url !== 'string') {
        this.logger.warn('节点URL无效:', node);
        return false;
      }
      
      // parentId是可选的，但如果存在必须是字符串
      if (node.parentId !== undefined && typeof node.parentId !== 'string') {
        this.logger.warn('节点父ID无效:', node);
        return false;
      }
      
      // 验证children数组（如果存在）
      if (node.children !== undefined) {
        if (!Array.isArray(node.children)) {
          this.logger.warn('节点子节点不是数组:', node);
          return false;
        }
        return node.children.every((child: any) => this.validateBookmarkNode(child));
      }
      
      return true;
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error('节点验证过程出错:', error.message);
      } else {
        this.logger.error('节点验证过程出错:', String(error));
      }
      return false;
    }
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
      const content = data.files[this.SYNC_FILE_PREFIX].content;
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
      
      // 获取仓库中的所有文件
      const response = await fetch(
        `${this.API_BASE}/repos/${config.gitConfig.owner}/${config.gitConfig.repo}/contents?ref=${branch}`,
        {
          headers: {
            'Authorization': `token ${this.token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('获取仓库文件列表失败');
      }

      const files = await response.json();
      const bookmarkFiles = files
        .filter((file: any) => file.name.startsWith(this.SYNC_FILE_PREFIX))
        .sort((a: any, b: any) => b.name.localeCompare(a.name));  // 按文件名降序排序

      if (bookmarkFiles.length === 0) {
        throw new Error('未找到书签同步文件');
      }

      // 获取最新的文件内容
      const latestFile = bookmarkFiles[0];
      const fileResponse = await fetch(
        `${this.API_BASE}/repos/${config.gitConfig.owner}/${config.gitConfig.repo}/contents/${latestFile.path}?ref=${branch}`,
        {
          headers: {
            'Authorization': `token ${this.token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (!fileResponse.ok) {
        throw new Error('下载书签文件失败');
      }

      const data = await fileResponse.json();
      const content = decodeURIComponent(atob(data.content));
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

  public countBookmarks(bookmarks: BookmarkNode[]): number {
    let count = 0;
    const countNodes = (nodes: BookmarkNode[]) => {
      for (const node of nodes) {
        // 只统计有效的 URL 作为书签（非空 URL）
        if (node.url && node.url.trim() !== '') {
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

  public countFolders(bookmarks: BookmarkNode[]): number {
    let count = 0;
    const countNodes = (nodes: BookmarkNode[]) => {
      for (const node of nodes) {
        // 排除根节点和空的默认文件夹
        if (!node.url && node.id !== '0' && 
            !(node.id === '1' && (!node.children || node.children.length === 0)) && 
            !(node.id === '2' && (!node.children || node.children.length === 0))) {
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
    // 确保所有必需字段都有值
    const normalizedNode: BookmarkNode = {
      id: node.id || `bookmark-${Date.now()}-${index}`,
      title: node.title || '未命名书签',
      url: node.url || '',
      parentId: node.parentId || '0',
      dateAdded: node.dateAdded || Date.now(),
      index: typeof node.index === 'number' ? node.index : index,
      children: []
    };

    // 处理子节点
    if (node.children && Array.isArray(node.children)) {
      normalizedNode.children = node.children.map((child, idx) => 
        this.normalizeBookmark(child, idx)
      );
    }

    return normalizedNode;
  }
}

export default GitHubService; 