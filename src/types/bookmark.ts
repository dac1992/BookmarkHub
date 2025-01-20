/**
 * 书签节点接口定义
 */
export interface BookmarkNode {
  id: string;
  parentId?: string;
  title: string;
  url?: string;
  dateAdded: number;
  dateModified?: number;
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
export interface BookmarkChange {
  type: BookmarkOperationType;
  timestamp: number;
  node: BookmarkNode;
  oldNode?: BookmarkNode;
}

/**
 * 进度事件类型
 */
export enum ProgressEventType {
  LOADING = 'loading',
  PROCESSING = 'processing',
  SAVING = 'saving',
  COMPLETE = 'complete',
  ERROR = 'error'
}

/**
 * 进度通知接口
 */
export interface ProgressNotification {
  type: ProgressEventType;
  message: string;
  progress?: number;
  total?: number;
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
}

/**
 * 同步状态接口
 */
export interface SyncStatus {
  lastSync: number;
  status: 'success' | 'error' | 'syncing';
  error?: string;
}

/**
 * 书签操作记录
 */
export type BookmarkOperation = BookmarkChange; 