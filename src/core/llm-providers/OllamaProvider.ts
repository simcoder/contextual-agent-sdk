import { BaseLLMProvider, LLMGenerationOptions, LLMResponse, OllamaConfig } from '../../types/llm-providers';

export class OllamaProvider extends BaseLLMProvider {
  private ollamaConfig: OllamaConfig;

  constructor(config: OllamaConfig) {
    super(config, 'Ollama');
    this.ollamaConfig = config;
  }

  async generateResponse(options: LLMGenerationOptions): Promise<LLMResponse> {
    const host = this.ollamaConfig.host || 'http://localhost:11434';
    
    try {
      // Convert messages to a single prompt for Ollama
      const prompt = this.buildPrompt(options.messages);
      
      const response = await fetch(`${host}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: options.model || this.config.model || 'llama2',
          prompt: prompt,
          options: {
            temperature: options.temperature ?? this.config.defaultOptions?.temperature ?? 0.7,
            num_predict: options.maxTokens ?? this.config.defaultOptions?.maxTokens ?? 500,
            stop: options.stop ?? this.config.defaultOptions?.stop
          },
          stream: false
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Ollama API error: ${response.status} ${errorData}`);
      }

      const data = await response.json() as {
        response?: string;
        done?: boolean;
        model?: string;
        total_duration?: number;
        load_duration?: number;
        prompt_eval_count?: number;
        eval_count?: number;
      };
      
      if (!data.response) {
        throw new Error('No response content from Ollama');
      }

      return {
        content: data.response,
        finishReason: data.done ? 'stop' : undefined,
        usage: {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
        },
        model: data.model
      };

    } catch (error: any) {
      throw new Error(`Ollama API error: ${error.message}`);
    }
  }

  private buildPrompt(messages: Array<{ role: string; content: string }>): string {
    let prompt = '';
    
    for (const message of messages) {
      if (message.role === 'system') {
        prompt += `System: ${message.content}\n\n`;
      } else if (message.role === 'user') {
        prompt += `Human: ${message.content}\n\n`;
      } else if (message.role === 'assistant') {
        prompt += `Assistant: ${message.content}\n\n`;
      }
    }
    
    prompt += 'Assistant: ';
    return prompt;
  }

  isConfigured(): boolean {
    // Ollama doesn't require API keys, just needs to be running
    return true;
  }

  getSupportedModels(): string[] {
    return [
      'llama2',
      'llama2:13b',
      'llama2:70b',
      'codellama',
      'codellama:13b',
      'codellama:34b',
      'mistral',
      'mixtral',
      'neural-chat',
      'starling-lm',
      'phi',
      'orca-mini'
    ];
  }
} 