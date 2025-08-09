import { 
  LLMGenerationOptions, 
  LLMResponse, 
  OpenAIConfig,
  LLMToolOptions,
  LLMToolResponse,
  LLMConversation,
  LLMStreamChunk
} from '../../types/llm-providers';
import { BaseLLMProvider } from './BaseLLMProvider';
import { ToolConverter } from '../tools/ToolConverter';
import { Tool } from '../../types';
import OpenAI from 'openai';

/**
 * 🚀 OPENAI PROVIDER (Official SDK)
 * 
 * Uses the official OpenAI SDK with function calling,
 * conversation management, and streaming support.
 */
export class OpenAIProvider extends BaseLLMProvider {
  public readonly type = 'openai' as const;
  public readonly name = 'OpenAI';
  public config: OpenAIConfig;
  private client?: OpenAI;

  constructor(config: OpenAIConfig) {
    super();
    this.config = config;
    
    if (config.apiKey) {
      this.client = new OpenAI({
        apiKey: config.apiKey,
        organization: (config as any).organization,
        baseURL: config.baseURL
      });
      console.log('🎯 OpenAI Provider initialized with official SDK');
    }
  }

  // 🔧 FULL TOOL SUPPORT WITH OPENAI SDK!
  supportsTools(): boolean {
    return true;
  }

  supportsStreaming(): boolean {
    return true; // OpenAI SDK supports streaming
  }

  async generateResponse(options: LLMGenerationOptions): Promise<LLMResponse> {
    if (!this.client) {
      throw new Error('OpenAI provider not configured. Please provide an API key.');
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: options.model || this.config.model || 'gpt-4',
        messages: options.messages
          .filter(msg => msg.role !== 'tool') // Filter out tool messages for basic generation
          .map(msg => ({
            role: msg.role as 'system' | 'user' | 'assistant',
            content: msg.content
          })),
        temperature: options.temperature ?? this.config.defaultOptions?.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? this.config.defaultOptions?.maxTokens ?? 500,
        presence_penalty: options.presencePenalty ?? this.config.defaultOptions?.presencePenalty,
        frequency_penalty: options.frequencyPenalty ?? this.config.defaultOptions?.frequencyPenalty,
        stop: options.stop ?? this.config.defaultOptions?.stop
      });

      const choice = completion.choices[0];
      if (!choice?.message?.content) {
        throw new Error('No response content from OpenAI');
      }

