import { 
  AgentConfig, 
  AgentResponse, 
  Message, 
  Modality, 
  SessionState,
  ResponseData,
  ResponseMetadata,
  AgentEvent,
  AgentEventType
} from './types';

import { LLMProviderConfig } from './types/llm-providers';
import { SessionStateManager } from './core/SessionStateManager';
import { ContextBridge } from './core/ContextBridge';
import { ModalityRouter } from './core/ModalityRouter';
import { LLMManager, LLMManagerConfig } from './core/LLMManager';
import { ContextManager } from './core/ContextManager';

/**
 * ContextualAgent - Main SDK Class
 * 
 * THE CORE INNOVATION: Seamless context switching between voice and text
 * 
 * Usage:
 * ```typescript
 * const agent = new ContextualAgent(config);
 * const response = await agent.processMessage('Hello', 'text', 'session-123');
 * const voiceResponse = await agent.switchModality('voice', 'session-123');
 * ```
 */
export class ContextualAgent {
  private config: AgentConfig;
  private sessionManager: SessionStateManager;
  private contextBridge: ContextBridge;
  private modalityRouter: ModalityRouter;
  private llmManager?: LLMManager;
  private contextManager?: ContextManager;
  private eventListeners: Map<AgentEventType, Function[]> = new Map();

  constructor(config: AgentConfig, legacyOpenAIKey?: string) {
    this.config = config;
    this.sessionManager = new SessionStateManager(config.storage);
    this.contextBridge = new ContextBridge();
    this.modalityRouter = new ModalityRouter();
    
    // Initialize Context Manager with external providers
    this.initializeContextManager();
    
    // Initialize LLM Manager
    this.initializeLLMManager(legacyOpenAIKey);

    this.initializeEventListeners();
  }

  /**
   * MAIN METHOD: Process a message with automatic context bridging
   */
  public async processMessage(
    input: any,
    targetModality: Modality,
    sessionId: string,
    userId?: string
  ): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      // Create or get session
      let session = await this.sessionManager.getSession(sessionId);
      if (!session) {
        session = await this.sessionManager.createSession(sessionId, userId);
        this.emitEvent('session_started', sessionId, { userId });
      }

      // Detect input modality
      const inputModality = this.modalityRouter.detectModality(input);
      
      // Process the incoming message
      const userMessage = await this.modalityRouter.processMessage(
        input,
        inputModality,
        sessionId
      );

      this.emitEvent('message_received', sessionId, { 
        messageId: userMessage.id,
        modality: inputModality 
      });

      // Update session with user message
      session = await this.sessionManager.updateSession(sessionId, userMessage, inputModality);

      // THE CORE INNOVATION: Context bridging + External Knowledge Integration
      let contextualPrompt = '';
      
      if (session.currentModality !== targetModality) {
        // SEAMLESS CONTEXT SWITCHING
        contextualPrompt = await this.sessionManager.bridgeContextForModality(
          sessionId,
          targetModality
        );
        
        this.emitEvent('modality_switched', sessionId, {
          from: session.currentModality,
          to: targetModality
        });

        this.emitEvent('context_bridged', sessionId, {
          bridgeType: `${session.currentModality}_to_${targetModality}`
        });
      } else {
        // Same modality - get regular context
        contextualPrompt = await this.sessionManager.getConversationSummary(sessionId);
      }

      // ENHANCEMENT: Add external knowledge context (Knowledge Base + Database)
      let externalContext = '';
      if (this.contextManager) {
        try {
          const contextResults = await this.contextManager.getContext({ 
            query: userMessage.content,
            sessionId: sessionId,
            userId: userId,
            modality: targetModality
          });
          
          if (contextResults && contextResults.length > 0) {
            externalContext = this.contextManager.formatContext(contextResults);
            
            this.emitEvent('external_context_retrieved', sessionId, {
              contextSources: contextResults.length,
              hasExternalKnowledge: true
            });
          }
        } catch (error) {
          console.error('Failed to retrieve external context:', error);
          // Continue without external context - don't break the conversation
        }
      }

      // Combine conversation context with external knowledge
      const enhancedPrompt = this.combineContextSources(contextualPrompt, externalContext);

      // Generate AI response using enhanced context (conversation + external knowledge)
      const responseContent = await this.generateResponse(
        userMessage.content,
        enhancedPrompt,
        targetModality
      );

      // Prepare response in target modality
      const assistantMessage = await this.modalityRouter.prepareResponse(
        responseContent,
        targetModality,
        sessionId
      );

      // Update session with assistant response
      await this.sessionManager.updateSession(sessionId, assistantMessage, targetModality);

      this.emitEvent('message_sent', sessionId, { 
        messageId: assistantMessage.id,
        modality: targetModality 
      });

