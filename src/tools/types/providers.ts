/**
 * Tool provider interfaces
 * 
 * Defines the interface that all tool providers must implement.
 * Providers are responsible for executing specific tools.
 */

import type { 
  Tool, 
  ToolCategory, 
  ToolCapability, 
  ToolCredentials, 
  ToolParams, 
  ToolResult, 
  ToolConfigValidation,
  ToolConfigSchema,
  SubscriptionTier 
} from './tools';
import type { SubscriptionContext } from './subscriptions';

export interface ToolProvider {
  /** Unique provider identifier */
  readonly id: string;
  /** Human-readable provider name */
  readonly name: string;
  /** Provider description */
  readonly description: string;
  /** Provider category */
  readonly category: ToolCategory;
  /** Provider version */
  readonly version: string;
  /** Provider capabilities */
  readonly capabilities: ToolCapability[];
  /** Minimum subscription tier required */
  readonly minimumTier: SubscriptionTier;
  /** Whether this is a premium provider */
  readonly isPremium: boolean;
  /** Whether this is an enterprise-only provider */
  readonly isEnterprise: boolean;

  /**
   * Get all tools provided by this provider
   * @param subscriptionContext Optional subscription context for filtering
   * @returns Array of available tools
   */
  getAvailableTools(subscriptionContext?: SubscriptionContext): Tool[];

  /**
   * Get a specific tool by ID
   * @param toolId Tool identifier
   * @returns Tool definition or undefined if not found
   */
  getTool(toolId: string): Tool | undefined;

  /**
   * Authenticate with the provider using credentials
   * @param credentials Provider credentials
   * @returns Promise resolving to authentication success
   */
  authenticate(credentials: ToolCredentials): Promise<boolean>;

  /**
   * Execute a tool with given parameters
   * @param toolId Tool identifier
   * @param params Tool parameters
   * @param context Optional execution context
   * @returns Promise resolving to tool execution result
   */
  execute(toolId: string, params: ToolParams, context?: ToolExecutionContext): Promise<ToolResult>;

  /**
   * Validate tool configuration
   * @param toolId Tool identifier  
   * @param config Configuration to validate
   * @returns Validation result
   */
  validateConfig(toolId: string, config: any): ToolConfigValidation;

  /**
   * Get configuration schema for a tool
   * @param toolId Tool identifier
   * @returns Configuration schema
   */
  getConfigSchema(toolId: string): ToolConfigSchema | undefined;

  /**
   * Test provider connectivity
   * @param credentials Optional credentials for testing
   * @returns Promise resolving to connectivity test result
   */
  testConnection(credentials?: ToolCredentials): Promise<ProviderTestResult>;

  /**
   * Get provider health status
   * @returns Provider health information
   */
  getHealthStatus(): ProviderHealthStatus;

  /**
   * Cleanup provider resources
   * @returns Promise for cleanup completion
   */
  cleanup?(): Promise<void>;
}

export interface ToolExecutionContext {
  /** Agent ID executing the tool */
  agentId: string;
  /** Organization ID */
  organizationId: string;
  /** User ID if available */
  userId?: string;
  /** Session ID */
  sessionId?: string;
  /** Subscription context */
  subscription: SubscriptionContext;
  /** Additional context data */
  metadata?: Record<string, any>;
}

export interface ProviderTestResult {
  /** Whether test was successful */
  success: boolean;
  /** Test response time in milliseconds */
  responseTime: number;
  /** Error message if test failed */
  error?: string;
  /** Additional test metadata */
  metadata?: Record<string, any>;
}

export interface ProviderHealthStatus {
  /** Overall health status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Last health check timestamp */
  lastCheck: Date;
  /** Health check details */
  details: {
    /** API connectivity status */
    apiConnectivity: boolean;
    /** Authentication status */
    authentication: boolean;
    /** Rate limit status */
    rateLimitStatus: 'ok' | 'warning' | 'critical';
    /** Error rate percentage */
    errorRate: number;
    /** Average response time */
    averageResponseTime: number;
  };
  /** Any health issues */
  issues?: string[];
}

export interface ProviderCapabilityCheck {
  /** Provider ID */
  providerId: string;
  /** Capability ID */
  capabilityId: string;
  /** Whether capability is available */
  available: boolean;
  /** Reason if not available */
  reason?: string;
  /** Requirements for availability */
  requirements?: string[];
}