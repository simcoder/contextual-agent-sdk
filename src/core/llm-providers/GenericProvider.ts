import { LLMProvider, LLMProviderConfig, LLMGenerateOptions, LLMResponse } from '../../types/llm-providers';

export class GenericProvider implements LLMProvider {
  public type: 'custom' = 'custom';
  private config: LLMProviderConfig;

  constructor(config: LLMProviderConfig) {
    this.config = config;
  }

  getMaxTokens(): number {
    return this.config.options?.maxTokens || 4096;
  }

  async generateResponse(options: LLMGenerateOptions): Promise<LLMResponse> {
    if (!this.config.baseURL) {
      throw new Error('Generic provider not configured. Please provide a baseURL.');
    }

    try {
      // Transform request if custom transform is provided
      const requestBody = this.config.options?.requestTransform 
        ? this.config.options.requestTransform(options)
        : this.defaultRequestTransform(options);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...this.config.options?.headers
      };

      if (this.config.apiKey) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      }

      const response = await fetch(this.config.baseURL, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Generic API error: ${response.status} ${errorData}`);
      }

      const data = await response.json();
      
      // Transform response if custom transform is provided
      return this.config.options?.responseTransform 
        ? this.config.options.responseTransform(data)
        : this.defaultResponseTransform(data);

    } catch (error: any) {
      throw new Error(`Generic API error: ${error.message}`);
    }
  }

  isAvailable(): boolean {
    return !!this.config.baseURL;
  }

  async test(): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Generic provider not configured');
    }

    // Simple test with minimal request
    await this.generateResponse({
      messages: [{ role: 'user', content: 'Hello' }],
      maxTokens: 10
    });
  }

  private defaultRequestTransform(options: LLMGenerateOptions): any {
    return {
      model: this.config.model || 'default',
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 500
    };
  }

  private defaultResponseTransform(data: any): LLMResponse {
    // Try to extract content from common response formats
    const content = data.choices?.[0]?.message?.content || 
                   data.content || 
                   data.response || 
                   data.text ||
                   '';

    if (!content) {
      throw new Error('No response content from Generic API');
    }

    return {
      content,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens || data.usage.input_tokens || 0,
        completionTokens: data.usage.completion_tokens || data.usage.output_tokens || 0,
        totalTokens: data.usage.total_tokens || 
                    (data.usage.prompt_tokens || 0) + (data.usage.completion_tokens || 0) ||
                    (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0) || 0
      } : undefined
    };
  }
} 