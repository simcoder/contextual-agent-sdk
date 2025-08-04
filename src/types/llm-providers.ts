// LLM Provider Types for Multi-LLM Support

export type LLMProviderType = 'openai' | 'anthropic' | 'google' | 'azure' | 'ollama' | 'custom';

export interface LLMConfig {
  providers: Record<string, LLMProviderConfig>;
  defaultProvider?: string;
  fallbackProvider?: string;
  retryAttempts?: number;
}

export interface LLMProviderConfig {
  type: LLMProviderType;
  apiKey?: string;
  model?: string;
  baseURL?: string;
  options?: {
    maxTokens?: number;
    headers?: Record<string, string>;
    requestTransform?: (options: LLMGenerateOptions) => any;
    responseTransform?: (response: any) => LLMResponse;
    [key: string]: any;
  };
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMGenerateOptions {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  [key: string]: any;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMProvider {
  type: LLMProviderType;
  getMaxTokens(): number;
  generateResponse(options: LLMGenerateOptions): Promise<LLMResponse>;
  isAvailable?(): boolean;
  test?(): Promise<void>;
} 