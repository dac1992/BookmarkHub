import { BookmarkService } from '../services/BookmarkService';
import { Logger } from '../utils/logger';

// 初始化服务
const bookmarkService = BookmarkService.getInstance();
const logger = Logger.getInstance();

// 监听书签变更
bookmarkService.addChangeListener((change) => {
  logger.info('书签变更:', change);
}); 