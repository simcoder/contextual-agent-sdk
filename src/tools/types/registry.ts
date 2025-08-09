/**
 * Tool registry interfaces
 * 
 * Defines interfaces for managing and discovering tool providers.
 */

import type { Tool, ToolInstance, ToolUsageRecord } from './tools';
import type { ToolProvider, ToolExecutionContext, ProviderCapabilityCheck } from './providers';
import type { SubscriptionContext, ToolAccessValidation } from './subscriptions';

export interface ToolRegistry {
  /**
   * Register a tool provider
   * @param provider Tool provider to register
   */
  registerProvider(provider: ToolProvider): void;

  /**
   * Unregister a tool provider
   * @param providerId Provider ID to unregister
   */
  unregisterProvider(providerId: string): void;

  /**
   * Get a specific provider by ID
   * @param providerId Provider identifier
   * @returns Tool provider or undefined if not found
   */
  getProvider(providerId: string): ToolProvider | undefined;

  /**
   * Get all registered providers
   * @param subscriptionContext Optional subscription context for filtering
   * @returns Array of available providers
   */
  getProviders(subscriptionContext?: SubscriptionContext): ToolProvider[];

  /**
   * Get all available tools across all providers
   * @param subscriptionContext Optional subscription context for filtering
   * @returns Array of available tools
   */
  getAvailableTools(subscriptionContext?: SubscriptionContext): Tool[];

  /**
   * Get tools by category
   * @param category Tool category
   * @param subscriptionContext Optional subscription context for filtering
   * @returns Array of tools in the category
   */
  getToolsByCategory(category: string, subscriptionContext?: SubscriptionContext): Tool[];

  /**
   * Find a tool by ID across all providers
   * @param toolId Tool identifier
   * @returns Tool definition or undefined if not found
   */
  findTool(toolId: string): Tool | undefined;

  /**
   * Validate tool access for a subscription
   * @param toolId Tool identifier
   * @param subscriptionContext Subscription context
   * @returns Access validation result
   */
  validateToolAccess(toolId: string, subscriptionContext: SubscriptionContext): ToolAccessValidation;

  /**
   * Check provider capabilities
   * @param providerId Provider identifier
   * @param subscriptionContext Subscription context
   * @returns Array of capability checks
   */
  checkProviderCapabilities(providerId: string, subscriptionContext: SubscriptionContext): ProviderCapabilityCheck[];

  /**
   * Search tools by name or description
   * @param query Search query
   * @param subscriptionContext Optional subscription context for filtering
   * @returns Array of matching tools
   */
  searchTools(query: string, subscriptionContext?: SubscriptionContext): Tool[];

  /**
   * Get tool usage statistics
   * @param toolId Tool identifier
   * @param timeRange Time range for statistics
   * @returns Usage statistics
   */
  getToolUsageStats(toolId: string, timeRange?: ToolUsageTimeRange): Promise<ToolUsageStats>;
}

export interface ToolUsageTimeRange {
  /** Start date for statistics */
  start: Date;
  /** End date for statistics */
  end: Date;
}

export interface ToolUsageStats {
  /** Tool ID */
  toolId: string;
  /** Time range for statistics */
  timeRange: ToolUsageTimeRange;
  /** Total number of executions */
  totalExecutions: number;
  /** Successful executions */
  successfulExecutions: number;
  /** Failed executions */
  failedExecutions: number;
  /** Success rate percentage */
  successRate: number;
  /** Average execution time in milliseconds */
  averageExecutionTime: number;
  /** Total cost incurred */
  totalCost?: number;
  /** Usage by day */
  dailyUsage: Array<{
    date: string;
    executions: number;
    successRate: number;
    averageExecutionTime: number;
  }>;
  /** Most common errors */
  commonErrors: Array<{
    error: string;
    count: number;
    percentage: number;
  }>;
}

export interface ToolDiscoveryOptions {
  /** Filter by category */
  category?: string;
  /** Filter by subscription tier */
  minimumTier?: string;
  /** Filter by premium status */
  premiumOnly?: boolean;
  /** Include enterprise tools */
  includeEnterprise?: boolean;
  /** Search query */
  searchQuery?: string;
  /** Limit number of results */
  limit?: number;
  /** Sort order */
  sortBy?: 'name' | 'category' | 'popularity' | 'tier';
}

export interface ToolRegistryStats {
  /** Total number of providers */
  totalProviders: number;
  /** Total number of tools */
  totalTools: number;
  /** Tools by category */
  toolsByCategory: Record<string, number>;
  /** Tools by subscription tier */
  toolsByTier: Record<string, number>;
  /** Most popular tools */
  popularTools: Array<{
    toolId: string;
    name: string;
    usageCount: number;
  }>;
}

export interface ToolRegistryHealth {
  /** Overall registry health */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Provider health statuses */
  providerHealth: Record<string, 'healthy' | 'degraded' | 'unhealthy'>;
  /** Registry metrics */
  metrics: {
    /** Average tool response time */
    averageResponseTime: number;
    /** Error rate across all tools */
    errorRate: number;
    /** Number of active tool instances */
    activeInstances: number;
  };
  /** Last health check */
  lastHealthCheck: Date;
}