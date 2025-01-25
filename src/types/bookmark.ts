/**
 * 书签节点接口定义
 */
export interface BookmarkNode {
  id: string;
  title: string;
  url?: string;
  parentId?: string;
  dateAdded: number;
  index: number;
  children?: BookmarkNode[];
}

/**
 * 书签同步状态
 */
export enum BookmarkSyncStatus {
  IDLE = 'idle',
  SYNCING = 'syncing',
  SUCCESS = 'success',
  ERROR = 'error'
}

/**
 * 书签操作类型
 */
export enum BookmarkOperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  MOVE = 'move'
}

/**
 * 书签变更记录
 */
export type BookmarkChange =
  | {
      type: 'create';
      id: string;
      title: string;
      url?: string;
      parentId: string;
      index: number;
    }
  | {
      type: 'update';
      id: string;
      title?: string;
      url?: string;
    }
  | {
      type: 'remove';
      id: string;
      parentId: string;
      index: number;
      title: string;
      url?: string;
    }
  | {
      type: 'move';
      id: string;
      oldParentId: string;
      oldIndex: number;
      newParentId: string;
      newIndex: number;
    };

/**
 * 进度事件类型
 */
export enum ProgressEventType {
  START = 'start',
  PROGRESS = 'progress',
  SUCCESS = 'success',
  ERROR = 'error'
}

/**
 * 进度通知接口
 */
export interface ProgressNotification {
  type: ProgressEventType;
  message: string;
  progress?: number;
  error?: Error;
}

/**
 * Git配置接口
 */
export interface GitConfig {
  platform: 'github' | 'gitee';
  token: string;
  owner: string;
  repo: string;
  branch: string;
  gistId?: string;
}

/**
 * 同步状态接口
 */
export interface SyncStatus {
  lastSync: number;
  status: 'success' | 'error' | 'syncing';
  error?: string;
  bookmarkCount?: number;
}

/**
 * 书签同步数据
 */
export interface BookmarkSyncData {
  version: string;
  lastModified: number;
  deviceId: string;
  bookmarks: BookmarkNode[];
  metadata: {
    totalCount: number;
    folderCount: number;
    lastSync: number;
    syncVersion: string;
  };
}

/**
 * 书签同步配置
 */
export interface SyncConfig {
  syncType: 'gist' | 'repo';
  syncInterval: number;
  autoSync: boolean;
  deviceId: string;
  lastSyncTime?: number;
  gitConfig: {
    token: string;
    gistId?: string;
    owner?: string;
    repo?: string;
    branch?: string;
  };
}

/**
 * 书签操作记录
 */
export type BookmarkOperation = BookmarkChange;

/**
 * 同步状态接口
 */
export interface SyncState {
  status: ProgressEventType;
  message: string;
  progress: number;
  lastSyncTime: number;
  localStats?: {
    bookmarkCount: number;
    folderCount: number;
  };
  remoteStats?: {
    bookmarkCount: number;
    folderCount: number;
  };
} 