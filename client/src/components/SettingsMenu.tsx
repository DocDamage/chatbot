import React, { useEffect, useMemo, useRef, useState } from 'react';
import './SettingsMenu.css';

type Provider = 'template' | 'ollama' | 'openai' | 'huggingface' | 'openai-compatible' | 'anthropic' | 'gemini';

interface SettingsResponse {
  settings: Record<string, string>;
  secrets: Record<string, { configured: boolean; preview: string }>;
  status: {
    activeProvider: Provider;
    configured: Record<string, boolean>;
    model: string;
  };
}

const defaultSettings = {
  USE_OLLAMA: 'false',
  OLLAMA_URL: 'http://localhost:11434',
  OLLAMA_MODEL: 'llama3',
  USE_HUGGINGFACE: 'false',
  HUGGINGFACE_MODEL: 'mistralai/Mistral-7B-Instruct-v0.2',
  OPENAI_MODEL: 'gpt-4o-mini',
  LLM_PROVIDER: 'template',
  OPENAI_COMPATIBLE_PROVIDER_NAME: 'deepseek',
  OPENAI_COMPATIBLE_BASE_URL: 'https://api.deepseek.com',
  OPENAI_COMPATIBLE_MODEL: 'deepseek-chat',
  ANTHROPIC_MODEL: 'claude-3-5-sonnet-20241022',
  GEMINI_MODEL: 'gemini-1.5-flash',
  EMBEDDING_PROVIDER: 'xenova',
  EMBEDDING_MODEL: 'Xenova/all-MiniLM-L6-v2',
  EMBEDDING_USE_TRANSFORMERS: 'false',
  FL_STUDIO_MCP_COMMAND: 'fl-studio-mcp.cmd',
  FL_STUDIO_MCP_ARGS: '',
  FL_STUDIO_MCP_CWD: ''
};

const compatibleProviders = [
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    models: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-coder']
  },
  {
    id: 'moonshot',
    label: 'Kimi / Moonshot',
    baseUrl: 'https://api.moonshot.ai/v1',
    models: ['kimi-k2.6', 'kimi-latest', 'moonshot-v1-128k', 'moonshot-v1-32k', 'moonshot-v1-8k']
  },
  {
    id: 'minimax',
    label: 'MiniMax',
    baseUrl: 'https://api.minimax.io/v1',
    models: ['MiniMax-M2.7', 'MiniMax-M2.7-highspeed', 'MiniMax-M2.5', 'MiniMax-M1']
  },
  {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768']
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: ['openai/gpt-4o-mini', 'anthropic/claude-3.5-sonnet', 'deepseek/deepseek-chat', 'meta-llama/llama-3.1-70b-instruct']
  },
  {
    id: 'mistral',
    label: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    models: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest', 'open-mixtral-8x7b']
  },
  {
    id: 'together',
    label: 'Together.ai',
    baseUrl: 'https://api.together.xyz/v1',
    models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'Qwen/Qwen2.5-72B-Instruct-Turbo', 'deepseek-ai/DeepSeek-V3']
  },
  {
    id: 'cerebras',
    label: 'Cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    models: ['llama3.1-8b', 'llama3.1-70b', 'qwen-3-coder-480b']
  },
  {
    id: 'xai',
    label: 'xAI',
    baseUrl: 'https://api.x.ai/v1',
    models: ['grok-4', 'grok-3', 'grok-3-mini']
  },
  {
    id: 'custom',
    label: 'Custom',
    baseUrl: '',
    models: ['']
  }
];

