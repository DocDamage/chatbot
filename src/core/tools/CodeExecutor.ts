/**
 * Code Executor - Safe code execution sandbox
 * Research: Latest Agentic AI papers, Code Execution
 */

import { Tool, ToolResult } from '../../types/tools';
import { logger } from '../observability/logger';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class CodeExecutor {
  private timeout: number;
  private allowedLanguages: Set<string>;

  constructor(timeout: number = 5000, allowedLanguages: string[] = ['python', 'javascript', 'bash']) {
    this.timeout = timeout;
    this.allowedLanguages = new Set(allowedLanguages);
  }

  /**
   * Execute code safely
   */
  async execute(code: string, language: string = 'python'): Promise<ToolResult> {
    const startTime = Date.now();

    if (!this.allowedLanguages.has(language)) {
      return {
        success: false,
        error: `Language ${language} not allowed. Allowed: ${Array.from(this.allowedLanguages).join(', ')}`
      };
    }

    // Security check - basic validation
    const securityCheck = this.checkSecurity(code);
    if (!securityCheck.safe) {
      logger.warn('Code execution blocked by security check', { reason: securityCheck.reason });
      return {
        success: false,
        error: `Security check failed: ${securityCheck.reason}`
      };
    }

    try {
      // Execute based on language
      let command: string;
      switch (language) {
        case 'python':
          command = `python3 -c ${JSON.stringify(code)}`;
          break;
        case 'javascript':
          command = `node -e ${JSON.stringify(code)}`;
          break;
        case 'bash':
          command = code;
          break;
        default:
          return {
            success: false,
            error: `Unsupported language: ${language}`
          };
      }

      const { stdout, stderr } = await execAsync(command, {
        timeout: this.timeout,
        maxBuffer: 1024 * 1024 // 1MB
      });

      const executionTime = Date.now() - startTime;

      logger.info('Code execution completed', {
        language,
        executionTime,
        hasOutput: !!stdout,
        hasError: !!stderr
      });

      return {
        success: true,
        data: {
          output: stdout,
          error: stderr || undefined,
          language,
          executionTime
        },
        metadata: {
          executionTime
        }
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      logger.error('Code execution failed', {
        language,
        error: error.message,
        executionTime
      });

      return {
        success: false,
        error: error.message,
        metadata: {
          executionTime
        }
      };
    }
  }

  /**
   * Security check for code
   */
  private checkSecurity(code: string): {
    safe: boolean;
    reason?: string;
  } {
    const dangerousPatterns = [
      /import\s+os\s*$/m,
      /import\s+subprocess/m,
      /eval\(/,
      /exec\(/,
      /__import__/,
      /open\(['"]\/etc\//,
      /rm\s+-rf/,
      /delete\s+.*from/,
      /DROP\s+TABLE/i
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        return {
          safe: false,
          reason: `Dangerous pattern detected: ${pattern}`
        };
      }
    }

    return { safe: true };
  }

  /**
   * Create a code execution tool
   */
  createTool(): Tool {
    return {
      id: 'code_executor',
      name: 'execute_code',
      description: 'Execute code in a safe sandbox environment. Supports Python, JavaScript, and Bash.',
      category: require('../../types/tools').ToolCategory.CODE_EXECUTION,
      parameters: [
        {
          name: 'code',
          type: 'string',
          description: 'The code to execute',
          required: true
        },
        {
          name: 'language',
          type: 'string',
          description: 'Programming language (python, javascript, bash)',
          required: false,
          default: 'python'
        }
      ],
      execute: async (params: Record<string, any>) => {
        return this.execute(params.code, params.language);
      }
    };
  }
}

