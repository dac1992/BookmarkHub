import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { BookmarkService } from '../../src/services/BookmarkService';
import { GitService } from '../../src/services/GitService';
import { GitHubService } from '../../src/services/GitHubService';
import { ConfigService } from '../../src/services/ConfigService';
import { ProgressEventType } from '../../src/types/bookmark';
import type { BookmarkTreeNode } from '../../src/types/bookmark';

describe('书签同步功能测试', () => {
  let bookmarkService: BookmarkService;
  let gitService: GitService;
  let githubService: GitHubService;
  let configService: ConfigService;

  // 模拟书签数据
  const mockBookmarks: BookmarkTreeNode[] = [
    {
      id: '1',
      title: '根文件夹',
      children: [
        {
          id: '2',
          parentId: '1',
          title: '子文件夹1',
          children: [
            {
              id: '3',
              parentId: '2',
              title: '书签1',
              url: 'https://example.com/1'
            }
          ]
        },
        {
          id: '4',
          parentId: '1',
          title: '书签2',
          url: 'https://example.com/2'
        }
      ]
    }
  ];

  beforeEach(() => {
    // 重置所有服务实例
    jest.clearAllMocks();
    
    // 模拟 Chrome API 返回
    (chrome.bookmarks.getTree as jest.Mock).mockImplementation((callback) => {
      callback(mockBookmarks);
    });

    // 模拟配置
    (chrome.storage.sync.get as jest.Mock).mockImplementation((key, callback) => {
      callback({
        githubSettings: {
          syncType: 'gist',
          token: 'mock-token',
          gistId: 'mock-gist-id'
        }
      });
    });

    // 模拟 fetch 响应
    (global.fetch as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          files: {
            'bookmarks.json': {
              content: '[]'
            }
          }
        })
      })
    );

    // 获取服务实例
    bookmarkService = BookmarkService.getInstance();
    gitService = GitService.getInstance();
    githubService = GitHubService.getInstance();
    configService = ConfigService.getInstance();
  });

  describe('获取书签测试', () => {
    it('应该能正确获取所有书签', async () => {
      const progressEvents: any[] = [];
      bookmarkService.addProgressListener((notification) => {
        progressEvents.push(notification);
      });

      const bookmarks = await bookmarkService.getAllBookmarks();

      // 验证进度事件
      expect(progressEvents).toContainEqual(
        expect.objectContaining({
          type: ProgressEventType.LOADING,
          message: '正在加载书签数据...'
        })
      );
      expect(progressEvents).toContainEqual(
        expect.objectContaining({
          type: ProgressEventType.COMPLETE,
          message: '书签数据加载完成'
        })
      );

      // 验证书签数据结构
      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0].children).toBeDefined();
      expect(bookmarks[0].children![0].children![0].url).toBe('https://example.com/1');
    });

    it('应该能处理大量书签而不堆栈溢出', async () => {
      // 生成大量书签数据
      const generateLargeBookmarks = (depth: number, breadth: number): BookmarkTreeNode[] => {
        if (depth === 0) return [];
        const result = [];
        for (let i = 0; i < breadth; i++) {
          result.push({
            id: `${depth}-${i}`,
            title: `Folder ${depth}-${i}`,
            children: generateLargeBookmarks(depth - 1, breadth)
          });
        }
        return result;
      };

      const largeBookmarks = generateLargeBookmarks(5, 10); // 5层深，每层10个节点
      (chrome.bookmarks.getTree as jest.Mock).mockImplementation((callback) => {
        callback(largeBookmarks);
      });

      const bookmarks = await bookmarkService.getAllBookmarks();
      expect(bookmarks).toBeDefined();
    });
  });

  describe('同步功能测试', () => {
    it('应该能成功上传书签到Gist', async () => {
      const bookmarks = await bookmarkService.getAllBookmarks();
      await gitService.uploadBookmarks(bookmarks);

      // 验证是否调用了正确的API
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('api.github.com/gists/'),
        expect.objectContaining({
          method: 'PATCH',
          headers: expect.objectContaining({
            'Accept': 'application/vnd.github.v3+json'
          })
        })
      );
    });

    it('应该能处理上传失败并重试', async () => {
      // 模拟前两次请求失败，第三次成功
      let attemptCount = 0;
      (global.fetch as jest.Mock).mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({})
        });
      });

      const bookmarks = await bookmarkService.getAllBookmarks();
      await gitService.uploadBookmarks(bookmarks);

      // 验证重试次数
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('应该能正确处理数据清理', async () => {
      const bookmarks = await bookmarkService.getAllBookmarks();
      await gitService.uploadBookmarks(bookmarks);

      // 验证上传的数据格式
      const calls = (global.fetch as jest.Mock).mock.calls;
      const lastCall = calls[calls.length - 1];
      const requestBody = JSON.parse(lastCall[1].body);
      
      // 验证数据结构
      expect(requestBody.files['bookmarks.json']).toBeDefined();
      const content = JSON.parse(requestBody.files['bookmarks.json'].content);
      
      // 验证数据清理
      const validateNode = (node: any) => {
        expect(node).toHaveProperty('id');
        expect(node).toHaveProperty('title');
        if (node.url) {
          expect(node.url).toMatch(/^https?:\/\//);
        }
        if (node.children) {
          node.children.forEach(validateNode);
        }
      };
      
      content.forEach(validateNode);
    });
  });

  describe('错误处理测试', () => {
    it('应该能处理网络错误', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const bookmarks = await bookmarkService.getAllBookmarks();
      await expect(gitService.uploadBookmarks(bookmarks)).rejects.toThrow('Network error');
    });

    it('应该能处理认证错误', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401
      });

      const bookmarks = await bookmarkService.getAllBookmarks();
      await expect(gitService.uploadBookmarks(bookmarks)).rejects.toThrow('GitHub API错误: 401');
    });

    it('应该能处理无效的书签数据', async () => {
      const invalidBookmarks = [{
        id: '1',
        // 缺少必要的字段
      }] as BookmarkTreeNode[];

      (chrome.bookmarks.getTree as jest.Mock).mockImplementation((callback) => {
        callback(invalidBookmarks);
      });

      const bookmarks = await bookmarkService.getAllBookmarks();
      expect(bookmarks[0]).toHaveProperty('title', '');
      expect(bookmarks[0]).toHaveProperty('url', '');
    });
  });
}); 