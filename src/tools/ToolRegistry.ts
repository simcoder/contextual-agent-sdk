/**
 * Tool Registry implementation
 * 
 * Manages tool providers and provides discovery capabilities.
 * This is a completely new feature that doesn't affect existing functionality.
 */

import type {
  Tool,
  ToolInstance,
  ToolUsageRecord
} from './types/tools';

import type {
  ToolProvider,
  ProviderCapabilityCheck
} from './types/providers';

import type {
  SubscriptionContext,
  ToolAccessValidation
} from './types/subscriptions';

import type {
  ToolRegistry as IToolRegistry,
  ToolUsageTimeRange,
  ToolUsageStats,
  ToolDiscoveryOptions,
  ToolRegistryStats,
  ToolRegistryHealth
} from './types/registry';

/**
 * Default implementation of the ToolRegistry
 * 
 * Provides centralized management of tool providers and tools.
 */
export class ToolRegistry implements IToolRegistry {
  private providers: Map<string, ToolProvider> = new Map();
  private usageRecords: ToolUsageRecord[] = [];
  private initialized: boolean = false;

  constructor() {
    this.initialized = true;
    console.log('[ToolRegistry] Initialized tool registry');
    this.registerBuiltInProviders();
  }

  /**
   * Register built-in tool providers
   */
  private registerBuiltInProviders(): void {
    try {
      // Import and register Twilio provider
      import('./providers/TwilioToolProvider').then(({ TwilioToolProvider }) => {
        this.registerProvider(new TwilioToolProvider());
      }).catch(error => {
        console.warn('[ToolRegistry] Failed to load TwilioToolProvider:', error);
      });

      console.log('[ToolRegistry] Built-in providers registration initiated');
    } catch (error) {
      console.warn('[ToolRegistry] Failed to register built-in providers:', error);
    }
  }

  /**
   * Register a tool provider
   */
  public registerProvider(provider: ToolProvider): void {
    if (this.providers.has(provider.id)) {
      console.warn(`[ToolRegistry] Provider '${provider.id}' is already registered. Overwriting.`);
    }

    this.providers.set(provider.id, provider);
    console.log(`[ToolRegistry] Registered provider: ${provider.id} (${provider.name})`);
  }

  /**
   * Unregister a tool provider
   */
  public unregisterProvider(providerId: string): void {
    if (this.providers.has(providerId)) {
      const provider = this.providers.get(providerId)!;
      this.providers.delete(providerId);
      console.log(`[ToolRegistry] Unregistered provider: ${providerId} (${provider.name})`);
      
      // Cleanup provider if it supports cleanup
      provider.cleanup?.().catch(error => {
        console.warn(`[ToolRegistry] Failed to cleanup provider ${providerId}:`, error);
      });
    } else {
      console.warn(`[ToolRegistry] Attempted to unregister unknown provider: ${providerId}`);
    }
  }

  /**
   * Get a specific provider by ID
   */
  public getProvider(providerId: string): ToolProvider | undefined {
    return this.providers.get(providerId);
  }

  /**
   * Get all registered providers
   */
  public getProviders(subscriptionContext?: SubscriptionContext): ToolProvider[] {
    const allProviders = Array.from(this.providers.values());

    if (!subscriptionContext) {
      return allProviders;
    }

    // Filter providers based on subscription tier
    return allProviders.filter(provider => {
      return this.checkProviderAccess(provider, subscriptionContext);
    });
  }

  /**
   * Get all available tools across all providers
   */
  public getAvailableTools(subscriptionContext?: SubscriptionContext): Tool[] {
    const availableProviders = this.getProviders(subscriptionContext);
    const tools: Tool[] = [];

    for (const provider of availableProviders) {
      try {
        const providerTools = provider.getAvailableTools(subscriptionContext);
        tools.push(...providerTools);
      } catch (error) {
        console.warn(`[ToolRegistry] Failed to get tools from provider ${provider.id}:`, error);
      }
    }

    return tools;
  }

  /**
   * Get tools by category
   */
  public getToolsByCategory(category: string, subscriptionContext?: SubscriptionContext): Tool[] {
    const allTools = this.getAvailableTools(subscriptionContext);
    return allTools.filter(tool => tool.category === category);
  }

  /**
   * Find a tool by ID across all providers
   */
  public findTool(toolId: string): Tool | undefined {
    for (const provider of this.providers.values()) {
      try {
        const tool = provider.getTool(toolId);
        if (tool) {
          return tool;
        }
      } catch (error) {
        console.warn(`[ToolRegistry] Error finding tool ${toolId} in provider ${provider.id}:`, error);
      }
    }
    return undefined;
  }

