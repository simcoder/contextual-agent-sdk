import { BaseLLMProvider, LLMGenerationOptions, LLMResponse, AnthropicConfig } from '../../types/llm-providers';

export class AnthropicProvider implements BaseLLMProvider {
  public readonly type = 'anthropic' as const;
  public readonly name = 'Anthropic';
  public config: AnthropicConfig;

  constructor(config: AnthropicConfig) {
    this.config = config;
  }

  async generateResponse(options: LLMGenerationOptions): Promise<LLMResponse> {
    if (!this.config.apiKey) {
      throw new Error('Anthropic provider not configured. Please provide an API key.');
    }

    try {
      const systemMessage = options.messages.find(m => m.role === 'system');
      const userMessages = options.messages.filter(m => m.role !== 'system');
      
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: options.model || this.config.model || 'claude-3-sonnet-20240229',
          max_tokens: options.maxTokens ?? this.config.defaultOptions?.maxTokens ?? 500,
          temperature: options.temperature ?? this.config.defaultOptions?.temperature ?? 0.7,
          system: systemMessage?.content,
          messages: userMessages.map(msg => ({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content
          }))
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Anthropic API error: ${response.status} ${errorData}`);
      }

      const data = await response.json() as {
        content?: Array<{ text: string }>;
        stop_reason?: string;
        usage?: {
          input_tokens: number;
          output_tokens: number;
        };
        model?: string;
      };
      
      if (!data.content || !data.content[0]?.text) {
        throw new Error('No response content from Anthropic');
      }

      return {
        content: data.content[0].text,
        finishReason: data.stop_reason as any,
        usage: data.usage ? {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens
        } : undefined
      };

    } catch (error: any) {
      throw new Error(`Anthropic API error: ${error.message}`);
    }
  }

  getMaxTokens(): number {
    // Return max tokens based on model or default
    const model = this.config.model || 'claude-3-sonnet-20240229';
    if (model.includes('claude-3-opus')) return 200000;
    if (model.includes('claude-3-sonnet')) return 200000;
    if (model.includes('claude-3-haiku')) return 200000;
    if (model.includes('claude-2')) return 100000;
    if (model.includes('claude-instant')) return 100000;
    return 100000;
  }

  isAvailable(): boolean {
    return !!this.config.apiKey;
  }

  isConfigured(): boolean {
    return !!this.config.apiKey;
  }

  getSupportedModels(): string[] {
    return [
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
      'claude-2.1',
      'claude-2.0',
      'claude-instant-1.2'
    ];
  }
} 