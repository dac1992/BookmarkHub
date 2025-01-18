// Chrome API 类型声明
declare namespace chrome {
  namespace bookmarks {
    interface BookmarkTreeNode {
      id: string;
      parentId?: string;
      title: string;
      url?: string;
      dateAdded?: number;
      dateGroupModified?: number;
      index?: number;
      children?: BookmarkTreeNode[];
    }

    interface BookmarkCreateArg {
      parentId?: string;
      index?: number;
      title?: string;
      url?: string;
    }

    function getTree(callback: (results: BookmarkTreeNode[]) => void): void;
    function create(bookmark: BookmarkCreateArg): Promise<BookmarkTreeNode>;
    function remove(id: string): Promise<void>;
  }

  namespace runtime {
    const lastError: {message: string} | undefined;
  }

  namespace storage {
    interface StorageArea {
      get(keys: string | string[] | null): Promise<{[key: string]: any}>;
      set(items: {[key: string]: any}): Promise<void>;
    }
    const local: StorageArea;
  }
} 