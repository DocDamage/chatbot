/**
 * Tool Use & Function Calling Types
 */

export interface Tool {
  id: string;
  name: string;
  description: string;
  parameters: ToolParameter[];
  category: ToolCategory;
  execute: (params: Record<string, any>) => Promise<ToolResult>;
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  default?: any;
}

export enum ToolCategory {
  WEB_SEARCH = 'web_search',
  CODE_EXECUTION = 'code_execution',
  DATABASE = 'database',
  API = 'api',
  FILE_OPERATIONS = 'file_operations',
  CALCULATION = 'calculation',
  KNOWLEDGE = 'knowledge',
  CODING = 'coding',
  OTHER = 'other'
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    executionTime: number;
    tokensUsed?: number;
    cost?: number;
  };
}

export interface ToolCall {
  toolId: string;
  parameters: Record<string, any>;
  result?: ToolResult;
}

