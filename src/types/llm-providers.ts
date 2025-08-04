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
  finishReason?: string;
}

export interface LLMProvider {
  type: LLMProviderType;
  getMaxTokens(): number;
  generateResponse(options: LLMGenerateOptions): Promise<LLMResponse>;
  isAvailable?(): boolean;
  test?(): Promise<void>;
}

// Alias for backward compatibility
export type LLMGenerationOptions = LLMGenerateOptions;

// Base class interface for LLM providers
export interface BaseLLMProvider extends LLMProvider {
  config: LLMProviderConfig;
  name: string;
  initialize?(): Promise<void>;
  cleanup?(): Promise<void>;
}

// Provider-specific configuration types
export interface OpenAIConfig extends LLMProviderConfig {
  type: 'openai';
  defaultOptions?: {
    maxTokens?: number;
    temperature?: number;
    presencePenalty?: number;
    frequencyPenalty?: number;
    stop?: string[];
  };
}

export interface AnthropicConfig extends LLMProviderConfig {
  type: 'anthropic';
  defaultOptions?: {
    maxTokens?: number;
    temperature?: number;
  };
}

export interface OllamaConfig extends LLMProviderConfig {
  type: 'ollama';
  defaultOptions?: {
    maxTokens?: number;
    temperature?: number;
    stop?: string[];
  };
} 