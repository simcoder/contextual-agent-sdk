import { createClient, RedisClientType } from 'redis';
import { 
  StorageProvider, 
  StorageConfig, 
  SessionFilter, 
  StorageStats,
  StorageEventHandler,
  StorageEvent,
  StorageEventType
} from '../types/storage';
import { SessionState } from '../types';

export class RedisStorageProvider implements StorageProvider {
  private client: RedisClientType;
  private readonly prefix: string = 'session:';
  private readonly eventHandlers: Set<StorageEventHandler> = new Set();
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: StorageConfig) {
    const clientConfig: any = {
      url: config.url,
      username: config.username,
      password: config.password
    };

    if (config.ssl) {
      clientConfig.socket = {
        tls: true,
        rejectUnauthorized: false
      };
    }

    this.client = createClient(clientConfig);

    // Set up reconnection strategy
    this.client.on('error', (error) => {
      this.emitEvent(this.createEvent('error', error));
    });

    this.client.on('reconnecting', (retries) => {
      if (retries > (config.retryAttempts || 3)) {
        this.emitEvent(this.createEvent('error', 
          new Error('Redis connection failed after max retries')
        ));
      }
    });

    // Start cleanup timer if configured
    if (config.cleanupInterval && config.maxAge) {
      this.cleanupTimer = setInterval(() => {
        this.cleanup(config.maxAge!).catch(error => {
          this.emitEvent(this.createEvent('error', error));
        });
      }, config.cleanupInterval);
    }
  }

  async createSession(sessionId: string, session: SessionState): Promise<void> {
    const key = this.getKey(sessionId);
    await this.client.set(key, JSON.stringify(session));
    
    // Set expiration if maxAge is configured
    if (session.metadata?.maxAge) {
      await this.client.expire(key, Math.floor(session.metadata.maxAge / 1000));
    }

    this.emitEvent(this.createEvent('session_created', sessionId));
  }

  async getSession(sessionId: string): Promise<SessionState | null> {
    const data = await this.client.get(this.getKey(sessionId));
    if (!data) return null;

    try {
      const session = JSON.parse(data) as SessionState;
      // Convert date strings back to Date objects
      session.startTime = new Date(session.startTime);
      session.lastActivity = new Date(session.lastActivity);
      session.context.memoryBank = session.context.memoryBank.map(memory => ({
        ...memory,
        timestamp: new Date(memory.timestamp)
      }));
      return session;
    } catch (error) {
      this.emitEvent(this.createEvent('error', error as Error));
      return null;
    }
  }

  async updateSession(sessionId: string, session: SessionState): Promise<void> {
    const key = this.getKey(sessionId);
    await this.client.set(key, JSON.stringify(session));
    
    // Refresh expiration
    if (session.metadata?.maxAge) {
      await this.client.expire(key, Math.floor(session.metadata.maxAge / 1000));
    }

    this.emitEvent(this.createEvent('session_updated', sessionId));
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const result = await this.client.del(this.getKey(sessionId));
    const deleted = result === 1;
    
    if (deleted) {
      this.emitEvent(this.createEvent('session_deleted', sessionId));
    }
    
    return deleted;
  }

  async getSessions(filter?: SessionFilter): Promise<SessionState[]> {
    const keys = await this.client.keys(`${this.prefix}*`);
    const sessions: SessionState[] = [];

    for (const key of keys) {
      const data = await this.client.get(key);
      if (!data) continue;

      try {
        const session = JSON.parse(data) as SessionState;
        
        // Apply filters
        if (this.matchesFilter(session, filter)) {
          // Convert dates
          session.startTime = new Date(session.startTime);
          session.lastActivity = new Date(session.lastActivity);
          session.context.memoryBank = session.context.memoryBank.map(memory => ({
            ...memory,
            timestamp: new Date(memory.timestamp)
          }));
          sessions.push(session);
        }
      } catch (error) {
        this.emitEvent(this.createEvent('error', error as Error));
      }
    }

    return sessions;
  }

  async deleteSessions(filter?: SessionFilter): Promise<number> {
    const sessions = await this.getSessions(filter);
    let deleted = 0;

    for (const session of sessions) {
      const success = await this.deleteSession(session.sessionId);
      if (success) deleted++;
    }

    return deleted;
  }

  async cleanup(maxAge: number): Promise<void> {
    this.emitEvent(this.createEvent('cleanup_started'));
    
    const now = Date.now();
    const sessions = await this.getSessions();
    let deleted = 0;

    for (const session of sessions) {
      const age = now - session.lastActivity.getTime();
      if (age > maxAge) {
        const success = await this.deleteSession(session.sessionId);
        if (success) deleted++;
      }
    }

    this.emitEvent(this.createEvent('cleanup_completed', deleted));
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }

  async getStats(): Promise<StorageStats> {
    const sessions = await this.getSessions();
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const activeSessions = sessions.filter(s => 
      s.lastActivity.getTime() > oneDayAgo
    );

    const durations = sessions.map(s => 
      s.lastActivity.getTime() - s.startTime.getTime()
    );

    const avgDuration = durations.length > 0 
      ? durations.reduce((a, b) => a + b, 0) / durations.length 
      : 0;

    const modalityCount = sessions.reduce(
      (acc, s) => {
        acc[s.currentModality]++;
        return acc;
      }, 
      { text: 0, voice: 0 }
    );

    // Estimate storage size
    const storageSize = sessions.reduce((size, session) => {
      return size + JSON.stringify(session).length;
    }, 0);

    return {
      totalSessions: sessions.length,
      activeSessionsLast24h: activeSessions.length,
      averageSessionDuration: avgDuration,
      modalityDistribution: modalityCount,
      storageSize
    };
  }

  // Event handling
  public on(handler: StorageEventHandler): void {
    this.eventHandlers.add(handler);
  }

  public off(handler: StorageEventHandler): void {
    this.eventHandlers.delete(handler);
  }

  // Helper methods
  private getKey(sessionId: string): string {
    return `${this.prefix}${sessionId}`;
  }

  private emitEvent(event: StorageEvent): void {
    this.eventHandlers.forEach(handler => handler(event));
  }

  private createEvent(type: StorageEventType, data?: string | number | Error): StorageEvent {
    switch (type) {
      case 'session_created':
      case 'session_updated':
      case 'session_deleted':
        return { type, sessionId: data as string };
      case 'cleanup_completed':
        return { type, deletedCount: data as number };
      case 'error':
        return { type, error: data as Error };
      default:
        return { type };
    }
  }

  private matchesFilter(session: SessionState, filter?: SessionFilter): boolean {
    if (!filter) return true;

    if (filter.userId && session.userId !== filter.userId) {
      return false;
    }

    if (filter.modality && session.currentModality !== filter.modality) {
      return false;
    }

    if (filter.startTime) {
      const startTime = new Date(session.startTime).getTime();
      if (filter.startTime.from && startTime < filter.startTime.from.getTime()) {
        return false;
      }
      if (filter.startTime.to && startTime > filter.startTime.to.getTime()) {
        return false;
      }
    }

    if (filter.lastActivity) {
      const lastActivity = new Date(session.lastActivity).getTime();
      if (filter.lastActivity.from && lastActivity < filter.lastActivity.from.getTime()) {
        return false;
      }
      if (filter.lastActivity.to && lastActivity > filter.lastActivity.to.getTime()) {
        return false;
      }
    }

    return true;
  }

  // Cleanup
  public async shutdown(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    await this.client.quit();
  }
} 