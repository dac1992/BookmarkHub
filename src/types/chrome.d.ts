declare namespace chrome {
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

  export interface BookmarkMoveInfo {
    parentId: string;
    index: number;
    oldParentId: string;
    oldIndex: number;
  }

  export interface BookmarkCreateArg {
    parentId?: string;
    index?: number;
    title: string;
    url?: string;
  }

  export interface BookmarkChangesArg {
    title?: string;
    url?: string;
  }

  export interface ChromeEvent<T> {
    addListener(callback: T): void;
    removeListener(callback: T): void;
    hasListener(callback: T): boolean;
    hasListeners(): boolean;
  }

  export interface SyncStorageArea {
    get(keys?: string | string[] | object | null): Promise<{ [key: string]: any }>;
    set(items: { [key: string]: any }): Promise<void>;
    remove(keys: string | string[]): Promise<void>;
    QUOTA_BYTES: number;
    QUOTA_BYTES_PER_ITEM: number;
    MAX_ITEMS: number;
    MAX_WRITE_OPERATIONS_PER_HOUR: number;
    MAX_WRITE_OPERATIONS_PER_MINUTE: number;
  }

  export interface LocalStorageArea {
    get(keys?: string | string[] | object | null): Promise<{ [key: string]: any }>;
    set(items: { [key: string]: any }): Promise<void>;
    remove(keys: string | string[]): Promise<void>;
    QUOTA_BYTES: number;
    getBytesInUse(keys?: string | string[]): Promise<number>;
    clear(): Promise<void>;
  }

  export namespace bookmarks {
    export function get(idOrIdList: string | string[]): Promise<BookmarkTreeNode[]>;
    export function getTree(): Promise<BookmarkTreeNode[]>;
    export function create(bookmark: BookmarkCreateArg): Promise<BookmarkTreeNode>;
    export function update(id: string, changes: BookmarkChangesArg): Promise<BookmarkTreeNode>;
    export function remove(id: string): Promise<void>;
    export const onCreated: ChromeEvent<(id: string, bookmark: BookmarkTreeNode) => void>;
    export const onChanged: ChromeEvent<(id: string, changeInfo: BookmarkChangeInfo) => void>;
    export const onRemoved: ChromeEvent<(id: string, removeInfo: BookmarkRemoveInfo) => void>;
    export const onMoved: ChromeEvent<(id: string, moveInfo: BookmarkMoveInfo) => void>;
  }

  export namespace storage {
    export const sync: SyncStorageArea;
    export const local: LocalStorageArea;
  }
}

declare global {
  interface Window {
    chrome: typeof chrome;
  }
}

export {}; 