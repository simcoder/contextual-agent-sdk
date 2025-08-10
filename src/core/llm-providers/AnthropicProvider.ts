/**
 * 🚀 ANTHROPIC PROVIDER (Official SDK)
 * 
 * Uses the official @anthropic-ai/sdk with proper tool calling,
 * conversation management, and streaming support.
 */

import { 
  LLMGenerationOptions, 
  LLMResponse, 
  AnthropicConfig,
  LLMToolOptions,
  LLMToolResponse,
  LLMConversation,
  LLMStreamChunk
} from '../../types/llm-providers';
import { BaseLLMProvider } from './BaseLLMProvider';
import { ToolConverter } from '../tools/ToolConverter';
import { Tool } from '../../types';
import Anthropic from '@anthropic-ai/sdk';

export class AnthropicProvider extends BaseLLMProvider {
  public readonly type = 'anthropic' as const;
  public readonly name = 'Anthropic';
  public config: AnthropicConfig;
  private client?: Anthropic;

  constructor(config: AnthropicConfig) {
    super();
    this.config = config;
    
    if (config.apiKey) {
      this.client = new Anthropic({
        apiKey: config.apiKey,
        baseURL: config.baseURL
      });
      console.log('🎯 Anthropic Provider initialized with official SDK');
    }
  }

  // 🔧 FULL TOOL SUPPORT!
  supportsTools(): boolean {
    return true;
  }

  supportsStreaming(): boolean {
    return true;
  }

  getMaxTokens(): number {
    const model = this.config.model || 'claude-3-5-sonnet-20241022';
    if (model.includes('claude-3-5-sonnet')) return 200000;
    if (model.includes('claude-3-sonnet')) return 200000;
    if (model.includes('claude-3-haiku')) return 200000;
    if (model.includes('claude-2')) return 100000;
    if (model.includes('claude-instant')) return 100000;
    return 200000;
  }

