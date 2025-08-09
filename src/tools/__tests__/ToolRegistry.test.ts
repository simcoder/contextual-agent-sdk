/**
 * Tests for ToolRegistry implementation
 */

import { ToolRegistry } from '../ToolRegistry';
import { BaseToolProvider } from '../ToolProvider';
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

// Mock providers for testing
class MockCommunicationProvider extends BaseToolProvider {
  readonly id = 'communication-provider';
  readonly name = 'Communication Provider';
  readonly description = 'Provider for communication tools';
  readonly category: ToolCategory = 'communication';
  readonly version = '1.0.0';
  readonly capabilities: ToolCapability[] = [
    { id: 'sms', name: 'SMS', description: 'Send SMS messages', available: true }
  ];
  readonly minimumTier: SubscriptionTier = 'BASIC';
  readonly isPremium = false;
  readonly isEnterprise = false;

  private tools: Tool[] = [
    {
      id: 'send-sms',
      name: 'Send SMS',
      description: 'Send an SMS message',
      category: 'communication',
      version: '1.0.0',
      parameters: [
        { name: 'to', type: 'string', required: true, description: 'Phone number' },
        { name: 'message', type: 'string', required: true, description: 'Message text' }
      ],
      returnType: { type: 'object', description: 'SMS result' },
      requiresAuth: true,
      minimumTier: 'BASIC',
      isPremium: false,
      tags: ['sms', 'communication']
    }
  ];

  getAvailableTools(): Tool[] {
    return this.tools;
  }

  getTool(toolId: string): Tool | undefined {
    return this.tools.find(tool => tool.id === toolId);
  }

  async authenticate(): Promise<boolean> {
    return true;
  }

  async execute(): Promise<ToolResult> {
    return { success: true, data: { status: 'sent' } };
  }

  validateConfig(): ToolConfigValidation {
    return { isValid: true, errors: [] };
  }

  getConfigSchema(): ToolConfigSchema {
    return {
      type: 'object',
      properties: { apiKey: { type: 'string' } },
      required: ['apiKey']
    };
  }
}

class MockProductivityProvider extends BaseToolProvider {
  readonly id = 'productivity-provider';
  readonly name = 'Productivity Provider';
  readonly description = 'Provider for productivity tools';
  readonly category: ToolCategory = 'productivity';
  readonly version = '1.0.0';
  readonly capabilities: ToolCapability[] = [
    { id: 'email', name: 'Email', description: 'Send emails', available: true }
  ];
  readonly minimumTier: SubscriptionTier = 'PRO';
  readonly isPremium = true;
  readonly isEnterprise = false;

  private tools: Tool[] = [
    {
      id: 'send-email',
      name: 'Send Email',
      description: 'Send an email message',
      category: 'productivity',
      version: '1.0.0',
      parameters: [
        { name: 'to', type: 'string', required: true, description: 'Email address' },
        { name: 'subject', type: 'string', required: true, description: 'Email subject' },
        { name: 'body', type: 'string', required: true, description: 'Email body' }
      ],
      returnType: { type: 'object', description: 'Email result' },
      requiresAuth: true,
      minimumTier: 'PRO',
      isPremium: true,
      tags: ['email', 'productivity']
    }
  ];

  getAvailableTools(): Tool[] {
    return this.tools;
  }

  getTool(toolId: string): Tool | undefined {
    return this.tools.find(tool => tool.id === toolId);
  }

  async authenticate(): Promise<boolean> {
    return true;
  }

  async execute(): Promise<ToolResult> {
    return { success: true, data: { status: 'sent' } };
  }

  validateConfig(): ToolConfigValidation {
    return { isValid: true, errors: [] };
  }

  getConfigSchema(): ToolConfigSchema {
    return {
      type: 'object',
      properties: { apiKey: { type: 'string' } },
      required: ['apiKey']
    };
  }
}

