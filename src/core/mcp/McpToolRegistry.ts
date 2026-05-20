export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, any>;
}

export class McpToolRegistry {
  private tools = new Map<string, McpToolDefinition>();

  register(tool: McpToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  registerMany(tools: McpToolDefinition[]): void {
    tools.forEach(tool => this.register(tool));
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): McpToolDefinition[] {
    return Array.from(this.tools.values());
  }

  search(query: string): McpToolDefinition[] {
    const text = query.toLowerCase();
    return this.list().filter(tool =>
      tool.name.toLowerCase().includes(text) ||
      (tool.description || '').toLowerCase().includes(text)
    );
  }
}
