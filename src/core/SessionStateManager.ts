import { 
  SessionState, 
  ConversationContext, 
  Message, 
  Modality, 
  MemoryItem,
  ExtractedEntity,
  FlowState,
  SessionMetadata
} from '../types';

import { StorageProvider } from '../types/storage';
import { StorageFactory, StorageFactoryConfig } from '../storage/StorageFactory';

export class SessionStateManager {
  private storage: StorageProvider;

  constructor(storageConfig?: StorageFactoryConfig) {
    // Initialize storage provider (defaults to memory if no config)
    this.storage = storageConfig ? 
      StorageFactory.createProvider(storageConfig) : 
      StorageFactory.createFromEnv();
  }

  /**
   * Creates a new session or retrieves existing one
   */
  public async createSession(sessionId: string, userId?: string): Promise<SessionState> {
    const existingSession = await this.storage.getSession(sessionId);
    if (existingSession) {
      return existingSession;
    }

    const session: SessionState = {
      sessionId,
      userId,
      startTime: new Date(),
      lastActivity: new Date(),
      currentModality: 'text', // Default to text
      totalMessages: 0,
      context: this.createEmptyContext(),
      metadata: this.createEmptyMetadata()
    };

    await this.storage.createSession(sessionId, session);
    return session;
  }

  /**
   * THE CORE INNOVATION: Context bridging between modalities
   */
  public async bridgeContextForModality(
    sessionId: string, 
    targetModality: Modality
  ): Promise<string> {
    const session = await this.storage.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const currentModality = session.currentModality;
    
    // If same modality, return recent context
    if (currentModality === targetModality) {
      return this.getRecentContext(session, 3);
    }

    // CONTEXT BRIDGING LOGIC
    let bridgedContext = '';

    if (currentModality === 'voice' && targetModality === 'text') {
      // Voice to Text: Make it more structured and detailed
      bridgedContext = this.bridgeVoiceToText(session);
    } else if (currentModality === 'text' && targetModality === 'voice') {
      // Text to Voice: Make it more conversational and natural
      bridgedContext = this.bridgeTextToVoice(session);
    }

    // Mark that context bridging occurred
    this.addFlowState(session, 'context_bridged', targetModality, {
      from: currentModality,
      to: targetModality,
      bridgeType: `${currentModality}_to_${targetModality}`
    });

    // Save updated session
    await this.storage.updateSession(sessionId, session);

    return bridgedContext;
  }

  public async getSession(sessionId: string): Promise<SessionState | null> {
    return this.storage.getSession(sessionId);
  }

  public async updateSession(
    sessionId: string, 
    message: Message, 
    modality: Modality
  ): Promise<SessionState> {
    const session = await this.storage.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Track modality switches
    if (session.currentModality !== modality) {
      session.metadata.modalitySwitches++;
      this.addFlowState(session, 'modality_switch', modality, {
        from: session.currentModality,
        to: modality
      });
    }

    session.currentModality = modality;
    session.totalMessages++;
    session.lastActivity = new Date();

    // Add message to memory bank
    this.addToMemoryBank(session, message);

    // Extract entities and update context
    this.updateContextFromMessage(session, message);

    await this.storage.updateSession(sessionId, session);
    return session;
  }

  public async getConversationSummary(sessionId: string): Promise<string> {
    const session = await this.storage.getSession(sessionId);
    if (!session) return '';

    const { context } = session;
    const recentMemories = context.memoryBank
      .sort((a: MemoryItem, b: MemoryItem) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 5);

    let summary = '';
    
    if (context.topic) {
      summary += `Topic: ${context.topic}\n`;
    }

    if (recentMemories.length > 0) {
      summary += `Recent conversation:\n`;
      recentMemories.forEach((memory: MemoryItem) => {
        summary += `- ${memory.content} (${memory.modality})\n`;
      });
    }

    return summary;
  }

  public async destroySession(sessionId: string): Promise<boolean> {
    return this.storage.deleteSession(sessionId);
  }

  // Private helper methods
  private createEmptyContext(): ConversationContext {
    return {
      entities: [],
      conversationFlow: [],
      memoryBank: []
    };
  }

  private createEmptyMetadata(): SessionMetadata {
    return {
      modalitySwitches: 0,
      averageResponseTime: 0
    };
  }

