import { BookmarkOperation } from './bookmark';

export interface HistoryEntry {
  id: string;
  timestamp: number;
  operation: BookmarkOperation;
  status: 'success' | 'error' | 'pending';
  error?: string;
}

export interface HistoryState {
  entries: HistoryEntry[];
  lastSync: number;
  maxEntries: number;
}

export interface RollbackResult {
  success: boolean;
  error?: string;
  affectedBookmarks?: string[];
} 