  /**
   * 📝 BASIC TEXT GENERATION (using official SDK)
   */
  async generateResponse(options: LLMGenerationOptions): Promise<LLMResponse> {
    if (!this.client) {
      throw new Error('Anthropic SDK provider not configured. Please provide an API key.');
    }

    try {
      const systemMessage = options.messages.find(msg => msg.role === 'system');
      const userMessages = options.messages.filter(msg => msg.role !== 'system');

      console.log('📤 Anthropic SDK Request (Basic):', {
        model: this.config.model || 'claude-3-5-sonnet-20241022',
        messages: userMessages.length,
        system: !!systemMessage?.content,
        max_tokens: options.maxTokens || 1000
      });

      const response = await this.client.messages.create({
        model: this.config.model || 'claude-3-5-sonnet-20241022',
        max_tokens: options.maxTokens || this.config.defaultOptions?.maxTokens || 1000,
        temperature: options.temperature || this.config.defaultOptions?.temperature || 0.7,
        messages: userMessages.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        })),
        ...(systemMessage && { system: systemMessage.content })
      });

      console.log('📥 Anthropic SDK Response (Basic):', {
        content_length: response.content.length,
        stop_reason: response.stop_reason,
        usage: response.usage
      });

      const content = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map(block => block.text)
        .join('');

      return {
        content,
        usage: response.usage ? {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens
        } : undefined,
        finishReason: response.stop_reason || 'stop'
      };
    } catch (error: any) {
      console.error('❌ Anthropic SDK Error:', error);
      throw new Error(`Failed to generate response: ${error.message}`);
    }
  }

  /**
   * 🔧 TOOL CALLING WITH OFFICIAL ANTHROPIC SDK
   * Using the CORRECT official API from @anthropic-ai/sdk
   */
  async generateWithTools(options: LLMToolOptions): Promise<LLMToolResponse> {
    if (!this.client) {
      throw new Error('Anthropic SDK provider not configured. Please provide an API key.');
    }

    if (!options.tools || options.tools.length === 0) {
      const response = await this.generateResponse(options);
      return {
        ...response,
        toolCalls: [],
        stopReason: 'stop'
      };
    }

    try {
      // Convert OpenAI-style tools to Anthropic SDK format
      const anthropicTools = options.tools.map(tool => ({
        name: tool.function.name,
        description: tool.function.description,
        input_schema: tool.function.parameters
      }));

      const systemMessage = options.messages.find(msg => msg.role === 'system');
      const conversationMessages = options.messages.filter(msg => msg.role !== 'system');

      console.log('🔧 Anthropic SDK Tool Request (OFFICIAL API):', {
        model: this.config.model || 'claude-3-5-sonnet-20241022',
        messages: conversationMessages.length,
        tools: anthropicTools.map(t => ({ name: t.name, description: t.description })),
        system: !!systemMessage?.content
      });

      // Use OFFICIAL Anthropic SDK API with tools parameter
      const response = await this.client.messages.create({
        model: this.config.model || 'claude-3-5-sonnet-20241022',
        max_tokens: options.maxTokens || this.config.defaultOptions?.maxTokens || 1000,
        temperature: options.temperature || this.config.defaultOptions?.temperature || 0.7,
        messages: conversationMessages.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        })),
        tools: anthropicTools, // ✅ OFFICIAL TOOLS PARAMETER
        ...(systemMessage && { system: systemMessage.content })
      });

      console.log('🔧 Anthropic SDK Tool Response (OFFICIAL API):', {
        content_blocks: response.content.length,
        stop_reason: response.stop_reason,
        usage: response.usage,
        tool_use_blocks: response.content.filter(block => block.type === 'tool_use').length
      });

      // Extract text content from response
      const textContent = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map(block => block.text)
        .join('');

      // Extract tool_use blocks and convert to our standard format
      const toolCalls = response.content
        .filter((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use')
        .map(block => ({
          id: block.id,
          type: 'function' as const,
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input)
          }
        }));

      // Map Anthropic's stop_reason to our standard format
      const stopReason = response.stop_reason === 'tool_use' ? 'tool_calls' : 
                        response.stop_reason === 'max_tokens' ? 'length' :
                        'stop';

      console.log('🎯 Extracted Tool Calls (OFFICIAL SDK):', toolCalls.map(tc => ({ 
        id: tc.id, 
        name: tc.function.name, 
        args: tc.function.arguments 
      })));

      return {
        content: textContent,
        usage: response.usage ? {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens
        } : undefined,
        finishReason: response.stop_reason || 'stop',
        toolCalls,
        stopReason,
        conversation: options.conversation
      };
    } catch (error: any) {
      console.error('❌ Anthropic SDK Tool Error (OFFICIAL API):', error);
      throw new Error(`Failed to generate response with tools: ${error.message}`);
    }
  }

  /**
   * 🔄 MULTI-TURN TOOL EXECUTION LOOP WITH ANTHROPIC SDK
   */
  async handleToolLoop(conversation: LLMConversation, tools: Tool[]): Promise<LLMToolResponse> {
    const maxIterations = 10;
    let iteration = 0;
    
    console.log(`🔄 Starting Anthropic SDK Tool Loop with ${tools.length} tools`);
    
    while (iteration < maxIterations) {
      iteration++;
      
      console.log(`🔄 Tool Loop Iteration ${iteration}/${maxIterations}`);

      // Get conversation history
      const messages = this.conversationManager.getConversationHistory(conversation.id);
      
      // Generate response with tools using Anthropic SDK
      const response = await this.generateWithTools({
        messages,
        tools: ToolConverter.toOpenAIFunctions(tools),
        conversation,
        maxTokens: this.config.defaultOptions?.maxTokens || 1000
      });

      // If no tool calls, we're done
      if (!response.toolCalls || response.toolCalls.length === 0) {
        console.log('✅ Tool loop complete - no more tool calls');
        return response;
      }

      console.log(`🔧 Executing ${response.toolCalls.length} tool call(s):`, 
        response.toolCalls.map(tc => tc.function.name));

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

      // Add assistant message with tool calls to conversation
      this.conversationManager.addMessage(conversation.id, {
        role: 'assistant',
        content: response.content || '',
        metadata: { toolCalls: response.toolCalls }
      });

      // Add tool results as user messages (Anthropic format)
      for (let i = 0; i < response.toolCalls.length; i++) {
        const toolCall = response.toolCalls[i];
        const result = toolResults[i];
        
        const resultContent = result.success 
          ? (typeof result.data === 'string' ? result.data : JSON.stringify(result.data))
          : `Error: ${result.error}`;
        
        this.conversationManager.addMessage(conversation.id, {
          role: 'user',
          content: `<tool_result tool_call_id="${toolCall.id}">${resultContent}</tool_result>`,
          metadata: { 
            isToolResult: true, 
            toolCallId: toolCall.id,
            toolResult: result
          }
        });

        console.log(`🎯 Tool ${toolCall.function.name} result:`, {
          success: result.success,
          hasData: !!result.data,
          error: result.error
        });
      }

      // Check for critical failures
      const criticalFailure = toolResults.find(result => 
        !result.success && result.metadata?.critical
      );
      if (criticalFailure) {
        console.error('❌ Critical tool failure:', criticalFailure);
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
   * 🌊 STREAMING SUPPORT (basic implementation)
   */
  async *streamResponse(options: LLMGenerationOptions): AsyncIterable<LLMStreamChunk> {
    if (!this.client) {
      throw new Error('Anthropic SDK provider not configured. Please provide an API key.');
    }

    try {
      const systemMessage = options.messages.find(msg => msg.role === 'system');
      const userMessages = options.messages.filter(msg => msg.role !== 'system');

      const stream = await this.client.messages.create({
        model: this.config.model || 'claude-3-5-sonnet-20241022',
        max_tokens: options.maxTokens || this.config.defaultOptions?.maxTokens || 1000,
        temperature: options.temperature || this.config.defaultOptions?.temperature || 0.7,
        messages: userMessages.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        })),
        stream: true,
        ...(systemMessage && { system: systemMessage.content })
      });

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          yield {
            type: 'content',
            content: chunk.delta.text
          };
        }
      }

      yield {
        type: 'done',
        done: true
      };
    } catch (error: any) {
      yield {
        type: 'error',
        error: error.message
      };
    }
  }

  async isAvailable(): Promise<boolean> {
    return !!this.client && !!this.config.apiKey;
  }

  async test(): Promise<void> {
    if (!this.client) {
      throw new Error('Anthropic SDK provider not configured');
    }

    try {
      await this.client.messages.create({
        model: this.config.model || 'claude-3-5-sonnet-20241022',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }]
      });
    } catch (error: any) {
      throw new Error(`Anthropic SDK test failed: ${error.message}`);
    }
  }
}