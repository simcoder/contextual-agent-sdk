import { ContextProvider, ContextResult, BaseConfig } from '../types/context';

export interface DatabaseConfig extends BaseConfig {
  connection: {
    url?: string;
    type?: 'postgres' | 'mysql' | 'mongodb' | 'custom';
    customQuery?: (query: string) => Promise<any>;
  };
  queries?: {
    [key: string]: string;  // Named queries
  };
  transform?: (data: any) => string;  // Optional data transformer
}

export class DatabaseContextProvider implements ContextProvider {
  public id: string;
  public name: string;
  public source: 'database' = 'database';
  public priority: number;
  public enabled: boolean;

  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
    this.id = config.id || 'database';
    this.name = config.name || 'Database Context Provider';
    this.priority = config.priority || 70;
    this.enabled = config.enabled ?? true;
  }

  async getContext(params: { query?: string; queryName?: string }): Promise<ContextResult | null> {
    try {
      // Use custom query function if provided
      if (this.config.connection.customQuery) {
        const data = await this.config.connection.customQuery(
          params.query || this.config.queries?.[params.queryName || ''] || ''
        );
        return {
          content: data,
          metadata: {
            source: this.source,
            timestamp: new Date(),
            tags: ['database'],
            queryName: params.queryName
          }
        };
      }

      // Default to null if no query method available
      return null;
    } catch (error) {
      console.error('Database context error:', error);
      return null;
    }
  }

  formatContext(result: ContextResult): string {
    if (this.config.transform) {
      return this.config.transform(result.content);
    }
    return typeof result.content === 'string' 
      ? result.content 
      : JSON.stringify(result.content, null, 2);
  }
} 