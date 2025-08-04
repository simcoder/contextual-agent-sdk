import { BaseLLMProvider, LLMGenerationOptions, LLMResponse, OpenAIConfig } from '../../types/llm-providers';
import OpenAI from 'openai';

export class OpenAIProvider implements BaseLLMProvider {
  public readonly type = 'openai' as const;
  public readonly name = 'OpenAI';
  public config: OpenAIConfig;
  private client?: OpenAI;

  constructor(config: OpenAIConfig) {
    this.config = config;
    
    if (config.apiKey) {
      this.client = new OpenAI({
        apiKey: config.apiKey,
        organization: (config as any).organization,
        baseURL: config.baseURL
      });
    }
  }

  async generateResponse(options: LLMGenerationOptions): Promise<LLMResponse> {
    if (!this.client) {
      throw new Error('OpenAI provider not configured. Please provide an API key.');
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: options.model || this.config.model || 'gpt-4',
        messages: options.messages.map(msg => ({
          role: msg.role,
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

  getMaxTokens(): number {
    // Return max tokens based on model or default
    const model = this.config.model || 'gpt-4';
    if (model.includes('gpt-4-turbo')) return 128000;
    if (model.includes('gpt-4')) return 8192;
    if (model.includes('gpt-3.5-turbo-16k')) return 16384;
    if (model.includes('gpt-3.5-turbo')) return 4096;
    return 4096;
  }

  isAvailable(): boolean {
    return !!this.client && !!this.config.apiKey;
  }

  isConfigured(): boolean {
    return !!this.client;
  }

  getSupportedModels(): string[] {
    return [
      'gpt-4',
      'gpt-4-turbo',
      'gpt-4-turbo-preview',
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-16k'
    ];
  }
} 