describe('ToolRegistry', () => {
  let registry: ToolRegistry;
  let communicationProvider: MockCommunicationProvider;
  let productivityProvider: MockProductivityProvider;

  beforeEach(() => {
    registry = new ToolRegistry();
    communicationProvider = new MockCommunicationProvider();
    productivityProvider = new MockProductivityProvider();
  });

  afterEach(async () => {
    await registry.cleanup();
  });

  describe('Provider Management', () => {
    test('should register a provider', () => {
      registry.registerProvider(communicationProvider);
      
      const provider = registry.getProvider('communication-provider');
      expect(provider).toBe(communicationProvider);
    });

    test('should unregister a provider', () => {
      registry.registerProvider(communicationProvider);
      registry.unregisterProvider('communication-provider');
      
      const provider = registry.getProvider('communication-provider');
      expect(provider).toBeUndefined();
    });

    test('should get all providers', () => {
      registry.registerProvider(communicationProvider);
      registry.registerProvider(productivityProvider);
      
      const providers = registry.getProviders();
      expect(providers).toHaveLength(2);
      expect(providers.map(p => p.id)).toContain('communication-provider');
      expect(providers.map(p => p.id)).toContain('productivity-provider');
    });

    test('should filter providers by subscription context', () => {
      registry.registerProvider(communicationProvider);
      registry.registerProvider(productivityProvider);

      const basicSubscription: SubscriptionContext = {
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
      };

      const providers = registry.getProviders(basicSubscription);
      expect(providers).toHaveLength(1);
      expect(providers[0].id).toBe('communication-provider');
    });
  });

  describe('Tool Discovery', () => {
    beforeEach(() => {
      registry.registerProvider(communicationProvider);
      registry.registerProvider(productivityProvider);
    });

    test('should get all available tools', () => {
      const tools = registry.getAvailableTools();
      expect(tools).toHaveLength(2);
      
      const toolIds = tools.map(t => t.id);
      expect(toolIds).toContain('send-sms');
      expect(toolIds).toContain('send-email');
    });

    test('should filter tools by subscription context', () => {
      const basicSubscription: SubscriptionContext = {
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
      };

      const tools = registry.getAvailableTools(basicSubscription);
      expect(tools).toHaveLength(1);
      expect(tools[0].id).toBe('send-sms');
    });

    test('should get tools by category', () => {
      const communicationTools = registry.getToolsByCategory('communication');
      expect(communicationTools).toHaveLength(1);
      expect(communicationTools[0].id).toBe('send-sms');

      const productivityTools = registry.getToolsByCategory('productivity');
      expect(productivityTools).toHaveLength(1);
      expect(productivityTools[0].id).toBe('send-email');
    });

    test('should find tool by ID', () => {
      const tool = registry.findTool('send-sms');
      expect(tool).toBeDefined();
      expect(tool!.id).toBe('send-sms');
    });

    test('should return undefined for unknown tool', () => {
      const tool = registry.findTool('unknown-tool');
      expect(tool).toBeUndefined();
    });

    test('should search tools by query', () => {
      const results = registry.searchTools('sms');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('send-sms');

      const emailResults = registry.searchTools('email');
      expect(emailResults).toHaveLength(1);
      expect(emailResults[0].id).toBe('send-email');

      const communicationResults = registry.searchTools('communication');
      expect(communicationResults).toHaveLength(1);
      expect(communicationResults[0].id).toBe('send-sms');
    });
  });

  describe('Access Validation', () => {
    beforeEach(() => {
      registry.registerProvider(communicationProvider);
      registry.registerProvider(productivityProvider);
    });

    test('should allow access to basic tier tool', () => {
      const basicSubscription: SubscriptionContext = {
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
      };

      const validation = registry.validateToolAccess('send-sms', basicSubscription);
      expect(validation.allowed).toBe(true);
    });

    test('should deny access due to insufficient tier', () => {
      const basicSubscription: SubscriptionContext = {
        tier: 'BASIC',
        organizationId: 'org-1',
        limits: {
          maxToolIntegrations: 1,
          toolCategoriesAllowed: ['productivity'],
          monthlyQuotas: {},
          customToolsEnabled: false,
          workflowAutomationEnabled: false
        },
        currentIntegrations: 0
      };

      const validation = registry.validateToolAccess('send-email', basicSubscription);
      expect(validation.allowed).toBe(false);
      expect(validation.reason).toBe('INSUFFICIENT_TIER');
      expect(validation.requiredTier).toBe('PRO');
    });

    test('should deny access due to category restriction', () => {
      const basicSubscription: SubscriptionContext = {
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

      const validation = registry.validateToolAccess('send-sms', basicSubscription);
      expect(validation.allowed).toBe(false);
      expect(validation.reason).toBe('CATEGORY_RESTRICTED');
    });

    test('should deny access due to integration limit', () => {
      const basicSubscription: SubscriptionContext = {
        tier: 'BASIC',
        organizationId: 'org-1',
        limits: {
          maxToolIntegrations: 1,
          toolCategoriesAllowed: ['communication'],
          monthlyQuotas: {},
          customToolsEnabled: false,
          workflowAutomationEnabled: false
        },
        currentIntegrations: 1 // Already at limit
      };

      const validation = registry.validateToolAccess('send-sms', basicSubscription);
      expect(validation.allowed).toBe(false);
      expect(validation.reason).toBe('INTEGRATION_LIMIT_REACHED');
    });
  });

  describe('Capability Checks', () => {
    beforeEach(() => {
      registry.registerProvider(communicationProvider);
    });

    test('should check provider capabilities', () => {
      const basicSubscription: SubscriptionContext = {
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
      };

      const checks = registry.checkProviderCapabilities('communication-provider', basicSubscription);
      expect(checks).toHaveLength(1);
      expect(checks[0].capabilityId).toBe('sms');
      expect(checks[0].available).toBe(true);
    });

    test('should return not found for unknown provider', () => {
      const basicSubscription: SubscriptionContext = {
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
      };

      const checks = registry.checkProviderCapabilities('unknown-provider', basicSubscription);
      expect(checks).toHaveLength(1);
      expect(checks[0].available).toBe(false);
      expect(checks[0].reason).toBe('Provider not found');
    });
  });

  describe('Usage Statistics', () => {
    beforeEach(() => {
      registry.registerProvider(communicationProvider);
    });

    test('should return empty stats for unused tool', async () => {
      const stats = await registry.getToolUsageStats('send-sms');
      
      expect(stats.toolId).toBe('send-sms');
      expect(stats.totalExecutions).toBe(0);
      expect(stats.successfulExecutions).toBe(0);
      expect(stats.failedExecutions).toBe(0);
      expect(stats.successRate).toBe(0);
      expect(stats.dailyUsage).toHaveLength(0);
      expect(stats.commonErrors).toHaveLength(0);
    });

    test('should track usage records', async () => {
      // Record some usage
      registry.recordUsage({
        toolId: 'send-sms',
        agentId: 'agent-1',
        organizationId: 'org-1',
        timestamp: new Date(),
        success: true,
        executionTime: 100,
        cost: 0.01
      });

      registry.recordUsage({
        toolId: 'send-sms',
        agentId: 'agent-1',
        organizationId: 'org-1',
        timestamp: new Date(),
        success: false,
        executionTime: 50,
        error: 'Network error'
      });

      const stats = await registry.getToolUsageStats('send-sms');
      
      expect(stats.totalExecutions).toBe(2);
      expect(stats.successfulExecutions).toBe(1);
      expect(stats.failedExecutions).toBe(1);
      expect(stats.successRate).toBe(50);
      expect(stats.averageExecutionTime).toBe(75);
      expect(stats.totalCost).toBe(0.01);
      expect(stats.commonErrors).toHaveLength(1);
      expect(stats.commonErrors[0].error).toBe('Network error');
    });
  });

  describe('Registry Statistics and Health', () => {
    beforeEach(() => {
      registry.registerProvider(communicationProvider);
      registry.registerProvider(productivityProvider);
    });

    test('should return registry statistics', () => {
      const stats = registry.getStats();
      
      expect(stats.totalProviders).toBe(2);
      expect(stats.totalTools).toBe(2);
      expect(stats.toolsByCategory['communication']).toBe(1);
      expect(stats.toolsByCategory['productivity']).toBe(1);
      expect(stats.toolsByTier['BASIC']).toBe(1);
      expect(stats.toolsByTier['PRO']).toBe(1);
    });

    test('should return health status', () => {
      const health = registry.getHealth();
      
      expect(health.status).toBeDefined();
      expect(health.providerHealth).toHaveProperty('communication-provider');
      expect(health.providerHealth).toHaveProperty('productivity-provider');
      expect(health.metrics).toBeDefined();
      expect(health.lastHealthCheck).toBeInstanceOf(Date);
    });
  });

  describe('Cleanup', () => {
    test('should cleanup all providers', async () => {
      registry.registerProvider(communicationProvider);
      registry.registerProvider(productivityProvider);
      
      await registry.cleanup();
      
      const providers = registry.getProviders();
      expect(providers).toHaveLength(0);
    });
  });
});