  /**
   * Validate tool access for a subscription
   */
  public validateToolAccess(toolId: string, subscriptionContext: SubscriptionContext): ToolAccessValidation {
    const tool = this.findTool(toolId);
    
    if (!tool) {
      return {
        allowed: false,
        reason: 'INSUFFICIENT_TIER', // Use existing reason type
      };
    }

    // Check tier requirements
    const tierOrder: Record<string, number> = {
      'BASIC': 1,
      'PRO': 2,
      'ENTERPRISE': 3
    };

    if (tierOrder[subscriptionContext.tier] < tierOrder[tool.minimumTier]) {
      return {
        allowed: false,
        reason: 'INSUFFICIENT_TIER',
        requiredTier: tool.minimumTier
      };
    }

    // Check category restrictions
    const allowedCategories = subscriptionContext.limits.toolCategoriesAllowed;
    if (!allowedCategories.includes('*') && !allowedCategories.includes(tool.category)) {
      return {
        allowed: false,
        reason: 'CATEGORY_RESTRICTED'
      };
    }

    // Check integration limits
    if (subscriptionContext.currentIntegrations >= subscriptionContext.limits.maxToolIntegrations && 
        subscriptionContext.limits.maxToolIntegrations !== -1) {
      return {
        allowed: false,
        reason: 'INTEGRATION_LIMIT_REACHED'
      };
    }

    // Check usage quotas (simplified for now)
    const monthlyQuotas = subscriptionContext.limits.monthlyQuotas;
    const toolQuota = monthlyQuotas[toolId] || monthlyQuotas['*'] || -1;
    
    if (toolQuota !== -1) {
      // In a real implementation, we'd check actual usage here
      // For now, we'll assume quota is available
    }

    return { allowed: true };
  }

  /**
   * Check provider capabilities
   */
  public checkProviderCapabilities(providerId: string, subscriptionContext: SubscriptionContext): ProviderCapabilityCheck[] {
    const provider = this.getProvider(providerId);
    
    if (!provider) {
      return [{
        providerId,
        capabilityId: 'exists',
        available: false,
        reason: 'Provider not found'
      }];
    }

    const checks: ProviderCapabilityCheck[] = [];

    // Check each capability
    for (const capability of provider.capabilities) {
      const check: ProviderCapabilityCheck = {
        providerId,
        capabilityId: capability.id,
        available: capability.available,
        reason: capability.available ? undefined : 'Capability not available'
      };

      // Add subscription requirements
      if (!this.checkProviderAccess(provider, subscriptionContext)) {
        check.available = false;
        check.reason = `Requires ${provider.minimumTier} tier or higher`;
        check.requirements = [`Subscription tier: ${provider.minimumTier}+`];
      }

      checks.push(check);
    }

    return checks;
  }

  /**
   * Search tools by name or description
   */
  public searchTools(query: string, subscriptionContext?: SubscriptionContext): Tool[] {
    const allTools = this.getAvailableTools(subscriptionContext);
    const lowercaseQuery = query.toLowerCase();

    return allTools.filter(tool => {
      return tool.name.toLowerCase().includes(lowercaseQuery) ||
             tool.description.toLowerCase().includes(lowercaseQuery) ||
             tool.tags?.some(tag => tag.toLowerCase().includes(lowercaseQuery));
    });
  }

