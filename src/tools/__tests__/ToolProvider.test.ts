/**
 * Tests for ToolProvider base class and utilities
 */

import { BaseToolProvider, ToolProviderUtils } from '../ToolProvider';
import {
  Tool,
  ToolCategory,
  ToolCapability,
  ToolCredentials,
  ToolParams,
  ToolResult,
  ToolConfigValidation,
  ToolConfigSchema,
  SubscriptionTier,
  ToolExecutionContext,
  SubscriptionContext
} from '../types';

// Mock implementation for testing
class MockToolProvider extends BaseToolProvider {
  readonly id = 'mock-provider';
  readonly name = 'Mock Provider';
  readonly description = 'A mock provider for testing';
  readonly category: ToolCategory = 'communication';
  readonly version = '1.0.0';
  readonly capabilities: ToolCapability[] = [
    { id: 'test', name: 'Test Capability', description: 'Test capability', available: true }
  ];
  readonly minimumTier: SubscriptionTier = 'BASIC';
  readonly isPremium = false;
  readonly isEnterprise = false;

  private mockTools: Tool[] = [
    {
      id: 'test-tool',
      name: 'Test Tool',
      description: 'A test tool',
      category: 'communication',
      version: '1.0.0',
      parameters: [
        { name: 'message', type: 'string', required: true, description: 'Message to send' },
        { name: 'priority', type: 'string', required: false, default: 'normal', description: 'Message priority' }
      ],
      returnType: { type: 'object', description: 'Result object' },
      requiresAuth: true,
      minimumTier: 'BASIC',
      isPremium: false,
      tags: ['test', 'mock']
    }
  ];

  getAvailableTools(subscriptionContext?: SubscriptionContext): Tool[] {
    return this.mockTools.filter(tool => 
      this.isToolAvailableForSubscription(tool, subscriptionContext)
    );
  }

  getTool(toolId: string): Tool | undefined {
    return this.mockTools.find(tool => tool.id === toolId);
  }

  async authenticate(credentials: ToolCredentials): Promise<boolean> {
    const isValid = credentials.type === 'api_key' && credentials.data.apiKey === 'valid-key';
    this.setAuthenticationStatus(isValid);
    return isValid;
  }

  async execute(toolId: string, params: ToolParams, context?: ToolExecutionContext): Promise<ToolResult> {
    const tool = this.getTool(toolId);
    if (!tool) {
      return this.createErrorResult(`Tool not found: ${toolId}`, 'TOOL_NOT_FOUND');
    }

    if (!this.validateExecutionContext(context)) {
      return this.createErrorResult('Invalid execution context', 'INVALID_CONTEXT');
    }

    // Validate parameters
    const validation = ToolProviderUtils.validateParameters(tool, params);
    if (!validation.isValid) {
      return this.createErrorResult(`Parameter validation failed: ${validation.errors.join(', ')}`, 'INVALID_PARAMETERS');
    }

    // Mock successful execution
    return this.createSuccessResult(
      { message: 'Tool executed successfully', params },
      { executionTime: 100 }
    );
  }

  validateConfig(toolId: string, config: any): ToolConfigValidation {
    return {
      isValid: true,
      errors: [],
      normalizedConfig: config
    };
  }

  getConfigSchema(toolId: string): ToolConfigSchema | undefined {
    return {
      type: 'object',
      properties: {
        apiKey: { type: 'string', description: 'API key for authentication' }
      },
      required: ['apiKey']
    };
  }
}