      // Build response
      const currentSession = await this.sessionManager.getSession(sessionId);
      if (!currentSession) {
        throw new Error('Session lost during processing');
      }

      const responseData: ResponseData = {
        message: assistantMessage,
        sessionState: currentSession
      };

      const responseMetadata: ResponseMetadata = {
        responseTime: Date.now() - startTime,
        tokensUsed: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }, // Would be filled by OpenAI
        modalityUsed: targetModality,
        contextBridgeTriggered: session.currentModality !== targetModality,
        processingSteps: [
          { step: 'message_processing', duration: 50, success: true },
          { step: 'context_bridging', duration: 10, success: true },
          { step: 'ai_generation', duration: Date.now() - startTime - 60, success: true }
        ]
      };

      return {
        success: true,
        data: responseData,
        metadata: responseMetadata
      };

    } catch (error) {
      this.emitEvent('error_occurred', sessionId, { error: error });

      return {
        success: false,
        error: {
          code: 'PROCESSING_ERROR',
          message: `Failed to process message: ${error}`,
          recoverable: true
        },
        metadata: {
          responseTime: Date.now() - startTime,
          tokensUsed: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          modalityUsed: targetModality,
          contextBridgeTriggered: false,
          processingSteps: [
            { step: 'error', duration: Date.now() - startTime, success: false, data: { error } }
          ]
        }
      };
    }
  }

  /**
   * Switch modality mid-conversation with context preservation
   */
  public async switchModality(
    newModality: Modality,
    sessionId: string
  ): Promise<AgentResponse> {
    const session = await this.sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Generate a context-aware message for the switch
    const switchMessage = `Switching to ${newModality} mode. How can I help you?`;
    
    return this.processMessage(switchMessage, newModality, sessionId);
  }

  /**
   * Initialize Context Manager with external knowledge providers
   */
  private initializeContextManager(): void {
    if (!this.config.contextProviders || this.config.contextProviders.length === 0) {
      // No context providers configured
      return;
    }

    try {
      this.contextManager = new ContextManager({
        providers: this.config.contextProviders,
        maxTokens: this.config.contextSettings?.contextWindowSize || 4000,
        defaultFormatter: (ctx) => typeof ctx.content === 'string' ? ctx.content : JSON.stringify(ctx.content),
        errorHandler: (error) => console.error('Context provider error:', error)
      });

      console.log(`Initialized ${this.config.contextProviders.length} context providers`);
    } catch (error) {
      console.error('Failed to initialize Context Manager:', error);
    }
  }

  /**
   * Initialize LLM Manager with configuration or legacy OpenAI key
   */
  private initializeLLMManager(legacyOpenAIKey?: string): void {
    try {
      let llmConfig: LLMManagerConfig;

      if (this.config.llm) {
        // Use new LLM configuration
        llmConfig = {
          providers: this.config.llm.providers,
          defaultProvider: this.config.llm.defaultProvider,
          fallbackProvider: this.config.llm.fallbackProvider,
          retryAttempts: this.config.llm.retryAttempts
        };
      } else if (legacyOpenAIKey) {
        // Legacy mode: create OpenAI provider from API key
        llmConfig = {
          providers: {
            'openai': {
              type: 'openai',
              apiKey: legacyOpenAIKey
            }
          },
          defaultProvider: 'openai'
        };
      } else {
        // No LLM configuration - will use mock responses
        console.warn('No LLM providers configured. Using mock responses.');
        return;
      }

      this.llmManager = new LLMManager(llmConfig);
    } catch (error) {
      console.error('Failed to initialize LLM Manager:', error);
    }
  }

  /**
   * Generate AI response using configured LLM providers
   */
  private async generateResponse(
    userMessage: string,
    context: string,
    targetModality: Modality
  ): Promise<string> {
    if (!this.llmManager) {
      // Fallback response if no LLM configured
      return this.generateMockResponse(userMessage, targetModality);
    }

    try {
      // Build prompt with context and modality instructions
      const systemPrompt = this.buildSystemPrompt(context, targetModality);
      
      const response = await this.llmManager.generateResponse({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        maxTokens: targetModality === 'voice' ? 150 : 500 // Shorter for voice
      });

      return response.content || 'I apologize, but I cannot process your request right now.';
    } catch (error) {
      console.error('LLM API error:', error);
      return this.generateMockResponse(userMessage, targetModality);
    }
  }

  /**
   * Build system prompt based on context and target modality
   */
  private buildSystemPrompt(context: string, targetModality: Modality): string {
    let prompt = this.config.systemPrompt;

    if (context) {
      prompt += `\n\nConversation Context:\n${context}`;
    }

    if (targetModality === 'voice') {
      prompt += '\n\nIMPORTANT: Respond in a natural, conversational tone suitable for voice interaction. Keep responses concise and engaging.';
    } else {
      prompt += '\n\nIMPORTANT: Provide detailed, well-structured text responses with clear formatting when helpful.';
    }

    return prompt;
  }

  /**
   * Combine conversation context with external knowledge sources
   */
  private combineContextSources(conversationContext: string, externalContext: string): string {
    let combinedContext = '';

    // Start with conversation context
    if (conversationContext) {
      combinedContext += `Conversation History:\n${conversationContext}`;
    }

    // Add external knowledge if available
    if (externalContext) {
      if (combinedContext) {
        combinedContext += '\n\n';
      }
      combinedContext += `Relevant Knowledge:\n${externalContext}`;
    }

    return combinedContext;
  }

  /**
   * Generate mock response when OpenAI is not available
   */
  private generateMockResponse(userMessage: string, targetModality: Modality): string {
    const baseResponse = "I understand you're asking about: " + userMessage;
    
    if (targetModality === 'voice') {
      return baseResponse + ". Let me help you with that.";
    } else {
      return baseResponse + "\n\nHere's how I can assist you:\n1. Provide detailed information\n2. Answer follow-up questions\n3. Help with related topics";
    }
  }

  /**
   * Get session information
   */
  public async getSession(sessionId: string): Promise<SessionState | null> {
    return this.sessionManager.getSession(sessionId);
  }

  /**
   * Get conversation summary
   */
  public async getConversationSummary(sessionId: string): Promise<string> {
    return this.sessionManager.getConversationSummary(sessionId);
  }

  /**
   * Destroy a session
   */
  public async destroySession(sessionId: string): Promise<boolean> {
    const success = await this.sessionManager.destroySession(sessionId);
    if (success) {
      this.emitEvent('session_ended', sessionId, {});
    }
    return success;
  }

  /**
   * Event system for monitoring agent behavior
   */
  public on(eventType: AgentEventType, callback: Function): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(callback);
  }

  public off(eventType: AgentEventType, callback: Function): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emitEvent(eventType: AgentEventType, sessionId: string, data: Record<string, any>): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const event: AgentEvent = {
        type: eventType,
        sessionId,
        timestamp: new Date(),
        data
      };

      listeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error(`Error in event listener for ${eventType}:`, error);
        }
      });
    }
  }

  private initializeEventListeners(): void {
    // Initialize all event types
    const eventTypes: AgentEventType[] = [
      'session_started', 'session_ended', 'message_received', 'message_sent',
      'modality_switched', 'context_bridged', 'error_occurred', 'performance_metric'
    ];

    eventTypes.forEach(type => {
      this.eventListeners.set(type, []);
    });
  }

  /**
   * Get agent configuration
   */
  public getConfig(): AgentConfig {
    return { ...this.config };
  }

  /**
   * Update agent configuration
   */
  public updateConfig(newConfig: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get agent capabilities
   */
  public getCapabilities() {
    const capabilities = {
      ...this.modalityRouter.getCapabilities(),
      contextBridging: true,
      sessionManagement: true,
      eventSystem: true,
      llmProviders: this.llmManager?.getAvailableProviders() || [],
      llmProviderStatus: this.llmManager?.getProviderStatus() || []
    };

    return capabilities;
  }

  /**
   * LLM Provider Management Methods
   */
  
  /**
   * Add a new LLM provider at runtime
   */
  public addLLMProvider(
    name: string, 
    config: LLMProviderConfig
  ): void {
    if (!this.llmManager) {
      // Initialize LLM manager if it doesn't exist
      this.llmManager = new LLMManager({
        providers: {},
        defaultProvider: name
      });
    }
    
    this.llmManager.addProvider(name, config);
  }

  /**
   * Get status of all LLM providers
   */
  public getLLMProviderStatus() {
    return this.llmManager?.getProviderStatus() || [];
  }

  /**
   * Test a specific LLM provider
   */
  public async testLLMProvider(name: string) {
    return this.llmManager?.testProvider(name) || { 
      success: false, 
      responseTime: 0, 
      error: 'No LLM manager configured' 
    };
  }

  /**
   * Set the default LLM provider
   */
  public setDefaultLLMProvider(name: string): void {
    this.llmManager?.setDefaultProvider(name);
  }

  /**
   * Get available LLM providers
   */
  public getAvailableLLMProviders(): string[] {
    return this.llmManager?.getAvailableProviders() || [];
  }

  /**
   * Cleanup resources
   */
  public async shutdown(): Promise<void> {
    await this.sessionManager.shutdown();
    this.contextBridge.clearCache();
    this.eventListeners.clear();
  }
} 