  /**
   * Get tool usage statistics
   */
  public async getToolUsageStats(toolId: string, timeRange?: ToolUsageTimeRange): Promise<ToolUsageStats> {
    // Filter usage records by tool and time range
    let filteredRecords = this.usageRecords.filter(record => record.toolId === toolId);

    if (timeRange) {
      filteredRecords = filteredRecords.filter(record => 
        record.timestamp >= timeRange.start && record.timestamp <= timeRange.end
      );
    }

    // Calculate statistics
    const totalExecutions = filteredRecords.length;
    const successfulExecutions = filteredRecords.filter(r => r.success).length;
    const failedExecutions = totalExecutions - successfulExecutions;
    const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;
    
    const totalExecutionTime = filteredRecords.reduce((sum, record) => sum + record.executionTime, 0);
    const averageExecutionTime = totalExecutions > 0 ? totalExecutionTime / totalExecutions : 0;

    const totalCost = filteredRecords.reduce((sum, record) => sum + (record.cost || 0), 0);

    // Group by day for daily usage
    const dailyUsageMap = new Map<string, any>();
    for (const record of filteredRecords) {
      const date = record.timestamp.toISOString().split('T')[0];
      if (!dailyUsageMap.has(date)) {
        dailyUsageMap.set(date, {
          date,
          executions: 0,
          successful: 0,
          totalExecutionTime: 0
        });
      }
      const daily = dailyUsageMap.get(date)!;
      daily.executions++;
      if (record.success) daily.successful++;
      daily.totalExecutionTime += record.executionTime;
    }

    const dailyUsage = Array.from(dailyUsageMap.values()).map(daily => ({
      date: daily.date,
      executions: daily.executions,
      successRate: daily.executions > 0 ? (daily.successful / daily.executions) * 100 : 0,
      averageExecutionTime: daily.executions > 0 ? daily.totalExecutionTime / daily.executions : 0
    }));

    // Count common errors
    const errorCounts = new Map<string, number>();
    const failedRecords = filteredRecords.filter(r => !r.success && r.error);
    for (const record of failedRecords) {
      const error = record.error!;
      errorCounts.set(error, (errorCounts.get(error) || 0) + 1);
    }

    const commonErrors = Array.from(errorCounts.entries())
      .map(([error, count]) => ({
        error,
        count,
        percentage: failedExecutions > 0 ? (count / failedExecutions) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 errors

    return {
      toolId,
      timeRange: timeRange || {
        start: new Date(0),
        end: new Date()
      },
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      successRate,
      averageExecutionTime,
      totalCost: totalCost > 0 ? totalCost : undefined,
      dailyUsage,
      commonErrors
    };
  }

  /**
   * Record tool usage (for internal tracking)
   */
  public recordUsage(record: ToolUsageRecord): void {
    this.usageRecords.push(record);
    
    // Keep only recent records to prevent memory issues
    const maxRecords = 10000;
    if (this.usageRecords.length > maxRecords) {
      this.usageRecords = this.usageRecords.slice(-maxRecords);
    }
  }

  /**
   * Get registry statistics
   */
  public getStats(): ToolRegistryStats {
    const allTools = this.getAvailableTools();
    const toolsByCategory: Record<string, number> = {};
    const toolsByTier: Record<string, number> = {};

    for (const tool of allTools) {
      toolsByCategory[tool.category] = (toolsByCategory[tool.category] || 0) + 1;
      toolsByTier[tool.minimumTier] = (toolsByTier[tool.minimumTier] || 0) + 1;
    }

    // Calculate popular tools from usage records
    const toolUsageCount = new Map<string, number>();
    for (const record of this.usageRecords) {
      toolUsageCount.set(record.toolId, (toolUsageCount.get(record.toolId) || 0) + 1);
    }

    const popularTools = Array.from(toolUsageCount.entries())
      .map(([toolId, usageCount]) => {
        const tool = this.findTool(toolId);
        return {
          toolId,
          name: tool?.name || 'Unknown',
          usageCount
        };
      })
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 10);

    return {
      totalProviders: this.providers.size,
      totalTools: allTools.length,
      toolsByCategory,
      toolsByTier,
      popularTools
    };
  }

  /**
   * Get registry health status
   */
  public getHealth(): ToolRegistryHealth {
    const providerHealth: Record<string, 'healthy' | 'degraded' | 'unhealthy'> = {};
    let healthyProviders = 0;
    let totalResponseTime = 0;
    let totalErrors = 0;
    let totalOperations = 0;

    for (const [providerId, provider] of this.providers) {
      const health = provider.getHealthStatus();
      providerHealth[providerId] = health.status;
      
      if (health.status === 'healthy') {
        healthyProviders++;
      }

      totalResponseTime += health.details.averageResponseTime;
      totalErrors += health.details.errorRate;
      totalOperations++;
    }

    const overallHealthy = healthyProviders / this.providers.size;
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (overallHealthy < 0.5) {
      status = 'unhealthy';
    } else if (overallHealthy < 0.8) {
      status = 'degraded';
    }

    return {
      status,
      providerHealth,
      metrics: {
        averageResponseTime: totalOperations > 0 ? totalResponseTime / totalOperations : 0,
        errorRate: totalOperations > 0 ? totalErrors / totalOperations : 0,
        activeInstances: this.providers.size
      },
      lastHealthCheck: new Date()
    };
  }

  /**
   * Private helper to check provider access
   */
  private checkProviderAccess(provider: ToolProvider, subscriptionContext: SubscriptionContext): boolean {
    const tierOrder: Record<string, number> = {
      'BASIC': 1,
      'PRO': 2,
      'ENTERPRISE': 3
    };

    return tierOrder[subscriptionContext.tier] >= tierOrder[provider.minimumTier];
  }

  /**
   * Cleanup all providers
   */
  public async cleanup(): Promise<void> {
    console.log('[ToolRegistry] Cleaning up all providers...');
    
    const cleanupPromises = Array.from(this.providers.values()).map(async provider => {
      try {
        await provider.cleanup?.();
      } catch (error) {
        console.warn(`[ToolRegistry] Failed to cleanup provider ${provider.id}:`, error);
      }
    });

    await Promise.allSettled(cleanupPromises);
    this.providers.clear();
    this.usageRecords = [];
    this.initialized = false;
    
    console.log('[ToolRegistry] Cleanup completed');
  }
}