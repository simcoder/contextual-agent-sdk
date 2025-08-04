import { SessionState } from './index';

/**
 * Storage Provider Interface
 * Allows plugging in different storage backends (Redis, MongoDB, etc.)
 */
export interface StorageProvider {
  // Core CRUD operations
  createSession(sessionId: string, session: SessionState): Promise<void>;
  getSession(sessionId: string): Promise<SessionState | null>;
  updateSession(sessionId: string, session: SessionState): Promise<void>;
  deleteSession(sessionId: string): Promise<boolean>;
  
  // Batch operations
  getSessions(filter?: SessionFilter): Promise<SessionState[]>;
  deleteSessions(filter?: SessionFilter): Promise<number>;
  
  // Maintenance
  cleanup(maxAge: number): Promise<void>;
  healthCheck(): Promise<boolean>;
  
  // Optional analytics
  getStats(): Promise<StorageStats>;

  // Cleanup
  shutdown(): Promise<void>;
}

/**
 * Filter for querying sessions
 */
export interface SessionFilter {
  userId?: string;
  modality?: 'text' | 'voice';
  startTime?: {
    from?: Date;
    to?: Date;
  };
  lastActivity?: {
    from?: Date;
    to?: Date;
  };
}

/**
 * Storage statistics
 */
export interface StorageStats {
  totalSessions: number;
  activeSessionsLast24h: number;
  averageSessionDuration: number;
  modalityDistribution: {
    text: number;
    voice: number;
  };
  storageSize: number;  // in bytes
}

/**
 * Storage configuration options
 */
export interface StorageConfig {
  // Common options
  url?: string;  // Required for Redis/MongoDB, optional for memory
  maxConnections?: number;
  timeout?: number;
  retryAttempts?: number;
  
  // Security
  username?: string;
  password?: string;
  ssl?: boolean;
  certPath?: string;
  
  // Performance
  cacheSize?: number;
  compressionEnabled?: boolean;
  
  // Maintenance
  maxAge?: number;  // Max age in ms before session cleanup
  cleanupInterval?: number;  // Cleanup interval in ms
}

/**
 * Storage Events for monitoring
 */
export type StorageEventType = 
  | 'session_created'
  | 'session_updated'
  | 'session_deleted'
  | 'cleanup_started'
  | 'cleanup_completed'
  | 'error';

export type StorageEvent = {
  type: StorageEventType;
  sessionId?: string;
  deletedCount?: number;
  error?: Error;
};

/**
 * Storage Event Handler
 */
export type StorageEventHandler = (event: StorageEvent) => void; 