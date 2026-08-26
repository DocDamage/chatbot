import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SettingsMenu from './SettingsMenu';

const settingsPayload = {
  settings: {
    OLLAMA_URL: 'http://localhost:11434',
    OLLAMA_MODEL: 'llama3',
    OPENAI_MODEL: 'gpt-4o-mini',
    HUGGINGFACE_MODEL: 'mistralai/Mistral-7B',
    ANTHROPIC_MODEL: 'claude-3-5-sonnet-20241022',
    GEMINI_MODEL: 'gemini-3.6-flash',
    OPENAI_COMPATIBLE_PROVIDER_NAME: 'deepseek',
    OPENAI_COMPATIBLE_BASE_URL: 'https://api.deepseek.com',
    OPENAI_COMPATIBLE_MODEL: 'deepseek-chat',
    EMBEDDING_PROVIDER: 'xenova',
    EMBEDDING_USE_TRANSFORMERS: 'false',
    FL_STUDIO_MCP_COMMAND: 'fl-studio-mcp.cmd',
    FL_STUDIO_MCP_ARGS: '',
    FL_STUDIO_MCP_CWD: ''
  },
  secrets: {
    OPENAI_API_KEY: { configured: true, preview: 'sk-...1234' },
    HUGGINGFACE_API_KEY: { configured: true, preview: 'hf_...5678' },
    OPENAI_COMPATIBLE_API_KEY: { configured: true, preview: 'sk-...9999' },
    ANTHROPIC_API_KEY: { configured: true, preview: 'sk-ant-...4321' },
    GEMINI_API_KEY: { configured: true, preview: 'AIza...0000' }
  },
  status: {
    activeProvider: 'template',
    configured: {},
    model: 'template',
  },
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('SettingsMenu accessibility and configuration', () => {
  it('focuses the dialog close button and restores focus when closed', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => settingsPayload,
    }));

    render(<SettingsMenu />);

    const opener = screen.getByRole('button', { name: /open settings/i });
    opener.focus();
    await user.click(opener);

    const dialog = screen.getByRole('dialog', { name: /settings/i });
    expect(dialog).toBeTruthy();

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: /close settings/i }));
    });

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /settings/i })).toBeNull();
      expect(document.activeElement).toBe(opener);
    });
  });

  it('keeps tab focus inside the dialog with forward and backward wrapping', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => settingsPayload,
    }));

    render(<SettingsMenu />);

    await user.click(screen.getByRole('button', { name: /open settings/i }));
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: /close settings/i }));
    });

    // Backward wrapping: Shift+Tab on first element moves to last
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /save settings/i }));

    // Forward wrapping: Tab on last element moves to first
    await user.keyboard('{Tab}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /close settings/i }));
  });

  it('configures every AI model provider and saves settings', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => settingsPayload,
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<SettingsMenu />);
    await user.click(screen.getByRole('button', { name: /open settings/i }));
    await user.click(screen.getByRole('tab', { name: /ai connection/i }));

    // 1. Ollama
    await user.click(screen.getByRole('radio', { name: 'Ollama' }));
    fireEvent.change(screen.getByLabelText(/ollama url/i), { target: { value: 'http://127.0.0.1:11434' } });
    fireEvent.change(screen.getByLabelText(/ollama model/i), { target: { value: 'mistral' } });

    // 2. OpenAI
    await user.click(screen.getByRole('radio', { name: 'OpenAI' }));
    fireEvent.change(screen.getByLabelText(/openai api key/i), { target: { value: 'sk-test' } });
    fireEvent.change(screen.getByLabelText(/openai model/i), { target: { value: 'gpt-4o' } });

    // 3. Hugging Face
    await user.click(screen.getByRole('radio', { name: 'Hugging Face' }));
    fireEvent.change(screen.getByLabelText(/hugging face api key/i), { target: { value: 'hf-test' } });
    fireEvent.change(screen.getByLabelText(/hugging face model/i), { target: { value: 'Qwen/Qwen2.5' } });

    // 4. Claude
    await user.click(screen.getByRole('radio', { name: 'Claude' }));
    fireEvent.change(screen.getByLabelText(/anthropic api key/i), { target: { value: 'sk-ant-test' } });
    fireEvent.change(screen.getByLabelText(/claude model/i), { target: { value: 'claude-3-opus-20240229' } });

    // 5. Gemini
    await user.click(screen.getByRole('radio', { name: 'Gemini' }));
    fireEvent.change(screen.getByLabelText(/gemini api key/i), { target: { value: 'AIza-test' } });
    fireEvent.change(screen.getByLabelText(/gemini model/i), { target: { value: 'gemini-2.5-pro' } });

    // 6. OpenAI-Compatible Providers
    await user.click(screen.getByRole('radio', { name: 'More models' }));
    await user.click(screen.getByRole('button', { name: 'Groq' }));
    await user.click(screen.getByRole('button', { name: 'Custom' }));
    fireEvent.change(screen.getByLabelText(/base url/i), { target: { value: 'https://my-llm.com/v1' } });
    fireEvent.change(screen.getByLabelText(/provider name/i), { target: { value: 'my-provider' } });

    // Save Settings
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: { activeProvider: 'openai-compatible' } })
    });
    await user.click(screen.getByRole('button', { name: /save settings/i }));

    await waitFor(() => {
      expect(screen.getByText(/saved\. active provider/i)).toBeTruthy();
    });
  });

  it('handles save and load failure states gracefully', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    render(<SettingsMenu />);
    await user.click(screen.getByRole('button', { name: /open settings/i }));

    await waitFor(() => {
      expect(screen.getByText(/the local service is unavailable/i)).toBeTruthy();
    });

    // Save failure
    await user.click(screen.getByRole('button', { name: /save settings/i }));
    await waitFor(() => {
      expect(screen.getByText(/settings could not be saved/i)).toBeTruthy();
    });
  });

  it('toggles advanced workspace button and closes on backdrop click', async () => {
    const user = userEvent.setup();
    const onAdvancedToggle = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => settingsPayload,
    }));

    render(<SettingsMenu advancedOpen={false} onAdvancedToggle={onAdvancedToggle} />);
    await user.click(screen.getByRole('button', { name: /open settings/i }));

    // Click workspace toggle button
    await user.click(screen.getByRole('button', { name: /open advanced workspace/i }));
    expect(onAdvancedToggle).toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: /settings/i })).toBeNull();

    // Reopen and close via backdrop click
    await user.click(screen.getByRole('button', { name: /open settings/i }));
    const backdrop = document.querySelector('.settings-backdrop');
    if (backdrop) fireEvent.mouseDown(backdrop);
    expect(screen.queryByRole('dialog', { name: /settings/i })).toBeNull();
  });
});
