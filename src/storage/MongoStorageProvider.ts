import { MongoClient, Collection, Db } from 'mongodb';
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

interface MongoSessionState extends SessionState {
  _id: string;
}

export class MongoStorageProvider implements StorageProvider {
  private client: MongoClient;
  private db?: Db;
  private collection?: Collection<MongoSessionState>;
  private readonly eventHandlers: Set<StorageEventHandler> = new Set();
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: StorageConfig) {
    if (!config.url) {
      throw new Error('MongoDB URL is required');
    }

    this.client = new MongoClient(config.url, {
      auth: config.username ? {
        username: config.username,
        password: config.password!
      } : undefined,
      tls: config.ssl,
      tlsCertificateKeyFile: config.certPath,
      maxPoolSize: config.maxConnections,
      connectTimeoutMS: config.timeout
    });

    // Initialize connection and setup
    this.initialize(config).catch(error => {
      this.emitEvent(this.createEvent('error', error));
    });
  }

  private async initialize(config: StorageConfig): Promise<void> {
    await this.client.connect();
    this.db = this.client.db();
    this.collection = this.db.collection<MongoSessionState>('sessions');

    // Create indexes
    await this.collection.createIndex({ userId: 1 });
    await this.collection.createIndex({ 'lastActivity': 1 }, { expireAfterSeconds: 3600 }); // TTL index

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
    if (!this.collection) throw new Error('MongoDB not initialized');

    const mongoSession: MongoSessionState = {
      ...session,
      _id: sessionId
    };

    await this.collection.insertOne(mongoSession);
    this.emitEvent(this.createEvent('session_created', sessionId));
  }

  async getSession(sessionId: string): Promise<SessionState | null> {
    if (!this.collection) throw new Error('MongoDB not initialized');

    const session = await this.collection.findOne({ _id: sessionId });
    if (!session) return null;

    // Convert string dates back to Date objects
    return this.convertDates(session);
  }

  async updateSession(sessionId: string, session: SessionState): Promise<void> {
    if (!this.collection) throw new Error('MongoDB not initialized');

    await this.collection.updateOne(
      { _id: sessionId },
      { $set: session }
    );

    this.emitEvent(this.createEvent('session_updated', sessionId));
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    if (!this.collection) throw new Error('MongoDB not initialized');

    const result = await this.collection.deleteOne({ _id: sessionId });
    const deleted = result.deletedCount === 1;

    if (deleted) {
      this.emitEvent(this.createEvent('session_deleted', sessionId));
    }

    return deleted;
  }

  async getSessions(filter?: SessionFilter): Promise<SessionState[]> {
    if (!this.collection) throw new Error('MongoDB not initialized');

    const query = this.buildMongoQuery(filter);
    const sessions = await this.collection.find(query).toArray();

    // Convert dates in all sessions
    return sessions.map(session => this.convertDates(session));
  }

  async deleteSessions(filter?: SessionFilter): Promise<number> {
    if (!this.collection) throw new Error('MongoDB not initialized');

    const query = this.buildMongoQuery(filter);
    const result = await this.collection.deleteMany(query);
    return result.deletedCount;
  }

  async cleanup(maxAge: number): Promise<void> {
    if (!this.collection) throw new Error('MongoDB not initialized');

    this.emitEvent(this.createEvent('cleanup_started'));

    const result = await this.collection.deleteMany({
      lastActivity: { 
        $lt: new Date(Date.now() - maxAge) 
      }
    });

    this.emitEvent(this.createEvent('cleanup_completed', result.deletedCount));
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.db) return false;
      await this.db.command({ ping: 1 });
      return true;
    } catch {
      return false;
    }
  }

  async getStats(): Promise<StorageStats> {
    if (!this.collection) throw new Error('MongoDB not initialized');

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
      (acc: { text: number; voice: number }, s) => {
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

  private buildMongoQuery(filter?: SessionFilter): any {
    if (!filter) return {};

    const query: any = {};

    if (filter.userId) {
      query.userId = filter.userId;
    }

    if (filter.modality) {
      query.currentModality = filter.modality;
    }

    if (filter.startTime) {
      query.startTime = {};
      if (filter.startTime.from) {
        query.startTime.$gte = filter.startTime.from;
      }
      if (filter.startTime.to) {
        query.startTime.$lte = filter.startTime.to;
      }
    }

    if (filter.lastActivity) {
      query.lastActivity = {};
      if (filter.lastActivity.from) {
        query.lastActivity.$gte = filter.lastActivity.from;
      }
      if (filter.lastActivity.to) {
        query.lastActivity.$lte = filter.lastActivity.to;
      }
    }

    return query;
  }

  private convertDates(session: MongoSessionState): SessionState {
    const { _id, ...sessionData } = session;
    return {
      ...sessionData,
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

  // Cleanup
  public async shutdown(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    await this.client.close();
  }
} 