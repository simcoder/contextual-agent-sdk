/**
 * Base ToolProvider interface and utilities
 * 
 * Provides the core interface for all tool providers in the SDK.
 * This is an additive feature that doesn't affect existing functionality.
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
} from './types/tools';

import type {
  ToolProvider as IToolProvider,
  ToolExecutionContext,
  ProviderTestResult,
  ProviderHealthStatus
} from './types/providers';

import type { SubscriptionContext } from './types/subscriptions';

/**
 * Abstract base class for tool providers
 * 
 * Provides common functionality and enforces the provider interface.
 * Concrete providers should extend this class.
 */
export abstract class BaseToolProvider implements IToolProvider {
  public abstract readonly id: string;
  public abstract readonly name: string;
  public abstract readonly description: string;
  public abstract readonly category: ToolCategory;
  public abstract readonly version: string;
  public abstract readonly capabilities: ToolCapability[];
  public abstract readonly minimumTier: SubscriptionTier;
  public abstract readonly isPremium: boolean;
  public abstract readonly isEnterprise: boolean;

  private _isAuthenticated: boolean = false;
  private _lastHealthCheck?: Date;
  private _healthStatus: ProviderHealthStatus['status'] = 'unhealthy';

  /**
   * Get all tools provided by this provider
   * Filters tools based on subscription context if provided
   */
  public abstract getAvailableTools(subscriptionContext?: SubscriptionContext): Tool[];

  /**
   * Get a specific tool by ID
   */
  public abstract getTool(toolId: string): Tool | undefined;

  /**
   * Authenticate with the provider
   */
  public abstract authenticate(credentials: ToolCredentials): Promise<boolean>;

  /**
   * Execute a tool with given parameters
   */
  public abstract execute(toolId: string, params: ToolParams, context?: ToolExecutionContext): Promise<ToolResult>;

  /**
   * Validate tool configuration
   */
  public abstract validateConfig(toolId: string, config: any): ToolConfigValidation;

  /**
   * Get configuration schema for a tool
   */
  public abstract getConfigSchema(toolId: string): ToolConfigSchema | undefined;

  /**
   * Test provider connectivity
   * Base implementation - providers can override
   */
  public async testConnection(credentials?: ToolCredentials): Promise<ProviderTestResult> {
    const startTime = Date.now();
    
    try {
      if (credentials) {
        const authResult = await this.authenticate(credentials);
        if (!authResult) {
          return {
            success: false,
            responseTime: Date.now() - startTime,
            error: 'Authentication failed'
          };
        }
      }

      // Basic connectivity test - providers should override with specific tests
      return {
        success: true,
        responseTime: Date.now() - startTime,
        metadata: {
          providerId: this.id,
          testType: 'basic_connectivity'
        }
      };
    } catch (error) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get provider health status
   * Base implementation - providers should override with specific health checks
   */
  public getHealthStatus(): ProviderHealthStatus {
    return {
      status: this._healthStatus,
      lastCheck: this._lastHealthCheck || new Date(),
      details: {
        apiConnectivity: this._isAuthenticated,
        authentication: this._isAuthenticated,
        rateLimitStatus: 'ok',
        errorRate: 0,
        averageResponseTime: 0
      }
    };
  }

  /**
   * Update authentication status
   * Protected method for subclasses
   */
  protected setAuthenticationStatus(isAuthenticated: boolean): void {
    this._isAuthenticated = isAuthenticated;
    this._lastHealthCheck = new Date();
    this._healthStatus = isAuthenticated ? 'healthy' : 'unhealthy';
  }

  /**
   * Update health status
   * Protected method for subclasses
   */
  protected setHealthStatus(status: ProviderHealthStatus['status']): void {
    this._healthStatus = status;
    this._lastHealthCheck = new Date();
  }

  /**
   * Cleanup provider resources
   * Base implementation - providers can override
   */
  public async cleanup(): Promise<void> {
    this._isAuthenticated = false;
    this._healthStatus = 'unhealthy';
    console.log(`[${this.id}] Provider cleanup completed`);
  }

  /**
   * Utility method to check if tool is available for subscription
   */
  protected isToolAvailableForSubscription(tool: Tool, subscriptionContext?: SubscriptionContext): boolean {
    if (!subscriptionContext) {
      return true; // No subscription context means no restrictions
    }

    // Check tier requirements
    const tierOrder: Record<SubscriptionTier, number> = {
      'BASIC': 1,
      'PRO': 2,
      'ENTERPRISE': 3
    };

    if (tierOrder[subscriptionContext.tier] < tierOrder[tool.minimumTier]) {
      return false;
    }

    // Check category restrictions
    const allowedCategories = subscriptionContext.limits.toolCategoriesAllowed;
    if (!allowedCategories.includes('*') && !allowedCategories.includes(tool.category)) {
      return false;
    }

    return true;
  }

  /**
   * Utility method to validate execution context
   */
  protected validateExecutionContext(context?: ToolExecutionContext): boolean {
    if (!context) {
      return false;
    }

    return !!(
      context.agentId &&
      context.organizationId &&
      context.subscription
    );
  }

  /**
   * Utility method to create error result
   */
  protected createErrorResult(error: string, errorCode?: string): ToolResult {
    return {
      success: false,
      error,
      errorCode,
      metadata: {
        executionTime: 0,
        providerVersion: this.version
      }
    };
  }

  /**
   * Utility method to create success result
   */
  protected createSuccessResult(data: any, metadata?: Partial<ToolResult['metadata']>): ToolResult {
    return {
      success: true,
      data,
      metadata: {
        executionTime: 0,
        providerVersion: this.version,
        ...metadata
      }
    };
  }
}

/**
 * Export the interface for external implementations
 */
export type { IToolProvider as ToolProvider };

/**
 * Utility functions for tool providers
 */
export class ToolProviderUtils {
  /**
   * Validate tool parameters against tool definition
   */
  static validateParameters(tool: Tool, params: ToolParams): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required parameters
    for (const param of tool.parameters) {
      if (param.required && !(param.name in params)) {
        errors.push(`Required parameter '${param.name}' is missing`);
        continue;
      }

      // Check parameter types if provided
      if (param.name in params) {
        const value = params[param.name];
        const expectedType = param.type;
        const actualType = Array.isArray(value) ? 'array' : typeof value;

        if (expectedType !== actualType) {
          errors.push(`Parameter '${param.name}' expected ${expectedType} but got ${actualType}`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Apply default values to parameters
   */
  static applyParameterDefaults(tool: Tool, params: ToolParams): ToolParams {
    const result = { ...params };

    for (const param of tool.parameters) {
      if (!(param.name in result) && param.default !== undefined) {
        result[param.name] = param.default;
      }
    }

    return result;
  }

  /**
   * Check if subscription tier meets tool requirements
   */
  static checkTierRequirement(toolTier: SubscriptionTier, userTier: SubscriptionTier): boolean {
    const tierOrder: Record<SubscriptionTier, number> = {
      'BASIC': 1,
      'PRO': 2,
      'ENTERPRISE': 3
    };

    return tierOrder[userTier] >= tierOrder[toolTier];
  }
}