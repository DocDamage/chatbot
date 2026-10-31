import fs from 'fs';
import path from 'path';
import { resolveDeploymentMode } from '../../config/EnvironmentDefinitions';
import { AppError } from '../../../utils/errors';

export class CodingToolError extends AppError {
  constructor(message: string, status = 400, code = 'CODING_TOOL_ERROR') { super(message, status, code); }
}
export interface CodingToolConfig {
  enabled: boolean; root: string; dataRoot: string; node: string; serena: string; aiderPython: string;
  astGrep: string; context7: string; ollamaUrl: string; model: string; timeoutMs: number; contextTokens: number;
}
export function codingToolConfig(root = process.cwd()): CodingToolConfig {
  const file = path.join(root, 'services/coding-tools/runtime.json');
  const runtime = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const executable = (venv: string, name: string) => path.join(root, 'data/coding-tools/runtime', venv,
    process.platform === 'win32' ? `Scripts/${name}.exe` : `bin/${name}`);
  const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
  const url = new URL(ollamaUrl);
  const enabled = process.env.CODING_TOOLS_ENABLED === 'true' && resolveDeploymentMode() !== 'hosted';
  if (enabled && (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.protocol !== 'http:' || url.username || url.password)) {
    throw new CodingToolError('Coding workers require an HTTP loopback Ollama endpoint.');
  }
  return { enabled, root,
    dataRoot: path.join(root, 'data/coding-tools/jobs'), node: runtime.node || process.execPath,
    serena: runtime.serena || executable('serena', 'serena'), aiderPython: runtime.aiderPython || executable('aider', 'python'),
    astGrep: path.join(root, 'services/coding-tools/node_modules/@ast-grep/cli', process.platform === 'win32' ? 'ast-grep.exe' : 'ast-grep'),
    context7: path.join(root, 'services/coding-tools/node_modules/@upstash/context7-mcp/dist/index.js'),
    ollamaUrl, model: process.env.CODING_OLLAMA_MODEL || process.env.OLLAMA_MODEL || 'qwen3:8b',
    timeoutMs: Number(process.env.CODING_TOOL_TIMEOUT_MS || 300000), contextTokens: Number(process.env.CODING_CONTEXT_TOKENS || 16384) };
}
