import { 
  LLMProvider, 
  LLMProviderType,
  LLMProviderConfig,
  LLMGenerateOptions,
  LLMResponse
} from '../types/llm-providers';

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
      // Import provider dynamically based on type
      const provider = require(`./llm-providers/${config.type}Provider`).default;
      return new provider(config);
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

  public getProviderStatus(): Array<{
    name: string;
    available: boolean;
    isDefault: boolean;
    isFallback: boolean;
  }> {
    return Array.from(this.providers.entries()).map(([name, provider]) => ({
      name,
      available: provider.isAvailable?.() ?? true,
      isDefault: name === this.defaultProvider,
      isFallback: name === this.fallbackProvider
    }));
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