import fs from 'fs';
import path from 'path';
import { Express, RequestHandler } from 'express';
import { auditPrivilegedRequest } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';

const ENV_PATH = path.join(process.cwd(), '.env');
const SETTINGS_KEYS = [
  'LLM_PROVIDER',
  'USE_OLLAMA',
  'OLLAMA_URL',
  'OLLAMA_MODEL',
  'USE_HUGGINGFACE',
  'HUGGINGFACE_MODEL',
  'HUGGINGFACE_API_KEY',
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
  'OPENAI_COMPATIBLE_API_KEY',
  'OPENAI_COMPATIBLE_BASE_URL',
  'OPENAI_COMPATIBLE_MODEL',
  'OPENAI_COMPATIBLE_PROVIDER_NAME',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_MODEL',
  'GEMINI_API_KEY',
  'GEMINI_MODEL',
  'EMBEDDING_PROVIDER',
  'EMBEDDING_MODEL',
  'EMBEDDING_USE_TRANSFORMERS',
  'FL_STUDIO_MCP_COMMAND',
  'FL_STUDIO_MCP_ARGS',
  'FL_STUDIO_MCP_CWD'
];

const PUBLIC_SETTINGS_KEYS = SETTINGS_KEYS.filter(key => !key.endsWith('_API_KEY'));

interface RegisterSettingsRoutesDeps {
  adminOnly: RequestHandler[];
  reinitializeServices: () => Promise<void>;
  getOrchestrator: () => any;
}

export function registerSettingsRoutes(app: Express, deps: RegisterSettingsRoutesDeps): void {
  app.get('/api/settings', deps.adminOnly, auditPrivilegedRequest('settings:read'), asyncHandler(async (_req, res) => {
    const envFile = parseEnvFile(ENV_PATH);
    const settings: Record<string, string> = {};

    for (const key of PUBLIC_SETTINGS_KEYS) {
      settings[key] = process.env[key] || envFile[key] || '';
    }

    res.json({
      settings,
      secrets: {
        OPENAI_API_KEY: secretStatus('OPENAI_API_KEY', envFile),
        HUGGINGFACE_API_KEY: secretStatus('HUGGINGFACE_API_KEY', envFile),
        OPENAI_COMPATIBLE_API_KEY: secretStatus('OPENAI_COMPATIBLE_API_KEY', envFile),
        ANTHROPIC_API_KEY: secretStatus('ANTHROPIC_API_KEY', envFile),
        GEMINI_API_KEY: secretStatus('GEMINI_API_KEY', envFile)
      },
      status: getProviderStatus(deps.getOrchestrator())
    });
  }));

  app.put('/api/settings', deps.adminOnly, auditPrivilegedRequest('settings:update'), asyncHandler(async (req, res) => {
    const body = req.body || {};
    const current = parseEnvFile(ENV_PATH);
    const updates: Record<string, string> = {};
    const selectedProvider = String(body.provider || 'template');

    for (const key of PUBLIC_SETTINGS_KEYS) {
      if (body[key] !== undefined) updates[key] = String(body[key]);
    }

    copySecret(body, current, updates, 'OPENAI_API_KEY');
    copySecret(body, current, updates, 'HUGGINGFACE_API_KEY');
    copySecret(body, current, updates, 'OPENAI_COMPATIBLE_API_KEY');
    copySecret(body, current, updates, 'ANTHROPIC_API_KEY');
    copySecret(body, current, updates, 'GEMINI_API_KEY');

    updates.USE_OLLAMA = selectedProvider === 'ollama' ? 'true' : 'false';
    updates.USE_HUGGINGFACE = selectedProvider === 'huggingface' ? 'true' : 'false';
    updates.LLM_PROVIDER = selectedProvider;

    const validationError = validateSelectedProvider(selectedProvider, updates);
    if (validationError) return res.status(400).json({ error: validationError });

    applyRuntimeSettings(updates);
    await deps.reinitializeServices();

    res.json({
      success: true,
      persisted: false,
      message: 'Settings were applied to this running process. Update your secret store or deployment environment to persist changes.',
      status: getProviderStatus(deps.getOrchestrator())
    });
  }));
}

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};

  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce<Record<string, string>>((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return acc;

      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex === -1) return acc;

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();
      acc[key] = value.replace(/^["']|["']$/g, '');
      return acc;
    }, {});
}

function maskSecret(value?: string): string {
  if (!value) return '';
  if (value.length <= 8) return '********';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function secretStatus(key: string, envFile: Record<string, string>) {
  const value = process.env[key] || envFile[key];
  return {
    configured: !!value,
    preview: maskSecret(value)
  };
}

function copySecret(
  body: Record<string, any>,
  current: Record<string, string>,
  updates: Record<string, string>,
  key: string
): void {
  if (body[key] !== undefined && String(body[key]).trim()) {
    updates[key] = String(body[key]).trim();
  } else if (current[key]) {
    updates[key] = current[key];
  }
}

function applyRuntimeSettings(updates: Record<string, string>): void {
  for (const [key, value] of Object.entries(updates)) {
    if (SETTINGS_KEYS.includes(key)) process.env[key] = value;
  }
}

function validateSelectedProvider(selectedProvider: string, updates: Record<string, string>): string | undefined {
  if (selectedProvider === 'openai' && !updates.OPENAI_API_KEY && !process.env.OPENAI_API_KEY) {
    return 'OPENAI_API_KEY is required when OpenAI is selected';
  }
  if (selectedProvider === 'openai-compatible' && !updates.OPENAI_COMPATIBLE_API_KEY && !process.env.OPENAI_COMPATIBLE_API_KEY) {
    return 'An API key is required for this provider';
  }
  if (selectedProvider === 'openai-compatible' && !updates.OPENAI_COMPATIBLE_BASE_URL) {
    return 'A base URL is required for this provider';
  }
  if (selectedProvider === 'anthropic' && !updates.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    return 'ANTHROPIC_API_KEY is required when Claude is selected';
  }
  if (selectedProvider === 'gemini' && !updates.GEMINI_API_KEY && !process.env.GEMINI_API_KEY) {
    return 'GEMINI_API_KEY is required when Gemini is selected';
  }
  if (selectedProvider === 'huggingface' && !updates.HUGGINGFACE_API_KEY && !process.env.HUGGINGFACE_API_KEY) {
    return 'HUGGINGFACE_API_KEY is required when Hugging Face is selected';
  }
  return undefined;
}

function getProviderStatus(orchestrator: any) {
  const configured = {
    ollama: process.env.USE_OLLAMA !== 'false',
    huggingface: process.env.USE_HUGGINGFACE === 'true' && !!process.env.HUGGINGFACE_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    openaiCompatible: !!process.env.OPENAI_COMPATIBLE_API_KEY && !!process.env.OPENAI_COMPATIBLE_BASE_URL,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
    transformers: process.env.EMBEDDING_USE_TRANSFORMERS === 'true'
  };

  const selectedProvider = process.env.LLM_PROVIDER || 'template';
  const activeProvider = selectedProvider === 'openai-compatible' && configured.openaiCompatible
    ? 'openai-compatible'
    : selectedProvider === 'openai' && configured.openai
      ? 'openai'
      : selectedProvider === 'anthropic' && configured.anthropic
        ? 'anthropic'
        : selectedProvider === 'gemini' && configured.gemini
          ? 'gemini'
          : selectedProvider === 'huggingface' && configured.huggingface
            ? 'huggingface'
            : selectedProvider === 'ollama' && configured.ollama
              ? 'ollama'
              : 'template';

  return {
    activeProvider,
    configured,
    model: orchestrator ? 'ready' : 'initializing'
  };
}
