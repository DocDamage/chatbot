/**
 * Code Executor - Safe code execution sandbox
 * Research: Latest Agentic AI papers, Code Execution
 */

import { Tool, ToolResult } from '../../types/tools';
import { logger } from '../observability/logger';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export class CodeExecutor {
  private timeout: number;
  private allowedLanguages: Set<string>;

  constructor(timeout: number = 5000, allowedLanguages: string[] = ['python', 'javascript']) {
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
      let executable: string;
      let args: string[];
      switch (language) {
        case 'python':
          executable = process.platform === 'win32' ? 'python' : 'python3';
          args = ['-c', code];
          break;
        case 'javascript':
          executable = 'node';
          args = ['-e', code];
          break;
        case 'bash':
          return {
            success: false,
            error: 'Bash execution is disabled by default. Use CommandRunner for allowlisted repository commands.'
          };
        default:
          return {
            success: false,
            error: `Unsupported language: ${language}`
          };
      }

      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatbot-code-'));
      const { stdout, stderr } = await this.spawnCode(executable, args, tempDir);
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
      /import\s+sys/m,
      /eval\(/,
      /exec\(/,
      /__import__/,
      /open\(['"]\/etc\//,
      /open\(['"]\/usr\//,
      /open\(['"]\/var\//,
      /rm\s+-rf/,
      /rm\s+-r/,
      /delete\s+.*from/i,
      /DROP\s+TABLE/i,
      /TRUNCATE/i,
      /DELETE\s+FROM/i,
      /fs\./,
      /child_process/,
      /process\.exit/,
      /require\(['"]fs['"]\)/,
      /require\(['"]child_process['"]\)/
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        return {
          safe: false,
          reason: `Dangerous pattern detected: ${pattern}`
        };
      }
    }

    // Check for file system operations
    if (/\.(readFile|writeFile|unlink|rmdir|mkdir)/.test(code)) {
      return {
        safe: false,
        reason: 'File system operations not allowed'
      };
    }

    return { safe: true };
  }

  private spawnCode(executable: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let settled = false;
      const child = spawn(executable, args, {
        cwd,
        shell: false,
        windowsHide: true,
        env: {
          PATH: process.env.PATH,
          NODE_OPTIONS: process.env.NODE_OPTIONS
        }
      });

      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        if (!settled) {
          settled = true;
          reject(new Error(`Execution timed out after ${this.timeout}ms`));
        }
      }, this.timeout);

      child.stdout?.on('data', chunk => {
        stdout += chunk.toString();
      });
      child.stderr?.on('data', chunk => {
        stderr += chunk.toString();
      });
      child.on('error', error => {
        clearTimeout(timeout);
        if (!settled) {
          settled = true;
          reject(error);
        }
      });
      child.on('close', code => {
        clearTimeout(timeout);
        if (settled) return;
        settled = true;
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(stderr || `Execution exited with code ${code}`));
        }
      });
    });
  }

  /**
   * Create a code execution tool
   */
  createTool(): Tool {
    return {
      id: 'code_executor',
      name: 'execute_code',
      description: 'Execute code in a constrained temp workspace. Supports Python and JavaScript by default.',
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
          description: 'Programming language (python or javascript)',
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

