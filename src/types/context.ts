export type ContextSource = 'database' | 'api' | 'file' | 'memory' | 'custom';
export type ContextPriority = 'high' | 'medium' | 'low';
export type ContextScope = 'global' | 'session' | 'user' | 'message';

export interface BaseConfig {
  id: string;
  name: string;
  enabled?: boolean;
  priority?: number;  // 0-100, higher = more important
}

export interface ContextResult {
  content: string | Record<string, any> | Array<any>;
  metadata?: {
    source: string;
    timestamp: Date;
    tags?: string[];
    [key: string]: any;
  };
}

export interface ContextProvider {
  id: string;
  name: string;
  source: 'database' | 'knowledge_base' | 'memory' | 'custom';
  priority: number;
  enabled: boolean;
  getContext(params: Record<string, any>): Promise<ContextResult | null>;
  formatContext?(result: ContextResult): string;
}

export interface ContextFetchParams {
  sessionId?: string;
  userId?: string;
  messageId?: string;
  query?: string;
  filters?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface ContextData {
  content: string | Record<string, any>;
  metadata?: {
    timestamp: Date;
    source: string;
    version?: string;
    ttl?: number;
    tags?: string[];
    error?: string;  // For error reporting
  };
}

export interface ContextRule {
  id: string;
  condition: ContextCondition;
  action: ContextAction;
  priority: number;
}

export interface ContextCondition {
  type: 'message' | 'user' | 'session' | 'custom';
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex' | 'function';
  value: any;
}

export interface ContextAction {
  type: 'inject' | 'fetch' | 'transform' | 'merge' | 'replace' | 'custom';
  params: Record<string, any>;
}

export interface ContextTemplate {
  id: string;
  name: string;
  template: string;
  variables: string[];
  format?: 'text' | 'json' | 'markdown';
}

export interface ContextConfig {
  providers: ContextProvider[];
  rules?: ContextRule[];
  templates?: ContextTemplate[];
  options?: {
    cacheEnabled?: boolean;
    cacheTTL?: number;
    refreshInterval?: number;
    maxContextLength?: number;
    mergeBehavior?: 'append' | 'prepend' | 'replace';
    deduplicate?: boolean;
  };
}

// Context Manager Configuration
export interface ContextManagerConfig {
  providers: ContextProvider[];
  maxTokens?: number;
  defaultFormatter?: (ctx: ContextResult) => string;
  errorHandler?: (error: Error, provider?: ContextProvider) => void;
}

// Provider configuration interface
export interface ContextProviderConfig extends BaseConfig {
  source: ContextSource;
  getContext(params: Record<string, any>): Promise<ContextResult | null>;
  formatContext?(result: ContextResult): string;
} 