  private addToMemoryBank(session: SessionState, message: Message): void {
    const memory: MemoryItem = {
      id: message.id,
      content: message.content,
      importance: this.calculateImportance(message),
      timestamp: message.timestamp,
      tags: this.extractTags(message.content),
      modality: message.modality
    };

    session.context.memoryBank.push(memory);

    // Keep only last 50 memories for performance
    if (session.context.memoryBank.length > 50) {
      session.context.memoryBank = session.context.memoryBank
        .sort((a: MemoryItem, b: MemoryItem) => b.importance - a.importance || b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 50);
    }
  }

  private updateContextFromMessage(session: SessionState, message: Message): void {
    // Simple entity extraction (in production, use NLP service)
    const entities = this.extractEntities(message.content);
    
    // Add new entities
    entities.forEach((entity: ExtractedEntity) => {
      const existing = session.context.entities.find((e: ExtractedEntity) => 
        e.name === entity.name && e.type === entity.type
      );
      
      if (!existing) {
        session.context.entities.push({
          ...entity,
          source: message.modality
        });
      }
    });

    // Simple topic detection
    if (!session.context.topic) {
      session.context.topic = this.detectTopic(message.content);
    }
  }

  private addFlowState(
    session: SessionState, 
    step: string, 
    modality: Modality, 
    data?: Record<string, any>
  ): void {
    const flowState: FlowState = {
      step,
      modality,
      timestamp: new Date(),
      data
    };

    session.context.conversationFlow.push(flowState);

    // Keep only last 20 flow states
    if (session.context.conversationFlow.length > 20) {
      session.context.conversationFlow = session.context.conversationFlow.slice(-20);
    }
  }

  private bridgeVoiceToText(session: SessionState): string {
    const recentVoiceMemories = session.context.memoryBank
      .filter(m => m.modality === 'voice')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 3);

    if (recentVoiceMemories.length === 0) {
      return this.getRecentContext(session, 3);
    }

    let context = "Previous voice conversation context:\n";
    recentVoiceMemories.forEach((memory, index) => {
      context += `${index + 1}. ${memory.content}\n`;
    });

    context += "\nNow switching to text mode - please provide structured responses.";
    
    return context;
  }

  private bridgeTextToVoice(session: SessionState): string {
    const recentTextMemories = session.context.memoryBank
      .filter(m => m.modality === 'text')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 3);

    if (recentTextMemories.length === 0) {
      return this.getRecentContext(session, 3);
    }

    let context = "We were just discussing: ";
    const topics = recentTextMemories.map(m => {
      return m.content.length > 100 ? 
        m.content.substring(0, 100) + "..." : 
        m.content;
    }).join(". ");

    context += topics;
    context += ". Now switching to voice conversation - please speak naturally.";

    return context;
  }

  private getRecentContext(session: SessionState, count: number = 5): string {
    const recentMemories = session.context.memoryBank
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, count);

    return recentMemories.map(m => m.content).join("\n");
  }

  private calculateImportance(message: Message): number {
    let score = 0.5; // Base score
    if (message.content.includes('?')) score += 0.3;
    if (message.content.length > 100) score += 0.2;
    if (message.role === 'system') score -= 0.3;
    return Math.max(0, Math.min(1, score));
  }

  private extractTags(content: string): string[] {
    const tags: string[] = [];
    if (content.includes('question') || content.includes('?')) tags.push('question');
    if (content.includes('help') || content.includes('support')) tags.push('help');
    return tags;
  }

  private extractEntities(content: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    
    // Email detection
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = content.match(emailRegex);
    if (emails) {
      emails.forEach(email => {
        entities.push({
          name: email,
          type: 'email',
          value: email,
          confidence: 0.9,
          source: 'text'
        });
      });
    }

    return entities;
  }

  private detectTopic(content: string): string {
    const lowercaseContent = content.toLowerCase();
    
    if (lowercaseContent.includes('order') || lowercaseContent.includes('shipping')) {
      return 'order_management';
    }
    
    if (lowercaseContent.includes('account') || lowercaseContent.includes('profile')) {
      return 'account_management';
    }
    
    return 'general';
  }

  public async shutdown(): Promise<void> {
    await this.storage.shutdown();
  }
} 