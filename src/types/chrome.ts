export interface BookmarkTreeNode {
  id: string;
  parentId?: string;
  index?: number;
  url?: string;
  title: string;
  dateAdded?: number;
  dateGroupModified?: number;
  children?: BookmarkTreeNode[];
}

export interface BookmarkChangeInfo {
  title?: string;
  url?: string;
}

export interface BookmarkRemoveInfo {
  parentId: string;
  index: number;
  node: BookmarkTreeNode;
}

export interface BookmarkCreateArg {
  parentId?: string;
  index?: number;
  title?: string;
  url?: string;
}

export interface ChromeBookmarks {
  get(idOrIdList: string | string[]): Promise<BookmarkTreeNode[]>;
  getTree(): Promise<BookmarkTreeNode[]>;
  create(bookmark: BookmarkCreateArg): Promise<BookmarkTreeNode>;
  update(id: string, changes: { title?: string; url?: string }): Promise<BookmarkTreeNode>;
  remove(id: string): Promise<void>;
  onCreated: {
    addListener(callback: (id: string, bookmark: BookmarkTreeNode) => void): void;
    removeListener(callback: (id: string, bookmark: BookmarkTreeNode) => void): void;
    hasListener(callback: (id: string, bookmark: BookmarkTreeNode) => void): boolean;
    hasListeners(): boolean;
  };
  onChanged: {
    addListener(callback: (id: string, changes: BookmarkChangeInfo) => void): void;
    removeListener(callback: (id: string, changes: BookmarkChangeInfo) => void): void;
    hasListener(callback: (id: string, changes: BookmarkChangeInfo) => void): boolean;
    hasListeners(): boolean;
  };
  onRemoved: {
    addListener(callback: (id: string, removeInfo: BookmarkRemoveInfo) => void): void;
    removeListener(callback: (id: string, removeInfo: BookmarkRemoveInfo) => void): void;
    hasListener(callback: (id: string, removeInfo: BookmarkRemoveInfo) => void): boolean;
    hasListeners(): boolean;
  };
  onMoved: {
    addListener(callback: (id: string, moveInfo: object) => void): void;
    removeListener(callback: (id: string, moveInfo: object) => void): void;
    hasListener(callback: (id: string, moveInfo: object) => void): boolean;
    hasListeners(): boolean;
  };
}

export interface ChromeStorage {
  sync: {
    get(keys?: string | string[] | object | null): Promise<{ [key: string]: any }>;
    set(items: { [key: string]: any }): Promise<void>;
    remove(keys: string | string[]): Promise<void>;
  };
  local: {
    get(keys?: string | string[] | object | null): Promise<{ [key: string]: any }>;
    set(items: { [key: string]: any }): Promise<void>;
    remove(keys: string | string[]): Promise<void>;
  };
}

export interface Chrome {
  bookmarks: ChromeBookmarks;
  storage: ChromeStorage;
} 