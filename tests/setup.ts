import { Mock, jest } from '@jest/globals';
import { BookmarkTreeNode } from '../src/types/bookmark';

declare global {
  interface Window {
    chrome: {
      bookmarks: {
        getTree: Mock;
        get: Mock;
        create: Mock;
        update: Mock;
        remove: Mock;
        onCreated: { addListener: Mock };
        onChanged: { addListener: Mock };
        onRemoved: { addListener: Mock };
        onMoved: { addListener: Mock };
      };
      storage: {
        sync: {
          get: Mock;
          set: Mock;
          remove: Mock;
        };
        local: {
          get: Mock;
          set: Mock;
          remove: Mock;
        };
      };
    };
  }
}

// Mock Chrome API
const mockChrome = {
  bookmarks: {
    getTree: jest.fn(),
    get: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    onCreated: { addListener: jest.fn() },
    onChanged: { addListener: jest.fn() },
    onRemoved: { addListener: jest.fn() },
    onMoved: { addListener: jest.fn() }
  },
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn()
    },
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn()
    }
  }
};

// Mock fetch API
global.fetch = jest.fn();

// Assign mock to window.chrome
Object.defineProperty(window, 'chrome', {
  value: mockChrome,
  writable: true
});

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
}); 