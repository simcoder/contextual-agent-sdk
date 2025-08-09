import { LLMGenerationOptions, LLMResponse, OllamaConfig } from '../../types/llm-providers';
import { BaseLLMProvider } from './BaseLLMProvider';

export class OllamaProvider extends BaseLLMProvider {
  public readonly type = 'ollama' as const;
  public readonly name = 'Ollama';
  public config: OllamaConfig;

  constructor(config: OllamaConfig) {
    super();
    this.config = config;
  }

  // Override tool support
  supportsTools(): boolean {
    return false; // Ollama doesn't support tools yet
  }

  supportsStreaming(): boolean {
    return false; // Will be true once we implement streaming
  }

  async generateResponse(options: LLMGenerationOptions): Promise<LLMResponse> {
    const host = (this.config as any).host || 'http://localhost:11434';
    
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
        }
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

  getMaxTokens(): number {
    // Ollama models vary, but most support at least 2048 tokens
    const model = this.config.model || 'llama2';
    if (model.includes('llama2:70b')) return 4096;
    if (model.includes('llama2:13b')) return 4096;
    if (model.includes('codellama:34b')) return 8192;
    if (model.includes('codellama:13b')) return 4096;
    if (model.includes('mistral')) return 8192;
    if (model.includes('mixtral')) return 32768;
    return 2048;
  }

  async isAvailable(): Promise<boolean> {
    // Ollama doesn't require API keys, just needs to be running
    return true;
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