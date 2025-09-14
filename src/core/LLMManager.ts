import { 
  LLMProvider, 
  LLMProviderType,
  LLMProviderConfig,
  LLMGenerateOptions,
  LLMResponse,
  LLMToolOptions,
  LLMToolResponse,
  ToolDefinition
} from '../types/llm-providers';
import { Tool } from '../types';

export interface LLMManagerConfig {
  providers: Record<string, LLMProviderConfig>;
  defaultProvider?: string;
  fallbackProvider?: string;
  retryAttempts?: number;
}

export class LLMManager {
  private providers: Map<string, LLMProvider> = new Map();
  private defaultProvider?: string;
  private fallbackProvider?: string;
  private retryAttempts: number;

  constructor(config: LLMManagerConfig) {
    this.defaultProvider = config.defaultProvider;
    this.fallbackProvider = config.fallbackProvider;
    this.retryAttempts = config.retryAttempts || 3;

    // Initialize providers
    Object.entries(config.providers).forEach(([name, providerConfig]) => {
      const provider = this.createProvider(name, providerConfig);
      if (provider) {
        this.providers.set(name, provider);
      }
    });
  }

  private createProvider(name: string, config: LLMProviderConfig): LLMProvider | null {
    try {
      // Robust dynamic import with explicit mapping for providers whose names aren't simple PascalCase
      const typeKey = String(config.type).toLowerCase();
      const providerMap: Record<string, { module: string; exportName: string }> = {
        openai: { module: 'OpenAIProvider', exportName: 'OpenAIProvider' },
        anthropic: { module: 'AnthropicProvider', exportName: 'AnthropicProvider' },
        ollama: { module: 'OllamaProvider', exportName: 'OllamaProvider' },
        generic: { module: 'GenericProvider', exportName: 'GenericProvider' }
      };

      const mapped = providerMap[typeKey];
      if (!mapped) {
        // Fallback to legacy PascalCase naming (first-letter upper only)
        const legacy = config.type.charAt(0).toUpperCase() + config.type.slice(1);
        const legacyModule = require(`./llm-providers/${legacy}Provider`);
        const LegacyClass = legacyModule[`${legacy}Provider`] || legacyModule.default;
        const providerConfig = (config as any).config || config;
        return new LegacyClass(providerConfig);
      }

      const providerModule = require(`./llm-providers/${mapped.module}`);
      const ProviderClass = providerModule[mapped.exportName] || providerModule.default;
      
      // Extract the nested config if it exists, otherwise use the config directly
      const providerConfig = (config as any).config || config;
      return new ProviderClass(providerConfig);
    } catch (error) {
      console.error(`Failed to create provider ${name}:`, error);
      return null;
    }
  }

  public async generateResponse(options: LLMGenerateOptions): Promise<LLMResponse> {
    const provider = this.getCurrentProvider();
    if (!provider) {
      throw new Error('No LLM provider available');
    }

    try {
      return await provider.generateResponse(options);
    } catch (error) {
      if (this.fallbackProvider && this.fallbackProvider !== this.defaultProvider) {
        const fallback = this.providers.get(this.fallbackProvider);
        if (fallback) {
          return await fallback.generateResponse(options);
        }
      }
      throw error;
    }
  }

