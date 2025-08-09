/**
 * Tool Converter
 * 
 * Converts between SDK Tool format and LLM provider-specific tool formats
 * (OpenAI functions, Anthropic tools, etc.)
 */

import { Tool, ToolResult, ToolExecutionContext } from '../../types';
import { ToolDefinition, ToolCall } from '../../types/llm-providers';

export class ToolConverter {
  /**
   * Convert SDK Tool to OpenAI function format
   */
  static toOpenAIFunction(tool: Tool): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: tool.id,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: this.inferParametersFromTool(tool),
          required: [] // We'll infer required parameters
        }
      }
    };
  }

  /**
   * Convert SDK Tool to Anthropic tool format
   */
  static toAnthropicTool(tool: Tool): {
    name: string;
    description: string;
    input_schema: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  } {
    return {
      name: tool.id,
      description: tool.description,
      input_schema: {
        type: 'object',
        properties: this.inferParametersFromTool(tool),
        required: []
      }
    };
  }

  /**
   * Convert multiple SDK Tools to OpenAI functions
   */
  static toOpenAIFunctions(tools: Tool[]): ToolDefinition[] {
    return tools.map(tool => this.toOpenAIFunction(tool));
  }

  /**
   * Convert multiple SDK Tools to Anthropic tools
   */
  static toAnthropicTools(tools: Tool[]): Array<{
    name: string;
    description: string;
    input_schema: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  }> {
    return tools.map(tool => this.toAnthropicTool(tool));
  }

  /**
   * Execute a tool call using SDK Tool
   */
  static async executeToolCall(
    toolCall: ToolCall,
    tools: Tool[],
    context?: ToolExecutionContext
  ): Promise<ToolResult> {
    const tool = tools.find(t => t.id === toolCall.function.name);
    if (!tool) {
      return {
        success: false,
        error: `Tool ${toolCall.function.name} not found`,
        metadata: { toolCallId: toolCall.id }
      };
    }

    try {
      const params = JSON.parse(toolCall.function.arguments);
      const result = await tool.execute(params, context);
      
      return {
        ...result,
        metadata: {
          ...result.metadata,
          toolCallId: toolCall.id,
          toolName: tool.id
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Tool execution failed: ${error.message}`,
        metadata: { 
          toolCallId: toolCall.id,
          toolName: tool.id,
          originalError: error.message
        }
      };
    }
  }

  /**
   * Execute multiple tool calls in parallel
   */
  static async executeToolCalls(
    toolCalls: ToolCall[],
    tools: Tool[],
    context?: ToolExecutionContext
  ): Promise<ToolResult[]> {
    const promises = toolCalls.map(toolCall => 
      this.executeToolCall(toolCall, tools, context)
    );

    return Promise.all(promises);
  }

  /**
   * Infer parameter schema from tool (basic implementation)
   * In a real implementation, this could be enhanced with more sophisticated
   * parameter detection or tools could include their own schemas
   */
  private static inferParametersFromTool(tool: Tool): Record<string, any> {
    // For now, return a generic parameter schema
    // In a real implementation, you might:
    // 1. Parse tool.description for parameter hints
    // 2. Use JSDoc comments if available
    // 3. Require tools to provide their own schemas
    
    // Basic schema for common tools
    if (tool.id.includes('sms') || tool.id.includes('twilio')) {
      return {
        to: {
          type: 'string',
          description: 'Phone number to send SMS to (E.164 format, e.g., +1234567890)'
        },
        message: {
          type: 'string',
          description: 'The message content to send'
        }
      };
    }

    if (tool.id.includes('email')) {
      return {
        to: {
          type: 'string',
          description: 'Email address to send to'
        },
        subject: {
          type: 'string',
          description: 'Email subject line'
        },
        body: {
          type: 'string',
          description: 'Email body content'
        }
      };
    }

    // Generic parameters for unknown tools
    return {
      input: {
        type: 'string',
        description: 'Input parameter for the tool'
      }
    };
  }

  /**
   * Format tool result for LLM consumption
   */
  static formatToolResultForLLM(result: ToolResult): string {
    if (result.success) {
      if (typeof result.data === 'string') {
        return result.data;
      }
      return JSON.stringify(result.data);
    } else {
      return `Error: ${result.error}`;
    }
  }

  /**
   * Create a tool execution context from conversation metadata
   */
  static createToolContext(
    agentId: string,
    sessionId?: string,
    userId?: string,
    metadata?: Record<string, any>
  ): ToolExecutionContext {
    return {
      agentId,
      sessionId,
      userId,
      metadata
    };
  }
}