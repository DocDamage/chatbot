/**
 * Tool Composer - Chain multiple tools together
 * Research: Latest Agentic AI papers, Tool Composition
 */

import { ToolCall, ToolResult } from '../../types/tools';
import { FunctionCaller } from './FunctionCaller';
import { logger } from '../observability/logger';

export interface ToolChain {
  calls: ToolCall[];
  dependencies: Map<number, number[]>; // call index -> depends on indices
}

export class ToolComposer {
  private functionCaller: FunctionCaller;

  constructor(functionCaller: FunctionCaller) {
    this.functionCaller = functionCaller;
  }

  /**
   * Execute a chain of tools with dependencies
   */
  async executeChain(chain: ToolChain): Promise<ToolResult[]> {
    const results: ToolResult[] = [];
    const executed = new Set<number>();

    // Topological sort to respect dependencies
    const executionOrder = this.topologicalSort(chain);

    for (const index of executionOrder) {
      const call = chain.calls[index];

      // Resolve dependencies - inject results from previous calls
      const resolvedParams = this.resolveDependencies(
        call.parameters,
        chain.dependencies.get(index) || [],
        results
      );

      call.parameters = resolvedParams;

      // Execute
      const result = await this.functionCaller.execute(call);
      results[index] = result;
      executed.add(index);

      // If this call failed and is critical, stop chain
      if (!result.success && this.isCritical(call)) {
        logger.warn('Critical tool failed, stopping chain', { toolId: call.toolId });
        break;
      }
    }

    logger.info('Tool chain executed', {
      total: chain.calls.length,
      executed: executed.size,
      successful: results.filter(r => r?.success).length
    });

    return results;
  }

  /**
   * Resolve parameter dependencies
   */
  private resolveDependencies(
    parameters: Record<string, any>,
    dependencies: number[],
    results: ToolResult[]
  ): Record<string, any> {
    const resolved = { ...parameters };

    for (const depIndex of dependencies) {
      const depResult = results[depIndex];
      if (depResult?.success && depResult.data) {
        // Inject dependency result into parameters
        // Format: ${depIndex} or ${depIndex}.field
        for (const [key, value] of Object.entries(resolved)) {
          if (typeof value === 'string' && value.includes(`\${${depIndex}}`)) {
            resolved[key] = value.replace(`\${${depIndex}}`, JSON.stringify(depResult.data));
          }
        }
      }
    }

    return resolved;
  }

  /**
   * Topological sort for dependency resolution
   */
  private topologicalSort(chain: ToolChain): number[] {
    const visited = new Set<number>();
    const result: number[] = [];

    const visit = (index: number) => {
      if (visited.has(index)) return;

      const deps = chain.dependencies.get(index) || [];
      for (const dep of deps) {
        visit(dep);
      }

      visited.add(index);
      result.push(index);
    };

    for (let i = 0; i < chain.calls.length; i++) {
      visit(i);
    }

    return result;
  }

  /**
   * Check if tool call is critical (chain should stop on failure)
   */
  private isCritical(call: ToolCall): boolean {
    // In production, would check tool metadata
    return false; // Default: non-critical
  }
}

