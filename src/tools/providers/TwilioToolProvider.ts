/**
 * Twilio Tool Provider
 * 
 * Provides SMS and voice communication tools using the Twilio API.
 * This serves as a reference implementation for other tool providers.
 */

import { BaseToolProvider } from '../ToolProvider';
import type { 
  Tool, 
  ToolCredentials, 
  ToolParams, 
  ToolResult, 
  SubscriptionTier,
  ToolCapability,
  ToolConfigValidation,
  ToolConfigSchema
} from '../types/tools';

import type { 
  ToolExecutionContext 
} from '../types/providers';

import type { SubscriptionContext } from '../types/subscriptions';

export interface TwilioCredentials extends ToolCredentials {
  accountSid: string;
  authToken: string;
  fromPhoneNumber: string;
}

export interface SendSMSParams extends ToolParams {
  to: string;
  message: string;
  mediaUrl?: string; // Optional for MMS
}

export interface MakeCallParams extends ToolParams {
  to: string;
  message: string; // TTS message
  voice?: 'man' | 'woman' | 'alice';
}

export interface SendSMSResult extends ToolResult {
  messageSid: string;
  status: string;
  to: string;
  from: string;
  body: string;
  cost?: string;
}

export interface MakeCallResult extends ToolResult {
  callSid: string;
  status: string;
  to: string;
  from: string;
  duration?: string;
}

export class TwilioToolProvider extends BaseToolProvider {
  readonly id = 'twilio';
  readonly name = 'Twilio';
  readonly description = 'SMS and voice communication tools powered by Twilio';
  readonly category = 'communication';
  readonly version = '1.0.0';
  readonly capabilities: ToolCapability[] = [
    { id: 'send_message', name: 'Send Message', description: 'Send SMS/text messages', available: true },
    { id: 'voice_call', name: 'Voice Call', description: 'Make voice calls with TTS', available: true }
  ];
  readonly minimumTier: SubscriptionTier = 'BASIC';
  readonly isPremium = false;
  readonly isEnterprise = false;

  /**
   * Get available tools for this provider
   */
  getAvailableTools(): Tool[] {
    return [
      {
        id: 'send_sms',
        name: 'Send SMS',
        description: 'Send SMS messages to phone numbers',
        category: 'communication',

        minimumTier: 'BASIC',
        rateLimits: {
          requestsPerHour: 100
        },
        requiresAuth: true,
        isPremium: false,
        version: '1.0.0',
        parameters: [
          {
            name: 'to',
            type: 'string',
            description: 'Recipient phone number (E.164 format)',
            required: true,
            schema: {
              pattern: '^\\+[1-9]\\d{1,14}$'
            }
          },
          {
            name: 'message',
            type: 'string',
            description: 'SMS message content',
            required: true,
            schema: {
              maxLength: 1600
            }
          },
          {
            name: 'mediaUrl',
            type: 'string',
            description: 'Optional media URL for MMS',
            required: false,
            schema: {
              pattern: '^https?:\\/\\/.+'
            }
          }
        ],
        returnType: {
          type: 'object',
          description: 'SMS sending result',
          schema: {
            type: 'object',
            properties: {
              messageSid: { type: 'string', description: 'Twilio message SID' },
              status: { type: 'string', description: 'Message status' },
              to: { type: 'string', description: 'Recipient phone number' },
              from: { type: 'string', description: 'Sender phone number' },
              body: { type: 'string', description: 'Message content' },
              cost: { type: 'string', description: 'Message cost (optional)' }
            },
            required: ['messageSid', 'status', 'to', 'from', 'body']
          }
        }
      },
      {
        id: 'make_call',
        name: 'Make Voice Call',
        description: 'Make voice calls with text-to-speech',
        category: 'communication',

        minimumTier: 'PRO',
        rateLimits: {
          requestsPerHour: 20
        },
        requiresAuth: true,
        isPremium: false,
        version: '1.0.0',
        parameters: [
          {
            name: 'to',
            type: 'string',
            description: 'Recipient phone number (E.164 format)',
            required: true,
            schema: {
              pattern: '^\\+[1-9]\\d{1,14}$'
            }
          },
          {
            name: 'message',
            type: 'string',
            description: 'Text-to-speech message',
            required: true,
            schema: {
              maxLength: 4000
            }
          },
          {
            name: 'voice',
            type: 'string',
            description: 'Voice type for TTS',
            required: false,
            schema: {
              enum: ['man', 'woman', 'alice']
            }
          }
        ],
        returnType: {
          type: 'object',
          description: 'Voice call result',
          schema: {
            type: 'object',
            properties: {
              callSid: { type: 'string', description: 'Twilio call SID' },
              status: { type: 'string', description: 'Call status' },
              to: { type: 'string', description: 'Recipient phone number' },
              from: { type: 'string', description: 'Caller phone number' },
              duration: { type: 'string', description: 'Call duration (optional)' }
            },
            required: ['callSid', 'status', 'to', 'from']
          }
        }
      }
    ];
  }

  /**
   * Get a specific tool by ID
   */
  getTool(toolId: string): Tool | undefined {
    return this.getAvailableTools().find(tool => tool.id === toolId);
  }

  /**
   * Authenticate with the provider (alias for validateCredentials)
   */
  async authenticate(credentials: ToolCredentials): Promise<boolean> {
    return this.validateCredentials(credentials as TwilioCredentials);
  }

