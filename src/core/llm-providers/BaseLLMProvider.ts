/**
 * Enhanced Base LLM Provider
 * 
 * Provides default implementations for tool calling and conversation management
 * that can be extended by specific provider implementations.
 */

import { 
  LLMProvider,
  LLMProviderType,
  LLMGenerateOptions,
  LLMResponse,
  LLMToolOptions,
  LLMToolResponse,
  LLMConversation,
  LLMStreamChunk,
  ConversationMessage
} from '../../types/llm-providers';
import { Tool } from '../../types';
import { ConversationManager } from '../conversation/ConversationManager';
import { ToolConverter } from '../tools/ToolConverter';
import { v4 as uuidv4 } from 'uuid';

export abstract class BaseLLMProvider implements LLMProvider {
  public abstract readonly type: LLMProviderType;
  protected conversationManager: ConversationManager;

  constructor() {
    this.conversationManager = new ConversationManager();
  }

  // Abstract methods that must be implemented by subclasses
  abstract getMaxTokens(): number;
  abstract generateResponse(options: LLMGenerateOptions): Promise<LLMResponse>;

  // Default implementations for tool calling (can be overridden)
  supportsTools(): boolean {
    return false; // Override in subclasses that support tools
  }

  supportsStreaming(): boolean {
    return false; // Override in subclasses that support streaming
  }

  createConversation(systemPrompt?: string): LLMConversation {
    return this.conversationManager.createConversation(systemPrompt);
  }

  /**
   * Default tool calling implementation
   * Override in subclasses for provider-specific tool calling
   */
  async generateWithTools(options: LLMToolOptions): Promise<LLMToolResponse> {
    if (!this.supportsTools()) {
      throw new Error(`${this.type} provider does not support tool calling`);
    }

    // Convert conversation to messages if provided
    let messages = options.messages;
    if (options.conversation) {
      messages = this.conversationManager.getConversationHistory(options.conversation.id);
    }

    // For providers that don't have native tool support,
    // fall back to regular generation with tool descriptions in system prompt
    const toolDescriptions = options.tools?.map(tool => 
      `Tool: ${tool.function.name} - ${tool.function.description}`
    ).join('\n') || '';

    const enhancedMessages = [...messages];
    if (toolDescriptions) {
      // Add tool descriptions to system message
      const systemMessage = enhancedMessages.find(m => m.role === 'system');
      if (systemMessage) {
        systemMessage.content += `\n\nAvailable tools:\n${toolDescriptions}`;
      } else {
        enhancedMessages.unshift({
          role: 'system',
          content: `Available tools:\n${toolDescriptions}`
        });
      }
    }

    const response = await this.generateResponse({
      ...options,
      messages: enhancedMessages
    });

    return {
      ...response,
      toolCalls: [], // No tool calls in basic implementation
      stopReason: 'stop',
      conversation: options.conversation
    };
  }

  /**
   * Default streaming implementation
   */
  async *streamResponse(options: LLMGenerateOptions): AsyncIterable<LLMStreamChunk> {
    if (!this.supportsStreaming()) {
      throw new Error(`${this.type} provider does not support streaming`);
    }

    // Default implementation: generate full response and yield as single chunk
    const response = await this.generateResponse(options);
    
    yield {
      type: 'content',
      content: response.content
    };

    yield {
      type: 'done',
      done: true
    };
  }

  /**
   * Default streaming with tools implementation
   */
  async *streamWithTools(options: LLMToolOptions): AsyncIterable<LLMStreamChunk> {
    if (!this.supportsStreaming() || !this.supportsTools()) {
      throw new Error(`${this.type} provider does not support streaming with tools`);
    }

    // Default implementation: generate with tools and stream the result
    const response = await this.generateWithTools(options);
    
    if (response.toolCalls && response.toolCalls.length > 0) {
      for (const toolCall of response.toolCalls) {
        yield {
          type: 'tool_call',
          toolCall
        };
      }
    }

    if (response.content) {
      yield {
        type: 'content',
        content: response.content
      };
    }

    yield {
      type: 'done',
      done: true
    };
  }

  /**
   * Handle tool execution loop
   * This is a generic implementation that can be used by any provider
   */
  async handleToolLoop(conversation: LLMConversation, tools: Tool[]): Promise<LLMToolResponse> {
    if (!this.supportsTools()) {
      throw new Error(`${this.type} provider does not support tool calling`);
    }

    const maxIterations = 10; // Prevent infinite loops
    let iteration = 0;
    
    while (iteration < maxIterations) {
      iteration++;

      // Generate response with tools
      const response = await this.generateWithTools({
        conversation,
        tools: ToolConverter.toOpenAIFunctions(tools),
        messages: this.conversationManager.getConversationHistory(conversation.id)
      });

      // If no tool calls, we're done
      if (!response.toolCalls || response.toolCalls.length === 0) {
        return response;
      }

      // Execute tool calls
      const toolResults = await ToolConverter.executeToolCalls(
        response.toolCalls,
        tools,
        ToolConverter.createToolContext(
          conversation.metadata?.agentId || 'unknown',
          conversation.id,
          conversation.metadata?.userId
        )
      );

      // Add tool calls and results to conversation
      this.conversationManager.addToolCalls(conversation.id, response.toolCalls);
      this.conversationManager.addToolResults(
        conversation.id,
        response.toolCalls.map((call, index) => ({
          callId: call.id,
          result: toolResults[index]
        }))
      );

      // If any tool failed critically, return error
      const criticalFailure = toolResults.find(result => 
        !result.success && result.metadata?.critical
      );
      if (criticalFailure) {
        return {
          ...response,
          content: `Tool execution failed: ${criticalFailure.error}`,
          stopReason: 'stop'
        };
      }
    }

    throw new Error(`Tool execution loop exceeded maximum iterations (${maxIterations})`);
  }

  /**
   * Helper method to format messages for provider-specific APIs
   */
  protected formatMessagesForProvider(messages: ConversationMessage[]): any[] {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }

  /**
   * Helper method to extract tool calls from provider response
   */
  protected extractToolCallsFromResponse(response: any): any[] {
    // Override in subclasses based on provider response format
    return [];
  }

  /**
   * Optional methods with default implementations
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.test?.();
      return true;
    } catch {
      return false;
    }
  }

  async test(): Promise<void> {
    await this.generateResponse({
      messages: [{ role: 'user', content: 'Test' }],
      maxTokens: 10
    });
  }
}