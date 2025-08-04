// Main SDK exports
export { ContextualAgent } from './ContextualAgent';

// Core classes
export { SessionStateManager } from './core/SessionStateManager';
export { ContextBridge } from './core/ContextBridge';
export { ModalityRouter } from './core/ModalityRouter';
export { LLMManager } from './core/LLMManager';
export { ContextManager } from './core/ContextManager';

// LLM Providers
export { OpenAIProvider } from './core/llm-providers/OpenAIProvider';
export { AnthropicProvider } from './core/llm-providers/AnthropicProvider';
export { OllamaProvider } from './core/llm-providers/OllamaProvider';
export { GenericProvider } from './core/llm-providers/GenericProvider';

// Context Providers
export { KnowledgeBaseProvider } from './providers/KnowledgeBaseProvider';
export { DatabaseContextProvider } from './providers/DatabaseContextProvider';

// Storage Providers
export { StorageFactory } from './storage/StorageFactory';
export { MemoryStorageProvider } from './storage/MemoryStorageProvider';
export { RedisStorageProvider } from './storage/RedisStorageProvider';
export { MongoStorageProvider } from './storage/MongoStorageProvider';

// Types and interfaces (selective exports to avoid conflicts)
export type {
  AgentConfig,
  AgentResponse,
  Message,
  Modality,
  SessionState,
  AgentEvent,
  AgentEventType
} from './types';

export type {
  ContextProvider,
  ContextResult,
  BaseConfig
} from './types/context';

export type {
  LLMProvider,
  LLMProviderConfig,
  LLMProviderType,
  LLMGenerateOptions,
  LLMResponse
} from './types/llm-providers';

export type {
  StorageProvider,
  StorageConfig,
  StorageStats
} from './types/storage';

// Speech Provider interfaces
export type { SpeechToTextProvider, TextToSpeechProvider, ModalityRouterConfig } from './core/ModalityRouter';

// Attribution utilities
export {
  getAttribution,
  getHTMLAttribution,
  getMarkdownAttribution,
  getTextAttribution,
  getJSONAttribution,
  logAttribution,
  validateAttribution
} from './utils/attribution';
export type { AttributionInfo } from './utils/attribution';

// Default export
export { ContextualAgent as default } from './ContextualAgent'; 