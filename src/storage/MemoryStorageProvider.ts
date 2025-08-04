import { 
  StorageProvider, 
  StorageConfig, 
  SessionFilter, 
  StorageStats,
  StorageEvent,
  StorageEventHandler
} from '../types/storage';
import { SessionState } from '../types';

/**
 * In-memory storage provider for development and testing
 * DO NOT use in production - sessions are lost on restart
 */
export class MemoryStorageProvider implements StorageProvider {
  private sessions: Map<string, SessionState> = new Map();
  private readonly eventHandlers: Set<StorageEventHandler> = new Set();
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config?: StorageConfig) {
    // Start cleanup timer if configured
    if (config?.cleanupInterval && config?.maxAge) {
      this.cleanupTimer = setInterval(() => {
        this.cleanup(config.maxAge!).catch(error => {
          this.emitEvent({ type: 'error', error });
        });
      }, config.cleanupInterval);
    }
  }

  async createSession(sessionId: string, session: SessionState): Promise<void> {
    this.sessions.set(sessionId, {
      ...session,
      startTime: new Date(session.startTime),
      lastActivity: new Date(session.lastActivity)
    });
    this.emitEvent({ type: 'session_created', sessionId });
  }

  async getSession(sessionId: string): Promise<SessionState | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    return this.cloneSession(session);
  }

  async updateSession(sessionId: string, session: SessionState): Promise<void> {
    this.sessions.set(sessionId, {
      ...session,
      startTime: new Date(session.startTime),
      lastActivity: new Date(session.lastActivity)
    });
    this.emitEvent({ type: 'session_updated', sessionId });
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      this.emitEvent({ type: 'session_deleted', sessionId });
    }
    return deleted;
  }

  async getSessions(filter?: SessionFilter): Promise<SessionState[]> {
    let sessions = Array.from(this.sessions.values())
      .map(session => this.cloneSession(session));

    if (filter) {
      sessions = sessions.filter(session => {
        if (filter.userId && session.userId !== filter.userId) return false;
        if (filter.modality && session.currentModality !== filter.modality) return false;
        
        const startTime = session.startTime.getTime();
        if (filter.startTime?.from && startTime < filter.startTime.from.getTime()) return false;
        if (filter.startTime?.to && startTime > filter.startTime.to.getTime()) return false;
        
        const lastActivity = session.lastActivity.getTime();
        if (filter.lastActivity?.from && lastActivity < filter.lastActivity.from.getTime()) return false;
        if (filter.lastActivity?.to && lastActivity > filter.lastActivity.to.getTime()) return false;
        
        return true;
      });
    }

    return sessions;
  }

  async deleteSessions(filter?: SessionFilter): Promise<number> {
    const sessionsToDelete = await this.getSessions(filter);
    let deleted = 0;

    for (const session of sessionsToDelete) {
      const success = await this.deleteSession(session.sessionId);
      if (success) deleted++;
    }

    return deleted;
  }

  async cleanup(maxAge: number): Promise<void> {
    this.emitEvent({ type: 'cleanup_started' });
    
    const now = Date.now();
    let deleted = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      const age = now - session.lastActivity.getTime();
      if (age > maxAge) {
        const success = await this.deleteSession(sessionId);
        if (success) deleted++;
      }
    }

    this.emitEvent({ type: 'cleanup_completed', deletedCount: deleted });
  }

  async healthCheck(): Promise<boolean> {
    return true; // Memory storage is always healthy
  }

  async getStats(): Promise<StorageStats> {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const sessions = Array.from(this.sessions.values());

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

  private emitEvent(event: StorageEvent): void {
    this.eventHandlers.forEach(handler => handler(event));
  }

  // Helper methods
  private cloneSession(session: SessionState): SessionState {
    return {
      ...session,
      startTime: new Date(session.startTime),
      lastActivity: new Date(session.lastActivity),
      context: {
        ...session.context,
        memoryBank: session.context.memoryBank.map(memory => ({
          ...memory,
          timestamp: new Date(memory.timestamp)
        }))
      }
    };
  }

  public async shutdown(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.sessions.clear();
  }
} 