  /**
   * Execute a tool (alias for executeTool)
   */
  async execute(
    toolId: string, 
    params: ToolParams, 
    context?: ToolExecutionContext
  ): Promise<ToolResult> {
    if (!context) {
      throw new Error('Execution context is required');
    }
    // We need credentials from context - this would be passed from the backend
    const credentials = context.metadata?.credentials as TwilioCredentials;
    if (!credentials) {
      throw new Error('Twilio credentials not provided in context');
    }
    return this.executeTool(toolId, params, credentials, context);
  }

  /**
   * Validate tool configuration
   */
  validateConfig(toolId: string, config: any): ToolConfigValidation {
    const tool = this.getTool(toolId);
    if (!tool) {
      return {
        isValid: false,
        errors: [`Unknown tool: ${toolId}`]
      };
    }

    const errors: string[] = [];
    
    // Basic validation - in a real implementation, this would be more thorough
    if (config && typeof config === 'object') {
      // Tool config is valid
    } else {
      errors.push('Configuration must be an object');
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : []
    };
  }

  /**
   * Get configuration schema for a tool
   */
  getConfigSchema(toolId: string): ToolConfigSchema | undefined {
    const tool = this.getTool(toolId);
    if (!tool) {
      return undefined;
    }

    return {
      type: 'object' as const,
      properties: {
        enabled: {
          type: 'boolean',
          title: 'Enable Tool',
          description: `Enable ${tool.name}`,
          default: true
        }
      },
      required: ['enabled']
    };
  }

  /**
   * Validate credentials for this provider
   */
  async validateCredentials(credentials: TwilioCredentials): Promise<boolean> {
    try {
      // Basic validation
      if (!credentials.accountSid || !credentials.authToken || !credentials.fromPhoneNumber) {
        return false;
      }

      // Validate phone number format
      const phoneRegex = /^\+[1-9]\d{1,14}$/;
      if (!phoneRegex.test(credentials.fromPhoneNumber)) {
        return false;
      }

      // In a real implementation, we could make a test API call to Twilio
      // For now, we'll just validate the format
      return credentials.accountSid.startsWith('AC') && 
             credentials.authToken.length >= 32;

    } catch (error) {
      console.error('[TwilioProvider] Credential validation failed:', error);
      return false;
    }
  }

  /**
   * Execute a tool with the given parameters
   */
  async executeTool(
    toolId: string, 
    params: ToolParams, 
    credentials: TwilioCredentials,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    try {
      switch (toolId) {
        case 'send_sms':
          return await this.sendSMS(params as SendSMSParams, credentials, context);
        case 'make_call':
          return await this.makeCall(params as MakeCallParams, credentials, context);
        default:
          throw new Error(`Unknown tool: ${toolId}`);
      }
    } catch (error) {
      console.error(`[TwilioProvider] Tool execution failed for ${toolId}:`, error);
      throw error;
    }
  }

  /**
   * Send SMS message
   */
  private async sendSMS(
    params: SendSMSParams, 
    credentials: TwilioCredentials,
    context: ToolExecutionContext
  ): Promise<SendSMSResult> {
    try {
      // In a real implementation, this would use the Twilio SDK
      // For now, we'll simulate the response
      const mockResponse = {
        messageSid: `SM${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
        status: 'sent',
        to: params.to,
        from: credentials.fromPhoneNumber,
        body: params.message,
        cost: '0.0075' // Typical SMS cost
      };

      // Log the execution for debugging
      console.log(`[TwilioProvider] SMS sent:`, {
        to: params.to,
        from: credentials.fromPhoneNumber,
        messageLength: params.message.length,
        hasMedia: !!params.mediaUrl,
        organizationId: context.organizationId,
        agentId: context.agentId
      });

      return {
        success: true,
        data: mockResponse,
        ...mockResponse
      };

    } catch (error) {
      console.error('[TwilioProvider] SMS sending failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send SMS',
        data: null,
        messageSid: '',
        status: 'failed',
        to: params.to,
        from: credentials.fromPhoneNumber,
        body: params.message
      };
    }
  }

  /**
   * Make voice call
   */
  private async makeCall(
    params: MakeCallParams, 
    credentials: TwilioCredentials,
    context: ToolExecutionContext
  ): Promise<MakeCallResult> {
    try {
      // In a real implementation, this would use the Twilio SDK
      // For now, we'll simulate the response
      const mockResponse = {
        callSid: `CA${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
        status: 'in-progress',
        to: params.to,
        from: credentials.fromPhoneNumber,
        duration: '0' // Will be updated when call completes
      };

      // Log the execution for debugging
      console.log(`[TwilioProvider] Call initiated:`, {
        to: params.to,
        from: credentials.fromPhoneNumber,
        messageLength: params.message.length,
        voice: params.voice || 'default',
        organizationId: context.organizationId,
        agentId: context.agentId
      });

      return {
        success: true,
        data: mockResponse,
        ...mockResponse
      };

    } catch (error) {
      console.error('[TwilioProvider] Call initiation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initiate call',
        data: null,
        callSid: '',
        status: 'failed',
        to: params.to,
        from: credentials.fromPhoneNumber
      };
    }
  }



  /**
   * Get usage statistics for this provider
   */
  async getUsageStats(
    organizationId: string, 
    period: string = 'month'
  ): Promise<Record<string, any>> {
    // In a real implementation, this would query actual usage data
    return {
      sms_sent: 0,
      calls_made: 0,
      total_cost: 0,
      period
    };
  }
}