      return {
        content: choice.message.content,
        finishReason: choice.finish_reason as any,
        usage: completion.usage ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens
        } : undefined
      };

    } catch (error: any) {
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }

  /**
   * 🔧 FUNCTION CALLING WITH OPENAI SDK
   */
  async generateWithTools(options: LLMToolOptions): Promise<LLMToolResponse> {
    if (!this.client) {
      throw new Error('OpenAI provider not configured. Please provide an API key.');
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
      console.log('🔧 OpenAI Function Calling Request:', {
        model: this.config.model || 'gpt-4',
        messages: options.messages.length,
        functions: options.tools.map(t => ({ name: t.function.name, description: t.function.description }))
      });

      const completion = await this.client.chat.completions.create({
        model: options.model || this.config.model || 'gpt-4',
        messages: options.messages
          .filter(msg => msg.role !== 'tool') // Handle tool messages separately
          .map(msg => ({
            role: msg.role as 'system' | 'user' | 'assistant',
            content: msg.content
          })),
        functions: options.tools.map(tool => ({
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters
        })),
        function_call: options.toolChoice === 'none' ? 'none' : 
                      options.toolChoice && typeof options.toolChoice === 'object' ? 
                      { name: options.toolChoice.function.name } : 'auto',
        temperature: options.temperature ?? this.config.defaultOptions?.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? this.config.defaultOptions?.maxTokens ?? 1000
      });

      console.log('🔧 OpenAI Function Calling Response:', {
        content_length: completion.choices[0]?.message?.content?.length || 0,
        finish_reason: completion.choices[0]?.finish_reason,
        function_call: !!completion.choices[0]?.message?.function_call,
        usage: completion.usage
      });

      const choice = completion.choices[0];
      if (!choice) {
        throw new Error('No response from OpenAI');
      }

      // Extract content
      const content = choice.message.content || '';

      // Extract function calls (OpenAI uses legacy function_call format)
      const toolCalls = choice.message.function_call ? [{
        id: `call_${Date.now()}`, // Generate ID since OpenAI legacy format doesn't provide one
        type: 'function' as const,
        function: {
          name: choice.message.function_call.name,
          arguments: choice.message.function_call.arguments || '{}'
        }
      }] : [];

      const stopReason = choice.finish_reason === 'function_call' ? 'tool_calls' : 
                        choice.finish_reason === 'length' ? 'length' :
                        'stop';

      console.log('🎯 Extracted Function Calls:', toolCalls.map(tc => ({ 
        id: tc.id, 
        name: tc.function.name, 
        args: tc.function.arguments 
      })));

      return {
        content,
        usage: completion.usage ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens
        } : undefined,
        finishReason: choice.finish_reason as any,
        toolCalls,
        stopReason,
        conversation: options.conversation
      };
    } catch (error: any) {
      console.error('❌ OpenAI Function Calling Error:', error);
      throw new Error(`Failed to generate response with functions: ${error.message}`);
    }
  }

  /**
   * 🔄 MULTI-TURN FUNCTION EXECUTION LOOP WITH OPENAI SDK
   */
  async handleToolLoop(conversation: LLMConversation, tools: Tool[]): Promise<LLMToolResponse> {
    const maxIterations = 10;
    let iteration = 0;
    
    console.log(`🔄 Starting OpenAI Function Loop with ${tools.length} tools`);
    
    while (iteration < maxIterations) {
      iteration++;
      
      console.log(`🔄 Function Loop Iteration ${iteration}/${maxIterations}`);

      // Get conversation history
      const messages = this.conversationManager.getConversationHistory(conversation.id);
      
      // Generate response with functions using OpenAI SDK
      const response = await this.generateWithTools({
        messages,
        tools: ToolConverter.toOpenAIFunctions(tools),
        conversation,
        maxTokens: this.config.defaultOptions?.maxTokens || 1000
      });

      // If no function calls, we're done
      if (!response.toolCalls || response.toolCalls.length === 0) {
        console.log('✅ Function loop complete - no more function calls');
        return response;
      }

      console.log(`🔧 Executing ${response.toolCalls.length} function call(s):`, 
        response.toolCalls.map(tc => tc.function.name));

      // Execute function calls
      const toolResults = await ToolConverter.executeToolCalls(
        response.toolCalls,
        tools,
        ToolConverter.createToolContext(
          conversation.metadata?.agentId || 'unknown',
          conversation.id,
          conversation.metadata?.userId
        )
      );

      // Add assistant message with function calls to conversation
      this.conversationManager.addMessage(conversation.id, {
        role: 'assistant',
        content: response.content || '',
        metadata: { toolCalls: response.toolCalls }
      });

      // Add function results as user messages (OpenAI format)
      for (let i = 0; i < response.toolCalls.length; i++) {
        const toolCall = response.toolCalls[i];
        const result = toolResults[i];
        
        const resultContent = result.success 
          ? (typeof result.data === 'string' ? result.data : JSON.stringify(result.data))
          : `Error: ${result.error}`;
        
        this.conversationManager.addMessage(conversation.id, {
          role: 'user',
          content: `Function ${toolCall.function.name} result: ${resultContent}`,
          metadata: { 
            isFunctionResult: true, 
            functionCallId: toolCall.id,
            functionResult: result
          }
        });

        console.log(`🎯 Function ${toolCall.function.name} result:`, {
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
        console.error('❌ Critical function failure:', criticalFailure);
        return {
          ...response,
          content: `Function execution failed: ${criticalFailure.error}`,
          stopReason: 'stop'
        };
      }
    }

    throw new Error(`Function execution loop exceeded maximum iterations (${maxIterations})`);
  }

  /**
   * 🌊 STREAMING SUPPORT
   */
  async *streamResponse(options: LLMGenerationOptions): AsyncIterable<LLMStreamChunk> {
    if (!this.client) {
      throw new Error('OpenAI provider not configured. Please provide an API key.');
    }

    try {
      const stream = await this.client.chat.completions.create({
        model: options.model || this.config.model || 'gpt-4',
        messages: options.messages
          .filter(msg => msg.role !== 'tool')
          .map(msg => ({
            role: msg.role as 'system' | 'user' | 'assistant',
            content: msg.content
          })),
        temperature: options.temperature ?? this.config.defaultOptions?.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? this.config.defaultOptions?.maxTokens ?? 1000,
        stream: true
      });

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (choice?.delta?.content) {
          yield {
            type: 'content',
            content: choice.delta.content
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

  getMaxTokens(): number {
    // Return max tokens based on model or default
    const model = this.config.model || 'gpt-4';
    if (model.includes('gpt-4o')) return 128000;
    if (model.includes('gpt-4-turbo')) return 128000;
    if (model.includes('gpt-4')) return 8192;
    if (model.includes('gpt-3.5-turbo-16k')) return 16384;
    if (model.includes('gpt-3.5-turbo')) return 4096;
    return 4096;
  }

  async isAvailable(): Promise<boolean> {
    return !!this.client && !!this.config.apiKey;
  }

  isConfigured(): boolean {
    return !!this.client;
  }

  getSupportedModels(): string[] {
    return [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4-turbo-preview',
      'gpt-4',
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-16k'
    ];
  }
} 