const SettingsMenu: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<Provider>('template');
  const [settings, setSettings] = useState<Record<string, string>>(defaultSettings);
  const [openAiKey, setOpenAiKey] = useState('');
  const [huggingFaceKey, setHuggingFaceKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [secretPreview, setSecretPreview] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const providerLabel = useMemo(() => {
    switch (provider) {
      case 'ollama': return 'Ollama';
      case 'openai': return 'OpenAI';
      case 'huggingface': return 'Hugging Face';
      case 'anthropic': return 'Anthropic Claude';
      case 'gemini': return 'Google Gemini';
      case 'openai-compatible': {
        const selected = compatibleProviders.find(item => item.id === settings.OPENAI_COMPATIBLE_PROVIDER_NAME);
        return selected?.label || 'OpenAI-compatible';
      }
      default: return 'Local fallback';
    }
  }, [provider, settings.OPENAI_COMPATIBLE_PROVIDER_NAME]);

  const selectedCompatibleProvider = compatibleProviders.find(item => item.id === settings.OPENAI_COMPATIBLE_PROVIDER_NAME) || compatibleProviders[0];

  useEffect(() => {
    if (open) {
      restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      loadSettings();
      requestAnimationFrame(() => closeRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      restoreFocusRef.current?.focus();
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const loadSettings = async () => {
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/settings');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data: SettingsResponse = await response.json();
      setSettings({ ...defaultSettings, ...data.settings });
      setProvider(data.status.activeProvider);
      setSecretPreview({
        OPENAI_API_KEY: data.secrets.OPENAI_API_KEY?.preview || '',
        HUGGINGFACE_API_KEY: data.secrets.HUGGINGFACE_API_KEY?.preview || '',
        OPENAI_COMPATIBLE_API_KEY: data.secrets.OPENAI_COMPATIBLE_API_KEY?.preview || '',
        ANTHROPIC_API_KEY: data.secrets.ANTHROPIC_API_KEY?.preview || '',
        GEMINI_API_KEY: data.secrets.GEMINI_API_KEY?.preview || ''
      });
    } catch (error: any) {
      setMessage(`Could not load settings: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveSettings = async () => {
    setSaving(true);
    setMessage('');

    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          ...settings,
          OPENAI_API_KEY: openAiKey,
          HUGGINGFACE_API_KEY: huggingFaceKey,
          OPENAI_COMPATIBLE_API_KEY: settings.OPENAI_COMPATIBLE_API_KEY || '',
          ANTHROPIC_API_KEY: anthropicKey,
          GEMINI_API_KEY: geminiKey
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);

      setOpenAiKey('');
      setHuggingFaceKey('');
      setAnthropicKey('');
      setGeminiKey('');
      setMessage(`Saved. Active provider: ${data.status?.activeProvider || provider}.`);
      await loadSettings();
    } catch (error: any) {
      setMessage(`Save failed: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const selectCompatibleProvider = (id: string) => {
    const selected = compatibleProviders.find(item => item.id === id) || compatibleProviders[0];
    setProvider('openai-compatible');
    setSettings(prev => ({
      ...prev,
      OPENAI_COMPATIBLE_PROVIDER_NAME: selected.id,
      OPENAI_COMPATIBLE_BASE_URL: selected.baseUrl,
      OPENAI_COMPATIBLE_MODEL: selected.models[0] || ''
    }));
  };

  return (
    <>
      <button ref={triggerRef} className="settings-button" type="button" onClick={() => setOpen(true)} aria-label="Open settings">
        ⚙
      </button>

      {open && (
        <div className="settings-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
          <section ref={dialogRef} className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={event => event.stopPropagation()}>
            <div className="settings-header">
              <div>
                <h2 id="settings-title">Settings</h2>
                <p>Active provider: {providerLabel}</p>
              </div>
              <button ref={closeRef} className="settings-close" type="button" onClick={() => setOpen(false)} aria-label="Close settings">×</button>
            </div>

            {loading ? (
              <div className="settings-loading">Loading settings...</div>
            ) : (
              <div className="settings-body">
                <div className="settings-section">
                  <h3>Model Provider</h3>
                  <div className="provider-grid" role="radiogroup" aria-label="Model provider">
                    {[
                      ['template', 'Local fallback'],
                      ['ollama', 'Ollama'],
                      ['openai', 'OpenAI'],
                      ['anthropic', 'Claude'],
                      ['gemini', 'Gemini'],
                      ['huggingface', 'Hugging Face'],
                      ['openai-compatible', 'More models']
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        className={`provider-option ${provider === value ? 'selected' : ''}`}
                        onClick={() => setProvider(value as Provider)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {provider === 'ollama' && (
                  <div className="settings-section settings-grid">
                    <label>
                      Ollama URL
                      <input value={settings.OLLAMA_URL || ''} onChange={event => updateSetting('OLLAMA_URL', event.target.value)} />
                    </label>
                    <label>
                      Ollama model
                      <input value={settings.OLLAMA_MODEL || ''} onChange={event => updateSetting('OLLAMA_MODEL', event.target.value)} placeholder="llama3" />
                    </label>
                  </div>
                )}

                {provider === 'openai' && (
                  <div className="settings-section settings-grid">
                    <label>
                      OpenAI API key
                      <input type="password" value={openAiKey} onChange={event => setOpenAiKey(event.target.value)} placeholder={secretPreview.OPENAI_API_KEY || 'Paste API key'} />
                    </label>
                    <label>
                      OpenAI model
                      <input value={settings.OPENAI_MODEL || ''} onChange={event => updateSetting('OPENAI_MODEL', event.target.value)} placeholder="gpt-4o-mini" />
                    </label>
                  </div>
                )}

                {provider === 'huggingface' && (
                  <div className="settings-section settings-grid">
                    <label>
                      Hugging Face API key
                      <input type="password" value={huggingFaceKey} onChange={event => setHuggingFaceKey(event.target.value)} placeholder={secretPreview.HUGGINGFACE_API_KEY || 'Paste API key'} />
                    </label>
                    <label>
                      Hugging Face model
                      <input value={settings.HUGGINGFACE_MODEL || ''} onChange={event => updateSetting('HUGGINGFACE_MODEL', event.target.value)} />
                    </label>
                  </div>
                )}

                {provider === 'anthropic' && (
                  <div className="settings-section settings-grid">
                    <label>
                      Anthropic API key
                      <input type="password" value={anthropicKey} onChange={event => setAnthropicKey(event.target.value)} placeholder={secretPreview.ANTHROPIC_API_KEY || 'Paste API key'} />
                    </label>
                    <label>
                      Claude model
                      <input
                        list="claude-models"
                        value={settings.ANTHROPIC_MODEL || ''}
                        onChange={event => updateSetting('ANTHROPIC_MODEL', event.target.value)}
                      />
                      <datalist id="claude-models">
                        <option value="claude-3-5-sonnet-20241022" />
                        <option value="claude-3-5-haiku-20241022" />
                        <option value="claude-3-opus-20240229" />
                        <option value="claude-3-sonnet-20240229" />
                      </datalist>
                    </label>
                  </div>
                )}

                {provider === 'gemini' && (
                  <div className="settings-section settings-grid">
                    <label>
                      Gemini API key
                      <input type="password" value={geminiKey} onChange={event => setGeminiKey(event.target.value)} placeholder={secretPreview.GEMINI_API_KEY || 'Paste API key'} />
                    </label>
                    <label>
                      Gemini model
                      <input
                        list="gemini-models"
                        value={settings.GEMINI_MODEL || ''}
                        onChange={event => updateSetting('GEMINI_MODEL', event.target.value)}
                      />
                      <datalist id="gemini-models">
                        <option value="gemini-1.5-flash" />
                        <option value="gemini-1.5-pro" />
                        <option value="gemini-2.0-flash-exp" />
                        <option value="gemini-2.5-flash" />
                        <option value="gemini-2.5-pro" />
                      </datalist>
                    </label>
                  </div>
                )}

                {provider === 'openai-compatible' && (
                  <div className="settings-section">
                    <h3>OpenAI-Compatible Providers</h3>
                    <div className="compatible-grid">
                      {compatibleProviders.map(item => (
                        <button
                          key={item.id}
                          type="button"
                          className={`compatible-option ${settings.OPENAI_COMPATIBLE_PROVIDER_NAME === item.id ? 'selected' : ''}`}
                          onClick={() => selectCompatibleProvider(item.id)}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                    <div className="settings-grid">
                      <label>
                        API key
                        <input
                          type="password"
                          value={settings.OPENAI_COMPATIBLE_API_KEY || ''}
                          onChange={event => updateSetting('OPENAI_COMPATIBLE_API_KEY', event.target.value)}
                          placeholder={secretPreview.OPENAI_COMPATIBLE_API_KEY || 'Paste provider API key'}
                        />
                      </label>
                      <label>
                        Model
                        <input
                          list="compatible-models"
                          value={settings.OPENAI_COMPATIBLE_MODEL || ''}
                          onChange={event => updateSetting('OPENAI_COMPATIBLE_MODEL', event.target.value)}
                        />
                        <datalist id="compatible-models">
                          {selectedCompatibleProvider.models.map(model => <option key={model} value={model} />)}
                        </datalist>
                      </label>
                      <label>
                        Base URL
                        <input
                          value={settings.OPENAI_COMPATIBLE_BASE_URL || ''}
                          onChange={event => updateSetting('OPENAI_COMPATIBLE_BASE_URL', event.target.value)}
                          placeholder="https://api.example.com/v1"
                        />
                      </label>
                      <label>
                        Provider name
                        <input
                          value={settings.OPENAI_COMPATIBLE_PROVIDER_NAME || ''}
                          onChange={event => updateSetting('OPENAI_COMPATIBLE_PROVIDER_NAME', event.target.value)}
                        />
                      </label>
                    </div>
                  </div>
                )}

                <div className="settings-section settings-grid">
                  <label>
                    Embedding provider
                    <select value={settings.EMBEDDING_PROVIDER || 'xenova'} onChange={event => updateSetting('EMBEDDING_PROVIDER', event.target.value)}>
                      <option value="xenova">Local deterministic</option>
                      <option value="ollama">Ollama</option>
                      <option value="openai">OpenAI</option>
                    </select>
                  </label>
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={settings.EMBEDDING_USE_TRANSFORMERS === 'true'}
                      onChange={event => updateSetting('EMBEDDING_USE_TRANSFORMERS', event.target.checked ? 'true' : 'false')}
                    />
                    Use native Transformers.js
                  </label>
                </div>

                <div className="settings-section settings-grid">
                  <h3>FL Studio MCP Bridge (dry-run first)</h3>
                  <p className="settings-help">
                    These settings configure the optional MCP bridge launch command. Control actions remain dry-run unless the bridge is connected and a live-capable mode passes confirmation checks.
                  </p>
                  <label>
                    MCP command
                    <input value={settings.FL_STUDIO_MCP_COMMAND || ''} onChange={event => updateSetting('FL_STUDIO_MCP_COMMAND', event.target.value)} placeholder="fl-studio-mcp.cmd" />
                  </label>
                  <label>
                    MCP arguments
                    <input value={settings.FL_STUDIO_MCP_ARGS || ''} onChange={event => updateSetting('FL_STUDIO_MCP_ARGS', event.target.value)} placeholder="Optional command arguments" />
                  </label>
                  <label>
                    MCP working directory
                    <input value={settings.FL_STUDIO_MCP_CWD || ''} onChange={event => updateSetting('FL_STUDIO_MCP_CWD', event.target.value)} placeholder="Optional path to bridge repo" />
                  </label>
                </div>
              </div>
            )}

            {message && <div className={`settings-message ${message.startsWith('Save failed') || message.startsWith('Could not') ? 'error' : 'success'}`}>{message}</div>}

            <div className="settings-actions">
              <button type="button" className="secondary-action" onClick={loadSettings} disabled={loading || saving}>Refresh</button>
              <button type="button" className="primary-action" onClick={saveSettings} disabled={loading || saving}>
                {saving ? 'Saving...' : 'Save settings'}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
};

export default SettingsMenu;
