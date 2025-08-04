import { ContextProvider, ContextProviderConfig, ContextResult, ContextManagerConfig } from '../types/context';

export class ContextManager {
  private providers: Map<string, ContextProvider> = new Map();
  private config: Required<ContextManagerConfig>;

  constructor(config: ContextManagerConfig) {
    this.config = {
      maxTokens: 4096,
      defaultFormatter: (ctx: ContextResult) => typeof ctx.content === 'string' ? ctx.content : JSON.stringify(ctx.content),
      errorHandler: (error: Error) => console.error('Context provider error:', error),
      ...config
    };

    // Initialize providers
    this.config.providers.forEach(provider => {
      if (provider.enabled !== false) {
        this.providers.set(provider.id, provider);
      }
    });
  }

  /**
   * Add a context provider
   */
  public addProvider(provider: ContextProvider): void {
    this.providers.set(provider.id, provider);
  }

  /**
   * Remove a context provider
   */
  public removeProvider(providerId: string): void {
    this.providers.delete(providerId);
  }

  /**
   * Enable/disable a provider
   */
  public setProviderEnabled(providerId: string, enabled: boolean): void {
    const provider = this.providers.get(providerId);
    if (provider) {
      provider.enabled = enabled;
    }
  }

  /**
   * Get context from all enabled providers
   */
  public async getContext(params: Record<string, any> = {}): Promise<ContextResult[]> {
    const results: ContextResult[] = [];

    // Get context from each provider in parallel
    const contextPromises = Array.from(this.providers.values())
      .filter(provider => provider.enabled !== false)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))
      .map(async (provider) => {
        try {
          const context = await provider.getContext(params);
          if (context) {
            results.push({
              ...context,
              metadata: {
                source: provider.id,
                timestamp: new Date(),
                tags: [],
                ...context.metadata,
                provider: provider.id
              }
            });
          }
        } catch (error) {
          this.config.errorHandler(error as Error, provider);
        }
      });

    await Promise.all(contextPromises);
    return results;
  }

  /**
   * Format context results into a string suitable for the LLM
   */
  public formatContext(results: ContextResult[]): string {
    let formattedContext = '';

    for (const result of results) {
      const provider = this.providers.get(result.metadata?.provider || '');
      
      // Use provider-specific formatter if available
      if (provider?.formatContext) {
        formattedContext += provider.formatContext(result) + '\n\n';
        continue;
      }

      // Use default formatter
      formattedContext += this.config.defaultFormatter(result) + '\n\n';
    }

    return this.truncateIfNeeded(formattedContext);
  }

  private truncateIfNeeded(text: string): string {
    const estimatedTokens = Math.ceil(text.length / 4); // Rough estimate
    if (estimatedTokens <= this.config.maxTokens) return text;

    const ratio = this.config.maxTokens / estimatedTokens;
    const targetLength = Math.floor(text.length * ratio) - 100; // Buffer
    return text.substring(0, targetLength) + '...';
  }

  /**
   * Get all registered providers
   */
  public getProviders(): ContextProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get provider by ID
   */
  public getProvider(id: string): ContextProvider | undefined {
    return this.providers.get(id);
  }
} 