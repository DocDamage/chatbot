/**
 * Tool Registry - Tool management and discovery
 * Research: Latest Agentic AI papers, OpenAI Function Calling
 */

import { Tool, ToolCategory } from '../../types/tools';
import { logger } from '../observability/logger';

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();
  private toolsByCategory: Map<ToolCategory, Tool[]> = new Map();

  constructor() {
    // Initialize categories
    for (const category of Object.values(ToolCategory)) {
      this.toolsByCategory.set(category, []);
    }
  }

  /**
   * Register a tool
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.id)) {
      logger.warn('Tool already registered', { toolId: tool.id });
      return;
    }

    this.tools.set(tool.id, tool);
    
    const categoryTools = this.toolsByCategory.get(tool.category) || [];
    categoryTools.push(tool);
    this.toolsByCategory.set(tool.category, categoryTools);

    logger.info('Tool registered', { toolId: tool.id, name: tool.name, category: tool.category });
  }

  /**
   * Get tool by ID
   */
  get(toolId: string): Tool | undefined {
    return this.tools.get(toolId);
  }

  /**
   * Get all tools
   */
  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by category
   */
  getByCategory(category: ToolCategory): Tool[] {
    return this.toolsByCategory.get(category) || [];
  }

  /**
   * Search tools by name or description
   */
  search(query: string): Tool[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.tools.values()).filter(tool =>
      tool.name.toLowerCase().includes(lowerQuery) ||
      tool.description.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get tools as function definitions for LLM
   */
  getFunctionDefinitions(): Array<{
    name: string;
    description: string;
    parameters: any;
  }> {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: tool.parameters.reduce((props, param) => {
          props[param.name] = {
            type: param.type,
            description: param.description
          };
          return props;
        }, {} as Record<string, any>),
        required: tool.parameters.filter(p => p.required).map(p => p.name)
      }
    }));
  }

  /**
   * Unregister a tool
   */
  unregister(toolId: string): boolean {
    const tool = this.tools.get(toolId);
    if (!tool) return false;

    this.tools.delete(toolId);
    const categoryTools = this.toolsByCategory.get(tool.category) || [];
    const index = categoryTools.findIndex(t => t.id === toolId);
    if (index >= 0) {
      categoryTools.splice(index, 1);
      this.toolsByCategory.set(tool.category, categoryTools);
    }

    logger.info('Tool unregistered', { toolId });
    return true;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalTools: this.tools.size,
      byCategory: Object.fromEntries(
        Array.from(this.toolsByCategory.entries()).map(([cat, tools]) => [cat, tools.length])
      )
    };
  }
}