describe('BaseToolProvider', () => {
  let provider: MockToolProvider;

  beforeEach(() => {
    provider = new MockToolProvider();
  });

  afterEach(async () => {
    await provider.cleanup();
  });

  describe('Authentication', () => {
    test('should authenticate with valid credentials', async () => {
      const credentials: ToolCredentials = {
        type: 'api_key',
        data: { apiKey: 'valid-key' }
      };

      const result = await provider.authenticate(credentials);
      expect(result).toBe(true);

      const health = provider.getHealthStatus();
      expect(health.details.authentication).toBe(true);
    });

    test('should fail authentication with invalid credentials', async () => {
      const credentials: ToolCredentials = {
        type: 'api_key',
        data: { apiKey: 'invalid-key' }
      };

      const result = await provider.authenticate(credentials);
      expect(result).toBe(false);

      const health = provider.getHealthStatus();
      expect(health.details.authentication).toBe(false);
    });
  });

  describe('Tool Discovery', () => {
    test('should return available tools', () => {
      const tools = provider.getAvailableTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].id).toBe('test-tool');
    });

    test('should filter tools by subscription context', () => {
      const subscriptionContext: SubscriptionContext = {
        tier: 'BASIC',
        organizationId: 'org-1',
        limits: {
          maxToolIntegrations: 1,
          toolCategoriesAllowed: ['data'], // Different category
          monthlyQuotas: {},
          customToolsEnabled: false,
          workflowAutomationEnabled: false
        },
        currentIntegrations: 0
      };

      const tools = provider.getAvailableTools(subscriptionContext);
      expect(tools).toHaveLength(0); // Should be filtered out due to category restriction
    });

    test('should find tool by ID', () => {
      const tool = provider.getTool('test-tool');
      expect(tool).toBeDefined();
      expect(tool!.id).toBe('test-tool');
    });

    test('should return undefined for unknown tool', () => {
      const tool = provider.getTool('unknown-tool');
      expect(tool).toBeUndefined();
    });
  });

  describe('Tool Execution', () => {
    let executionContext: ToolExecutionContext;

    beforeEach(async () => {
      // Authenticate first
      await provider.authenticate({
        type: 'api_key',
        data: { apiKey: 'valid-key' }
      });

      executionContext = {
        agentId: 'agent-1',
        organizationId: 'org-1',
        subscription: {
          tier: 'BASIC',
          organizationId: 'org-1',
          limits: {
            maxToolIntegrations: 1,
            toolCategoriesAllowed: ['communication'],
            monthlyQuotas: {},
            customToolsEnabled: false,
            workflowAutomationEnabled: false
          },
          currentIntegrations: 0
        }
      };
    });

    test('should execute tool with valid parameters', async () => {
      const params = { message: 'Hello, World!' };
      const result = await provider.execute('test-tool', params, executionContext);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        message: 'Tool executed successfully',
        params: { message: 'Hello, World!', priority: 'normal' } // Should include default
      });
      expect(result.metadata?.executionTime).toBe(100);
    });

    test('should fail with missing required parameters', async () => {
      const params = {}; // Missing required 'message' parameter
      const result = await provider.execute('test-tool', params, executionContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Parameter validation failed');
      expect(result.errorCode).toBe('INVALID_PARAMETERS');
    });

    test('should fail with invalid execution context', async () => {
      const params = { message: 'Hello, World!' };
      const result = await provider.execute('test-tool', params); // No context

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid execution context');
      expect(result.errorCode).toBe('INVALID_CONTEXT');
    });

    test('should fail for unknown tool', async () => {
      const params = { message: 'Hello, World!' };
      const result = await provider.execute('unknown-tool', params, executionContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tool not found: unknown-tool');
      expect(result.errorCode).toBe('TOOL_NOT_FOUND');
    });
  });

  describe('Configuration', () => {
    test('should validate configuration', () => {
      const config = { apiKey: 'test-key' };
      const validation = provider.validateConfig('test-tool', config);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should return configuration schema', () => {
      const schema = provider.getConfigSchema('test-tool');

      expect(schema).toBeDefined();
      expect(schema!.type).toBe('object');
      expect(schema!.required).toContain('apiKey');
    });
  });

  describe('Health and Testing', () => {
    test('should test connection successfully', async () => {
      const credentials: ToolCredentials = {
        type: 'api_key',
        data: { apiKey: 'valid-key' }
      };

      const result = await provider.testConnection(credentials);

      expect(result.success).toBe(true);
      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.metadata?.providerId).toBe('mock-provider');
    });

    test('should test connection without credentials', async () => {
      const result = await provider.testConnection();

      expect(result.success).toBe(true);
      expect(result.responseTime).toBeGreaterThan(0);
    });

    test('should return health status', () => {
      const health = provider.getHealthStatus();

      expect(health.status).toBeDefined();
      expect(health.lastCheck).toBeInstanceOf(Date);
      expect(health.details).toBeDefined();
    });
  });
});

describe('ToolProviderUtils', () => {
  const mockTool: Tool = {
    id: 'test-tool',
    name: 'Test Tool',
    description: 'A test tool',
    category: 'communication',
    version: '1.0.0',
    parameters: [
      { name: 'message', type: 'string', required: true, description: 'Message to send' },
      { name: 'priority', type: 'string', required: false, default: 'normal', description: 'Message priority' },
      { name: 'count', type: 'number', required: true, description: 'Count value' }
    ],
    returnType: { type: 'object', description: 'Result object' },
    requiresAuth: true,
    minimumTier: 'BASIC',
    isPremium: false
  };

  describe('Parameter Validation', () => {
    test('should validate correct parameters', () => {
      const params = { message: 'Hello', count: 5 };
      const validation = ToolProviderUtils.validateParameters(mockTool, params);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should detect missing required parameters', () => {
      const params = { message: 'Hello' }; // Missing required 'count'
      const validation = ToolProviderUtils.validateParameters(mockTool, params);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain("Required parameter 'count' is missing");
    });

    test('should detect incorrect parameter types', () => {
      const params = { message: 'Hello', count: 'not-a-number' };
      const validation = ToolProviderUtils.validateParameters(mockTool, params);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain("Parameter 'count' expected number but got string");
    });
  });

  describe('Default Parameter Application', () => {
    test('should apply default values', () => {
      const params = { message: 'Hello', count: 5 };
      const result = ToolProviderUtils.applyParameterDefaults(mockTool, params);

      expect(result).toEqual({
        message: 'Hello',
        count: 5,
        priority: 'normal' // Default applied
      });
    });

    test('should not override provided values', () => {
      const params = { message: 'Hello', count: 5, priority: 'high' };
      const result = ToolProviderUtils.applyParameterDefaults(mockTool, params);

      expect(result.priority).toBe('high'); // Should not be overridden
    });
  });

  describe('Tier Requirement Check', () => {
    test('should allow equal tier', () => {
      const result = ToolProviderUtils.checkTierRequirement('PRO', 'PRO');
      expect(result).toBe(true);
    });

    test('should allow higher tier', () => {
      const result = ToolProviderUtils.checkTierRequirement('BASIC', 'PRO');
      expect(result).toBe(true);
    });

    test('should deny lower tier', () => {
      const result = ToolProviderUtils.checkTierRequirement('ENTERPRISE', 'BASIC');
      expect(result).toBe(false);
    });
  });
});