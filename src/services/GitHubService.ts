import { Logger } from '../utils/logger';

export interface GitHubConfig {
  clientId: string;
  clientSecret: string;
  scopes: string[];
}

export interface GitHubToken {
  accessToken: string;
  tokenType: string;
  scope: string;
}

export class GitHubService {
  private static instance: GitHubService;
  private logger: Logger;
  private config: GitHubConfig;
  private redirectUrl: string;

  private constructor() {
    this.logger = Logger.getInstance();
    
    // 修改重定向URL格式
    const extensionId = chrome.runtime.id;
    this.redirectUrl = `https://${extensionId}.chromiumapp.org/`;
    
    this.config = {
      clientId: 'Ov23lihH4oQ0kowMZTTh',
      clientSecret: 'b84b6393a76701e46dab93d72e47db2ad8523429',
      scopes: ['repo']
    };
    
    this.logger.debug('GitHubService初始化:', {
      extensionId,
      redirectUrl: this.redirectUrl,
      config: {
        ...this.config,
        clientSecret: '******'
      }
    });
  }

  public static getInstance(): GitHubService {
    if (!GitHubService.instance) {
      GitHubService.instance = new GitHubService();
    }
    return GitHubService.instance;
  }

  public async authenticate(): Promise<GitHubToken> {
    try {
      this.logger.info('开始GitHub认证流程');
      
      // 清除任何可能存在的旧token
      await this.clearToken();
      
      const authUrl = this.buildAuthUrl();
      this.logger.debug('认证URL:', authUrl);
      
      // 添加重试机制
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          const redirectUrl = await this.launchWebAuthFlow(authUrl);
          this.logger.debug('重定向URL:', redirectUrl);
          
          const code = this.extractCode(redirectUrl);
          this.logger.debug('获取到授权码');
          
          const token = await this.exchangeCodeForToken(code);
          this.logger.debug('成功获取访问令牌');
          
          // 验证获取到的token
          if (await this.validateToken(token)) {
            await this.saveToken(token);
            this.logger.info('GitHub认证流程完成');
            return token;
          } else {
            throw new Error('Token验证失败');
          }
        } catch (error) {
          retryCount++;
          if (retryCount >= maxRetries) {
            throw error;
          }
          this.logger.warn(`认证尝试 ${retryCount} 失败，准备重试...`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒后重试
        }
      }
      
      throw new Error('超过最大重试次数');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('GitHub认证失败:', errorMessage);
      throw new Error(`GitHub认证失败: ${errorMessage}`);
    }
  }

  private buildAuthUrl(): string {
    const state = Math.random().toString(36).substring(7);
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.redirectUrl,
      scope: this.config.scopes.join(' '),
      response_type: 'code',
      state,
      allow_signup: 'false' // 禁止注册新用户
    });

    const url = `https://github.com/login/oauth/authorize?${params.toString()}`;
    this.logger.debug('构建认证URL:', {
      url,
      redirectUri: this.redirectUrl,
      state
    });
    return url;
  }

  private async launchWebAuthFlow(authUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        {
          url: authUrl,
          interactive: true
        },
        (redirectUrl) => {
          if (chrome.runtime.lastError) {
            const error = chrome.runtime.lastError;
            this.logger.error('认证流程错误:', error);
            
            if (error.message.includes('User cancelled')) {
              reject(new Error('用户取消了认证'));
            } else if (error.message.includes('Authorization page could not be loaded')) {
              reject(new Error('无法加载授权页面，请检查网络连接'));
            } else {
              reject(new Error(`认证流程错误: ${error.message}`));
            }
          } else if (!redirectUrl) {
            this.logger.error('认证失败：未获取到重定向URL');
            reject(new Error('认证失败：未获取到重定向URL'));
          } else {
            this.logger.debug('认证流程完成，重定向URL:', redirectUrl);
            resolve(redirectUrl);
          }
        }
      );
    });
  }

  private extractCode(redirectUrl: string): string {
    try {
      const url = new URL(redirectUrl);
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');
      const errorDescription = url.searchParams.get('error_description');

      if (error) {
        throw new Error(`GitHub返回错误: ${error} - ${errorDescription || '未知错误'}`);
      }

      if (!code) {
        throw new Error('未在重定向URL中找到授权码');
      }

      return code;
    } catch (error) {
      this.logger.error('解析重定向URL失败:', error);
      throw new Error(`解析重定向URL失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async exchangeCodeForToken(code: string): Promise<GitHubToken> {
    try {
      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          code: code,
          redirect_uri: this.redirectUrl
        })
      });

      this.logger.debug('Token请求状态:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`获取访问令牌失败 (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`GitHub API错误: ${data.error_description || data.error}`);
      }

      if (!data.access_token) {
        throw new Error('GitHub响应中未包含访问令牌');
      }

      return {
        accessToken: data.access_token,
        tokenType: data.token_type || 'bearer',
        scope: data.scope || this.config.scopes.join(' ')
      };
    } catch (error) {
      this.logger.error('交换令牌失败:', error);
      throw error;
    }
  }

  private async validateToken(token: GitHubToken): Promise<boolean> {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `${token.tokenType} ${token.accessToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      return response.ok;
    } catch (error) {
      this.logger.error('验证token失败:', error);
      return false;
    }
  }

  private async saveToken(token: GitHubToken): Promise<void> {
    try {
      await chrome.storage.local.set({ 
        github_token: token,
        token_timestamp: Date.now()
      });
      this.logger.info('GitHub令牌已保存');
    } catch (error) {
      this.logger.error('保存GitHub令牌失败:', error);
      throw error;
    }
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