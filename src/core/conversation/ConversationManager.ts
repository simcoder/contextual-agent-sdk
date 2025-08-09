/**
 * Conversation Manager
 * 
 * Handles conversation state, message history, and tool call tracking
 * for multi-turn LLM interactions with tool calling support.
 */

import { 
  LLMConversation, 
  ConversationMessage, 
  ToolCall
} from '../../types/llm-providers';
import { ToolResult } from '../../types';
import { v4 as uuidv4 } from 'uuid';

export class ConversationManager {
  private conversations = new Map<string, LLMConversation>();

  /**
   * Create a new conversation
   */
  createConversation(systemPrompt?: string): LLMConversation {
    const conversation: LLMConversation = {
      id: uuidv4(),
      messages: [],
      systemPrompt,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {}
    };

    // Add system message if provided
    if (systemPrompt) {
      conversation.messages.push({
        id: uuidv4(),
        role: 'system',
        content: systemPrompt,
        timestamp: new Date()
      });
    }

    this.conversations.set(conversation.id, conversation);
    return conversation;
  }

  /**
   * Get an existing conversation
   */
  getConversation(conversationId: string): LLMConversation | undefined {
    return this.conversations.get(conversationId);
  }

  /**
   * Add a message to the conversation
   */
  addMessage(conversationId: string, message: Omit<ConversationMessage, 'id' | 'timestamp'>): ConversationMessage {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const fullMessage: ConversationMessage = {
      ...message,
      id: uuidv4(),
      timestamp: new Date()
    };

    conversation.messages.push(fullMessage);
    conversation.updatedAt = new Date();

    return fullMessage;
  }

  /**
   * Add tool calls to the conversation
   */
  addToolCalls(conversationId: string, toolCalls: ToolCall[]): void {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    // Add an assistant message with tool calls
    const toolCallMessage: ConversationMessage = {
      id: uuidv4(),
      role: 'assistant',
      content: '', // Tool calls don't have content
      timestamp: new Date()
    };

    // Store tool calls in metadata
    toolCallMessage.metadata = { toolCalls };
    
    conversation.messages.push(toolCallMessage);
    conversation.updatedAt = new Date();
  }

  /**
   * Add tool results to the conversation
   */
  addToolResults(conversationId: string, toolResults: Array<{ callId: string; result: ToolResult }>): void {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    // Add tool result messages
    for (const { callId, result } of toolResults) {
      const toolMessage: ConversationMessage = {
        id: uuidv4(),
        role: 'user', // Tool results are typically added as user messages
        content: JSON.stringify(result),
        timestamp: new Date(),
        metadata: { 
          isToolResult: true, 
          toolCallId: callId,
          toolResult: result
        }
      };

      conversation.messages.push(toolMessage);
    }

    conversation.updatedAt = new Date();
  }

  /**
   * Get conversation history in format suitable for LLM
   */
  getConversationHistory(conversationId: string, includeSystem: boolean = true): ConversationMessage[] {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    if (includeSystem) {
      return [...conversation.messages];
    }

    return conversation.messages.filter(msg => msg.role !== 'system');
  }

  /**
   * Clear conversation history
   */
  clearConversation(conversationId: string): void {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    // Keep system message if it exists
    const systemMessage = conversation.messages.find(msg => msg.role === 'system');
    conversation.messages = systemMessage ? [systemMessage] : [];
    conversation.updatedAt = new Date();
  }

  /**
   * Delete a conversation
   */
  deleteConversation(conversationId: string): void {
    this.conversations.delete(conversationId);
  }

  /**
   * Get all conversation IDs
   */
  getAllConversationIds(): string[] {
    return Array.from(this.conversations.keys());
  }

  /**
   * Get conversation statistics
   */
  getConversationStats(conversationId: string): {
    messageCount: number;
    userMessages: number;
    assistantMessages: number;
    toolCalls: number;
    duration: number; // in milliseconds
  } {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const stats = {
      messageCount: conversation.messages.length,
      userMessages: 0,
      assistantMessages: 0,
      toolCalls: 0,
      duration: Date.now() - conversation.createdAt.getTime()
    };

    for (const message of conversation.messages) {
      if (message.role === 'user') {
        stats.userMessages++;
      } else if (message.role === 'assistant') {
        stats.assistantMessages++;
        if (message.metadata?.toolCalls) {
          stats.toolCalls += (message.metadata.toolCalls as ToolCall[]).length;
        }
      }
    }

    return stats;
  }
}

// Singleton instance for global conversation management
export const conversationManager = new ConversationManager();