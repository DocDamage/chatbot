/**
 * Function Caller - Execute tool functions
 * Research: Latest Agentic AI papers, OpenAI Function Calling
 */

import { Tool, ToolCall, ToolResult } from '../../types/tools';
import { ToolRegistry } from './ToolRegistry';
import { logger } from '../observability/logger';

export class FunctionCaller {
  private registry: ToolRegistry;
  private executionHistory: ToolCall[] = [];

  constructor(registry: ToolRegistry) {
    this.registry = registry;
  }

  /**
   * Execute a tool call
   */
  async execute(call: ToolCall): Promise<ToolResult> {
    const startTime = Date.now();
    const tool = this.registry.get(call.toolId);

    if (!tool) {
      const error = `Tool not found: ${call.toolId}`;
      logger.error(error);
      return {
        success: false,
        error
      };
    }

    try {
      // Validate parameters
      const validation = this.validateParameters(tool, call.parameters);
      if (!validation.valid) {
        return {
          success: false,
          error: `Parameter validation failed: ${validation.error}`
        };
      }

      // Execute tool
      logger.info('Executing tool', { toolId: call.toolId, toolName: tool.name });
      const result = await tool.execute(call.parameters);

      // Add metadata
      result.metadata = {
        executionTime: Date.now() - startTime,
        ...result.metadata
      };

      // Store in history
      call.result = result;
      this.executionHistory.push(call);

      logger.info('Tool execution completed', {
        toolId: call.toolId,
        success: result.success,
        executionTime: result.metadata?.executionTime
      });

      return result;
    } catch (error: any) {
      logger.error('Tool execution failed', {
        toolId: call.toolId,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Execute multiple tool calls in parallel
   */
  async executeParallel(calls: ToolCall[]): Promise<ToolResult[]> {
    return Promise.all(calls.map(call => this.execute(call)));
  }

  /**
   * Validate tool parameters
   */
  private validateParameters(tool: Tool, parameters: Record<string, any>): {
    valid: boolean;
    error?: string;
  } {
    // Check required parameters
    for (const param of tool.parameters) {
      if (param.required && !(param.name in parameters)) {
        return {
          valid: false,
          error: `Missing required parameter: ${param.name}`
        };
      }

      // Type checking
      if (param.name in parameters) {
        const value = parameters[param.name];
        const typeCheck = this.checkType(value, param.type);
        if (!typeCheck.valid) {
          return {
            valid: false,
            error: `Invalid type for ${param.name}: expected ${param.type}, got ${typeCheck.actualType}`
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Check if value matches expected type
   */
  private checkType(value: any, expectedType: string): {
    valid: boolean;
    actualType?: string;
  } {
    const actualType = typeof value;

    if (expectedType === 'array' && Array.isArray(value)) return { valid: true };
    if (expectedType === 'object' && !Array.isArray(value) && actualType === 'object' && value !== null) {
      return { valid: true };
    }
    if (expectedType === actualType) return { valid: true };

    return {
      valid: false,
      actualType: Array.isArray(value) ? 'array' : actualType
    };
  }

  /**
   * Get execution history
   */
  getHistory(limit: number = 100): ToolCall[] {
    return this.executionHistory.slice(-limit);
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.executionHistory = [];
    logger.debug('Execution history cleared');
  }
}

