export interface ErrorLog {
  id: string;
  name: string;
  message: string;
  context: string;
  timestamp: number;
  details?: any;
  stack?: string;
} 