  /**
   * 🔧 TOOL-AWARE GENERATION
   * Use this method when tools are available for the agent
   */
  public async generateWithTools(options: LLMGenerateOptions, tools: Tool[]): Promise<LLMToolResponse> {
    const provider = this.getCurrentProvider();
    if (!provider) {
      throw new Error('No LLM provider available');
    }

    // Check if provider supports tools
    if (!provider.supportsTools()) {
      console.log('⚠️  Provider does not support tools, falling back to basic generation');
      const response = await this.generateResponse(options);
      return {
        ...response,
        toolCalls: [],
        stopReason: 'stop' as const
      };
    }

    try {
      // Use tool-aware generation
      if (provider.generateWithTools) {
        // Convert Tool[] to ToolDefinition[] format
        const toolDefinitions: ToolDefinition[] = tools.map(tool => ({
          type: 'function',
          function: {
            name: tool.id,
            description: tool.description,
            parameters: {
              type: 'object',
              properties: this.inferToolParameters(tool),
              required: []
            }
          }
        }));

        return await provider.generateWithTools({
          ...options,
          tools: toolDefinitions
        });
      } else {
        // Fallback to basic generation
        const response = await provider.generateResponse(options);
        return {
          ...response,
          toolCalls: [],
          stopReason: 'stop' as const
        };
      }
    } catch (error) {
      if (this.fallbackProvider && this.fallbackProvider !== this.defaultProvider) {
        const fallback = this.providers.get(this.fallbackProvider);
        if (fallback && fallback.supportsTools() && fallback.generateWithTools) {
          const toolDefinitions: ToolDefinition[] = tools.map(tool => ({
            type: 'function',
            function: {
              name: tool.id,
              description: tool.description,
              parameters: {
                type: 'object',
                properties: this.inferToolParameters(tool),
                required: []
              }
            }
          }));

          return await fallback.generateWithTools({
            ...options,
            tools: toolDefinitions
          });
        }
      }
      throw error;
    }
  }

  /**
   * Check if current provider supports tools
   */
  public supportsTools(): boolean {
    const provider = this.getCurrentProvider();
    return provider ? provider.supportsTools() : false;
  }

  /**
   * Infer parameter schema from tool
   */
  private inferToolParameters(tool: Tool): Record<string, any> {
    // Basic schema inference based on tool ID/description
    if (tool.id.includes('sms') || tool.id.includes('twilio')) {
      return {
        to: {
          type: 'string',
          description: 'Phone number to send SMS to (E.164 format, e.g., +1234567890)'
        },
        message: {
          type: 'string',
          description: 'The message content to send'
        }
      };
    }

    if (tool.id.includes('email')) {
      return {
        to: {
          type: 'string',
          description: 'Email address to send to'
        },
        subject: {
          type: 'string',
          description: 'Email subject line'
        },
        body: {
          type: 'string',
          description: 'Email body content'
        }
      };
    }

    // Generic parameters for unknown tools
    return {
      input: {
        type: 'string',
        description: 'Input parameter for the tool'
      }
    };
  }

  public getCurrentProvider(): LLMProvider | undefined {
    if (!this.defaultProvider) return undefined;
    return this.providers.get(this.defaultProvider);
  }

  public addProvider(name: string, config: LLMProviderConfig): void {
    const provider = this.createProvider(name, config);
    if (provider) {
      this.providers.set(name, provider);
      if (!this.defaultProvider) {
        this.defaultProvider = name;
      }
    }
  }

  public setDefaultProvider(name: string): void {
    if (this.providers.has(name)) {
      this.defaultProvider = name;
    }
  }

  public async getProviderStatus(): Promise<Array<{
    name: string;
    available: boolean;
    isDefault: boolean;
    isFallback: boolean;
  }>> {
    const entries = Array.from(this.providers.entries());
    const statusPromises = entries.map(async ([name, provider]) => ({
      name,
      available: provider.isAvailable ? await provider.isAvailable() : true,
      isDefault: name === this.defaultProvider,
      isFallback: name === this.fallbackProvider
    }));
    
    return Promise.all(statusPromises);
  }

  public async testProvider(name: string): Promise<{
    success: boolean;
    responseTime: number;
    error?: string;
  }> {
    const provider = this.providers.get(name);
    if (!provider) {
      return {
        success: false,
        responseTime: 0,
        error: 'Provider not found'
      };
    }

    const start = Date.now();
    try {
      await provider.test?.();
      return {
        success: true,
        responseTime: Date.now() - start
      };
    } catch (error) {
      return {
        success: false,
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  public getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }
} 