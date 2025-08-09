/**
 * Core tool interfaces and types
 * 
 * Defines the fundamental structure for tool integration in the SDK.
 * All interfaces are designed to be optional and non-breaking.
 */

import type { SubscriptionTier, ToolUsageQuota } from './subscriptions';

// Re-export for convenience
export type { SubscriptionTier, ToolUsageQuota } from './subscriptions';

export type ToolCategory = 'communication' | 'data' | 'productivity' | 'ai_services' | 'enterprise' | 'custom';

export interface ToolParameter {
  /** Parameter name */
  name: string;
  /** Parameter type */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  /** Whether parameter is required */
  required: boolean;
  /** Parameter description */
  description?: string;
  /** Default value if not provided */
  default?: any;
  /** Validation schema (JSON Schema) */
  schema?: Record<string, any>;
}

export interface ToolReturnType {
  /** Return type description */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'void';
  /** Return value description */
  description?: string;
  /** Return value schema (JSON Schema) */
  schema?: Record<string, any>;
}

export interface ToolRateLimit {
  /** Requests per minute */
  requestsPerMinute?: number;
  /** Requests per hour */
  requestsPerHour?: number;
  /** Requests per day */
  requestsPerDay?: number;
  /** Burst limit */
  burstLimit?: number;
}

export interface ToolCredentials {
  /** Credential type (API key, OAuth, etc.) */
  type: 'api_key' | 'oauth2' | 'basic_auth' | 'custom';
  /** Encrypted credential data */
  data: Record<string, any>;
  /** Credential expiration */
  expiresAt?: Date;
  /** Whether credentials are valid */
  isValid?: boolean;
}

export interface ToolConfigSchema {
  /** JSON Schema for tool configuration */
  properties: Record<string, any>;
  /** Required configuration fields */
  required: string[];
  /** Schema type */
  type: 'object';
  /** Additional properties allowed */
  additionalProperties?: boolean;
}

export interface ToolConfigValidation {
  /** Whether configuration is valid */
  isValid: boolean;
  /** Validation errors if any */
  errors: string[];
  /** Validated and normalized configuration */
  normalizedConfig?: Record<string, any>;
}

export interface ToolParams {
  /** Tool-specific parameters */
  [key: string]: any;
}

export interface ToolResultMetadata {
  /** Execution time in milliseconds */
  executionTime?: number;
  /** Tool provider version */
  providerVersion?: string;
  /** API endpoint used */
  endpoint?: string;
  /** Rate limit information */
  rateLimit?: {
    remaining: number;
    resetTime: Date;
  };
  /** Cost information */
  cost?: {
    amount: number;
    currency: string;
    unit: string;
  };
}

export interface ToolResult {
  /** Whether execution was successful */
  success: boolean;
  /** Result data */
  data?: any;
  /** Error message if failed */
  error?: string;
  /** Error code if failed */
  errorCode?: string;
  /** Execution metadata */
  metadata?: ToolResultMetadata;
}

export interface Tool {
  /** Unique tool identifier */
  id: string;
  /** Human-readable tool name */
  name: string;
  /** Tool description */
  description: string;
  /** Tool category */
  category: ToolCategory;
  /** Tool version */
  version: string;
  /** Input parameters */
  parameters: ToolParameter[];
  /** Return type definition */
  returnType: ToolReturnType;
  /** Whether authentication is required */
  requiresAuth: boolean;
  /** Rate limiting configuration */
  rateLimits?: ToolRateLimit;
  /** Minimum subscription tier required */
  minimumTier: SubscriptionTier;
  /** Whether this is a premium tool */
  isPremium: boolean;
  /** Usage quota by subscription tier */
  usageQuota?: ToolUsageQuota;
  /** Configuration schema */
  configSchema?: ToolConfigSchema;
  /** Tool tags for filtering */
  tags?: string[];
  /** Tool documentation URL */
  documentationUrl?: string;
}

export interface ToolCapability {
  /** Capability identifier */
  id: string;
  /** Capability name */
  name: string;
  /** Capability description */
  description: string;
  /** Whether capability is available */
  available: boolean;
}

export interface ToolInstance {
  /** Tool definition */
  tool: Tool;
  /** Tool configuration */
  configuration: Record<string, any>;
  /** Tool credentials */
  credentials?: ToolCredentials;
  /** Whether instance is active */
  isActive: boolean;
  /** Last used timestamp */
  lastUsed?: Date;
  /** Usage statistics */
  usageStats?: {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    averageExecutionTime: number;
  };
}

export interface ToolUsageRecord {
  /** Tool ID */
  toolId: string;
  /** Agent ID */
  agentId: string;
  /** Organization ID */
  organizationId: string;
  /** Usage timestamp */
  timestamp: Date;
  /** Whether execution was successful */
  success: boolean;
  /** Execution time in milliseconds */
  executionTime: number;
  /** Cost incurred */
  cost?: number;
  /** Error if execution failed */
  error?: string;
}