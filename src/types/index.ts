// Core Types for Contextual Agent SDK
import { StorageFactoryConfig } from '../storage/StorageFactory';
import { ContextProvider } from './context';

export type MessageRole = 'user' | 'assistant' | 'system';
export type Modality = 'voice' | 'text';
export type AgentMode = 'conversation' | 'task' | 'hybrid';

// Message and Conversation Types
export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  modality: Modality;
  timestamp: Date;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  voice?: VoiceMetadata;
  context?: ContextMetadata;
  performance?: PerformanceMetadata;
}

export interface VoiceMetadata {
  audioUrl?: string;
  duration?: number;
  language?: string;
  confidence?: number;
  emotions?: EmotionData[];
}

export interface EmotionData {
  emotion: string;
  confidence: number;
}

export interface ContextMetadata {
  previousModality?: Modality;
  modalitySwitch?: boolean;
  contextBridgeUsed?: boolean;
  relevantHistory?: string[];
}

export interface PerformanceMetadata {
  processingTime: number;
  apiCalls: ApiCallData[];
  tokenUsage?: TokenUsage;
}

export interface ApiCallData {
  service: string;
  endpoint: string;
  duration: number;
  status: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// Session Management Types
export interface SessionState {
  sessionId: string;
  userId?: string;
  startTime: Date;
  lastActivity: Date;
  currentModality: Modality;
  totalMessages: number;
  context: ConversationContext;
  metadata: SessionMetadata;
}

export interface ConversationContext {
  topic?: string;
  entities: ExtractedEntity[];
  intent?: string;
  mood?: string;
  conversationFlow: FlowState[];
  memoryBank: MemoryItem[];
}

export interface ExtractedEntity {
  name: string;
  type: string;
  value: string;
  confidence: number;
  source: 'voice' | 'text';
}

export interface FlowState {
  step: string;
  modality: Modality;
  timestamp: Date;
  data?: Record<string, any>;
}

export interface MemoryItem {
  id: string;
  content: string;
  importance: number;
  timestamp: Date;
  tags: string[];
  modality: Modality;
}

export interface SessionMetadata {
  modalitySwitches: number;
  averageResponseTime: number;
  maxAge?: number;  // Maximum age in milliseconds before session expiration
  userSatisfaction?: number;
  conversationQuality?: number;
}

// Agent Configuration Types
export interface AgentConfig {
  name: string;
  mode: AgentMode;
  systemPrompt: string;
  personality?: PersonalityTraits;
  capabilities: AgentCapabilities;
  contextSettings: ContextSettings;
  voiceSettings?: VoiceSettings;
  llm?: LLMConfig;  // LLM provider configuration
  storage?: StorageFactoryConfig;  // Session storage configuration
  contextProviders?: ContextProvider[];  // External knowledge and context sources
}

// LLM Configuration for the agent
export interface LLMConfig {
  providers: {
    [key: string]: {
      type: 'openai' | 'anthropic' | 'google' | 'azure' | 'ollama' | 'custom';
      config: any; // Will be typed based on provider
    };
  };
  defaultProvider?: string;
  fallbackProvider?: string;
  retryAttempts?: number;
}

export interface PersonalityTraits {
  tone: 'professional' | 'casual' | 'friendly' | 'formal' | 'custom';
  verbosity: 'concise' | 'normal' | 'detailed';
  empathy: number; // 0-1
  humor: number; // 0-1
  customInstructions?: string;
}

export interface AgentCapabilities {
  voiceEnabled: boolean;
  textEnabled: boolean;
  contextBridging: boolean;
  memoryRetention: boolean;
  emotionRecognition: boolean;
  taskExecution: boolean;
  knowledgeBase?: string[];
}

export interface ContextSettings {
  maxHistoryLength: number;
  contextWindowSize: number;
  relevanceThreshold: number;
  memoryRetentionDays: number;
  modalitySwitchSensitivity: number; // 0-1
}

export interface VoiceSettings {
  provider: 'openai' | 'elevenlabs' | 'azure' | 'google';
  voiceId?: string;
  speed?: number;
  pitch?: number;
  stability?: number;
  language: string;
  autoDetectLanguage?: boolean;
}

// API Response Types
export interface AgentResponse {
  success: boolean;
  data?: ResponseData;
  error?: ErrorInfo;
  metadata: ResponseMetadata;
}

export interface ResponseData {
  message: Message;
  sessionState: SessionState;
  suggestedActions?: SuggestedAction[];
}

export interface SuggestedAction {
  id: string;
  type: 'modality_switch' | 'clarification' | 'task' | 'custom';
  description: string;
  confidence: number;
}

export interface ErrorInfo {
  code: string;
  message: string;
  details?: Record<string, any>;
  recoverable: boolean;
}

export interface ResponseMetadata {
  responseTime: number;
  tokensUsed: TokenUsage;
  modalityUsed: Modality;
  contextBridgeTriggered: boolean;
  processingSteps: ProcessingStep[];
}

export interface ProcessingStep {
  step: string;
  duration: number;
  success: boolean;
  data?: Record<string, any>;
}

// Event Types for SDK
export interface AgentEvent {
  type: AgentEventType;
  sessionId: string;
  timestamp: Date;
  data: Record<string, any>;
}

export type AgentEventType = 
  | 'session_started'
  | 'session_ended'
  | 'message_received'
  | 'message_sent'
  | 'modality_switched'
  | 'context_bridged'
  | 'external_context_retrieved'
  | 'error_occurred'
  | 'performance_metric';

// External API Integration Types
export interface ExternalProvider {
  name: string;
  type: 'llm' | 'voice' | 'storage' | 'analytics';
  config: Record<string, any>;
  rateLimits?: RateLimit;
}

export interface RateLimit {
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
}

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>; 