import { BaseLLMProvider, LLMGenerationOptions, LLMResponse, OpenAIConfig } from '../../types/llm-providers';
import OpenAI from 'openai';

export class OpenAIProvider extends BaseLLMProvider {
  private client?: OpenAI;

  constructor(config: OpenAIConfig) {
    super(config, 'OpenAI');
    
    if (config.apiKey) {
      this.client = new OpenAI({
        apiKey: config.apiKey,
        organization: config.organization,
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
        } : undefined,
        model: completion.model
      };

    } catch (error: any) {
      throw new Error(`OpenAI API error: ${error.message}`);
    }
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