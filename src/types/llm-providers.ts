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
  role: 'system' | 'user' | 'assistant' | 'tool';
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

// Enhanced types for tool calling support
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface ToolMessage extends LLMMessage {
  role: 'tool';
  content: string;
  tool_call_id: string;
}

export interface ConversationMessage extends LLMMessage {
  id?: string;
  timestamp?: Date;
  metadata?: Record<string, any>;
}

export interface LLMToolOptions extends LLMGenerateOptions {
  tools?: ToolDefinition[];
  toolChoice?: 'auto' | 'none' | { type: 'function', function: { name: string } };
  conversation?: LLMConversation;
}

export interface LLMToolResponse extends LLMResponse {
  toolCalls?: ToolCall[];
  stopReason: 'stop' | 'tool_calls' | 'length' | 'content_filter';
  conversation?: LLMConversation;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

export interface LLMConversation {
  id: string;
  messages: ConversationMessage[];
  systemPrompt?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface LLMStreamChunk {
  type: 'content' | 'tool_call' | 'error' | 'done';
  content?: string;
  toolCall?: Partial<ToolCall>;
  error?: string;
  done?: boolean;
}

export interface LLMProvider {
  type: LLMProviderType;
  getMaxTokens(): number;
  generateResponse(options: LLMGenerateOptions): Promise<LLMResponse>;
  
  // Enhanced tool calling capabilities
  generateWithTools?(options: LLMToolOptions): Promise<LLMToolResponse>;
  streamResponse?(options: LLMGenerateOptions): AsyncIterable<LLMStreamChunk>;
  streamWithTools?(options: LLMToolOptions): AsyncIterable<LLMStreamChunk>;
  
  // Tool and conversation support
  supportsTools(): boolean;
  supportsStreaming(): boolean;
  createConversation(systemPrompt?: string): LLMConversation;
  
  // Tool execution loop (handles multiple tool calls)
  handleToolLoop?(conversation: LLMConversation, tools: any[]): Promise<LLMToolResponse>;
  
  isAvailable?(): Promise<boolean>;
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