/**
 * Tool Manager
 * 
 * Platform-agnostic tool execution without complex business logic.
 * Tools are pre-configured and provided by the platform backend.
 */

import type { Tool, ToolResult, ToolExecutionContext } from '../types';

export interface ToolCall {
  toolId: string;
  parameters: Record<string, any>;
  reasoning?: string;
}

/**
 * Tool manager that executes tools provided by the backend
 */
export class ToolManager {
  private tools: Map<string, Tool> = new Map();
  private agentId: string;

  constructor(agentId: string) {
    this.agentId = agentId;
  }

  /**
   * Initialize with tools provided by the platform backend
   */
  initializeTools(tools: Tool[]): void {
    this.tools.clear();
    
    for (const tool of tools) {
      this.tools.set(tool.id, tool);
      console.log(`[ToolManager] Registered tool: ${tool.id} (${tool.name})`);
    }
    
    console.log(`[ToolManager] Initialized with ${tools.length} tools`);
  }

  /**
   * Check if a tool is available
   */
  hasTool(toolId: string): boolean {
    return this.tools.has(toolId);
  }

  /**
   * Get available tool IDs
   */
  getAvailableToolIds(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get tool information
   */
  getToolInfo(toolId: string): { id: string; name: string; description: string } | undefined {
    const tool = this.tools.get(toolId);
    if (!tool) return undefined;
    
    return {
      id: tool.id,
      name: tool.name,
      description: tool.description
    };
  }

  /**
   * Execute a specific tool
   */
  async executeTool(toolId: string, parameters: Record<string, any>, context?: Record<string, any>): Promise<ToolResult> {
    try {
      const tool = this.tools.get(toolId);
      
      if (!tool) {
        return {
          success: false,
          error: `Tool '${toolId}' not found. Available tools: ${this.getAvailableToolIds().join(', ')}`,
          metadata: { availableTools: this.getAvailableToolIds() }
        };
      }

      // Build execution context
      const executionContext: ToolExecutionContext = {
        agentId: this.agentId,
        sessionId: context?.sessionId,
        userId: context?.userId,
        metadata: context
      };

      console.log(`[ToolManager] Executing tool '${toolId}' with params:`, parameters);
      
      const result = await tool.execute(parameters, executionContext);
      
      console.log(`[ToolManager] Tool '${toolId}' result:`, {
        success: result.success,
        hasData: !!result.data,
        error: result.error
      });

      return result;

    } catch (error) {
      console.error(`[ToolManager] Tool execution failed for '${toolId}':`, error);
      return {
        success: false,
        error: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: { toolId, parameters }
      };
    }
  }

  /**
   * Detect and execute tool calls in LLM response
   * Simple pattern matching: [TOOL:tool_id:{"param":"value"}]
   */
  async detectAndExecuteTools(llmResponse: string, context?: Record<string, any>): Promise<{
    originalResponse: string;
    toolCalls: ToolCall[];
    toolResults: ToolResult[];
    enhancedResponse: string;
  }> {
    const toolCalls: ToolCall[] = [];
    const toolResults: ToolResult[] = [];
    let enhancedResponse = llmResponse;

    try {
      // Pattern: [TOOL:tool_id:{"param":"value"}]
      const toolPattern = /\[TOOL:([^:]+):(\{[^}]+\})\]/g;
      let match;

      while ((match = toolPattern.exec(llmResponse)) !== null) {
        const [fullMatch, toolId, paramsJson] = match;
        
        try {
          const parameters = JSON.parse(paramsJson);
          const toolCall: ToolCall = { toolId, parameters };

          toolCalls.push(toolCall);

          // Execute the tool
          const result = await this.executeTool(toolId, parameters, context);
          toolResults.push(result);

          // Replace tool call with result in response
          if (result.success && result.data) {
            const resultText = this.formatToolResult(toolCall, result);
            enhancedResponse = enhancedResponse.replace(fullMatch, resultText);
          } else {
            enhancedResponse = enhancedResponse.replace(fullMatch, `[Tool '${toolId}' failed: ${result.error}]`);
          }

        } catch (parseError) {
          console.error(`[ToolManager] Failed to parse tool parameters:`, parseError);
          enhancedResponse = enhancedResponse.replace(fullMatch, `[Invalid tool call format for '${toolId}']`);
        }
      }

      return {
        originalResponse: llmResponse,
        toolCalls,
        toolResults,
        enhancedResponse
      };

    } catch (error) {
      console.error('[ToolManager] Tool detection failed:', error);
      return {
        originalResponse: llmResponse,
        toolCalls: [],
        toolResults: [],
        enhancedResponse: llmResponse
      };
    }
  }

  /**
   * Format tool execution result for inclusion in response
   */
  private formatToolResult(toolCall: ToolCall, result: ToolResult): string {
    if (!result.success || !result.data) {
      return `[${toolCall.toolId} failed]`;
    }

    // Simple generic formatting
    const data = result.data;
    
    // Handle common result patterns
    if (data.message) {
      return `[${toolCall.toolId}: ${data.message}]`;
    }
    
    if (data.status) {
      return `[${toolCall.toolId}: ${data.status}]`;
    }
    
    if (data.result) {
      return `[${toolCall.toolId}: ${data.result}]`;
    }

    // Fallback
    return `[${toolCall.toolId}: executed successfully]`;
  }

  /**
   * Get tool statistics
   */
  getStats(): {
    totalTools: number;
    availableTools: string[];
  } {
    return {
      totalTools: this.tools.size,
      availableTools: this.getAvailableToolIds()
    };
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.tools.clear();
    console.log('[ToolManager] Cleanup completed');
  }
}