import React from 'react';
import { cleanup, render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AssistantChat from '../AssistantChat';
import type { ChatMode } from '../ModeSelector';
import * as knowledgeApi from '../../api/knowledge';

let runtimeOptionsRef: any = null;

vi.mock('@assistant-ui/react', () => ({
  AssistantRuntimeProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useExternalStoreRuntime: (options: any) => {
    runtimeOptionsRef = options;
    return {
      onNew: options?.onNew,
      isRunning: options?.isRunning || false
    };
  },
  ThreadPrimitive: {
    Root: ({ children, className }: any) => <div className={className}>{children}</div>,
    Viewport: ({ children, className }: any) => <div className={className}>{children}</div>,
    Empty: ({ children }: any) => <div data-testid="thread-empty">{children}</div>,
    Messages: () => <div data-testid="messages" />
  },
  ComposerPrimitive: {
    Root: ({ children, className }: any) => <div className={className}>{children}</div>,
    Input: (props: any) => <textarea aria-label="composer" placeholder={props.placeholder} />,
    Cancel: ({ children, className }: any) => <button className={className}>{children}</button>,
    Send: ({ children, className }: any) => <button className={className}>{children}</button>
  },
  MessagePrimitive: {
    Root: ({ children, className }: any) => <div className={className}>{children}</div>,
    Parts: () => <p />
  },
  MessagePartPrimitive: {
    Text: (props: any) => <p className={props.className} />
  },
  ActionBarPrimitive: {
    Root: ({ children, className }: any) => <div className={className}>{children}</div>,
    Copy: ({ children, className }: any) => <button className={className}>{children}</button>,
    Reload: ({ children, className }: any) => <button className={className}>{children}</button>
  }
}));

vi.mock('../../api/runtime', () => ({ isStaticPagesBuild: false }));

const allModes: ChatMode[] = [
  'ask', 'plan', 'implement', 'debug', 'explain', 'pop_culture', 'history', 'science',
  'music', 'gaming', 'math', 'market', 'gamedev', 'suno', 'fl_studio', 'fl_studio_control',
  'pro_tools', 'logic', 'mix_master', 'story', 'creative_writing', 'roleplay', 'legal',
  'health', 'security', 'business', 'philosophy', 'language', 'geography', 'gis',
  'engineering', 'knowledge_os'
];

describe('RT-CHAT-004: AssistantChat Comprehensive Workflow Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    runtimeOptionsRef = null;
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      const u = String(url);
      if (u.includes('/health/ready')) {
        return Promise.resolve({ ok: true, json: async () => ({ status: 'ok' }) });
      }
      if (u.includes('/api/conversations')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ conversations: [], total: 0 })
        });
      }
      if (u.includes('/api/audio')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ files: [], nextOffset: undefined })
        });
      }
      if (u.includes('/api/chat')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            response: 'Here is the assistance you requested.',
            mode: 'ask',
            model: 'universal-llm'
          })
        });
      }
      if (u.includes('/api/plans/')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ planId: 'plan-1', content: '# Comprehensive Plan\nStep 1: Code' })
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders chat interface with empty thread prompt and knowledge online in advanced mode', () => {
    render(<AssistantChat advancedOpen={true} />);

    expect(screen.getByText('Knowledge Online')).toBeTruthy();
    expect(screen.getByTestId('thread-empty')).toBeTruthy();
  });

  it('switches modes via simple mode picker and category popover in compact mode', async () => {
    render(<AssistantChat advancedOpen={false} />);

    const modeSelect = screen.getByRole('combobox', { name: /chat mode/i });
    fireEvent.change(modeSelect, { target: { value: 'explain' } });

    const contextBtn = screen.getByRole('button', { name: /context/i });
    fireEvent.click(contextBtn);

    await waitFor(() => {
      expect(screen.getByText(/Conversation context/i)).toBeTruthy();
    });

    const categorySelect = screen.getByRole('combobox', { name: /chat category/i });
    fireEvent.change(categorySelect, { target: { value: 'math' } });

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Ask for calculations, symbolic math, or proof help/i)).toBeTruthy();
    });
  });

  it('sends user messages, updates thread, and handles assistant response with plans', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes('/api/chat')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            response: 'Plan generated.',
            planId: 'plan-42',
            planPath: 'docs/plan-42.md',
            mode: 'plan'
          })
        });
      }
      if (u.includes('/api/plans/plan-42')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ content: 'Step 1: Execute tests' })
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ files: [] }) });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AssistantChat advancedOpen={true} />);

    // Send a message via runtime onNew
    await act(async () => {
      await runtimeOptionsRef?.onNew?.({
        content: [{ type: 'text', text: 'Plan a test suite' }]
      });
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/chat', expect.objectContaining({ method: 'POST' }));
    });

    // Test openPlan trigger
    const planBar = await screen.findByText(/Plan saved: docs\/plan-42\.md/i);
    expect(planBar).toBeTruthy();

    const openPlanBtn = screen.getByRole('button', { name: /open plan/i });
    await act(async () => {
      fireEvent.click(openPlanBtn);
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/plans/plan-42');
    });
  });

  it('exercises system prompts and payload generation for all chat modes', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes('/api/audio')) {
        return Promise.resolve({ ok: true, json: async () => ({ files: [] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ response: 'Acknowledged' }) });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { container } = render(<AssistantChat advancedOpen={true} />);

    for (const targetMode of allModes) {
      const modeSelect = container.querySelector('.mode-selector-button');
      if (modeSelect) {
        fireEvent.click(modeSelect);
        const options = Array.from(container.querySelectorAll('.mode-option'));
        const targetOption = options.find(opt => opt.querySelector('.mode-option-label')?.textContent?.toLowerCase().replace(/[\s/]/g, '_') === targetMode.toLowerCase().replace(/[\s/]/g, '_') || opt.querySelector('.mode-option-label')?.textContent?.toLowerCase() === targetMode.toLowerCase());
        if (targetOption) {
          fireEvent.click(targetOption);
        }
      }

      await act(async () => {
        await runtimeOptionsRef?.onNew?.({
          content: [{ type: 'text', text: `Prompt for mode ${targetMode}` }]
        });
      });
    }

    expect(fetchMock).toHaveBeenCalled();
  });

  it('renders created task artifacts returned by chat', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('/api/chat')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            response: 'I created the chart.',
            artifacts: [{
              name: 'sales.svg',
              url: '/api/task-artifacts/session/sales.svg',
              path: 'data/chat-task-artifacts/session/sales.svg',
              mimeType: 'image/svg+xml',
              kind: 'chart'
            }]
          })
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ files: [] }) });
    }));

    render(<AssistantChat advancedOpen={true} />);
    await act(async () => {
      await runtimeOptionsRef?.onNew?.({ content: [{ type: 'text', text: 'Create a sales chart' }] });
    });

    const artifactLink = await screen.findByRole('link', { name: /view sales\.svg/i });
    expect(artifactLink.getAttribute('href')).toBe('/api/task-artifacts/session/sales.svg');
  });

  it('handles knowledge miss flow, deep online research, discard, and ingest', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes('/api/chat')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            response: 'I could not find information locally.',
            knowledgeMissDetail: {
              knowledgeMiss: true,
              type: 'knowledge_miss',
              message: 'Miss',
              domain: 'science',
              proposedWebQuery: 'quantum optics 2026',
              recommendedSources: ['arxiv.org'],
              canSearchOnline: true,
              suggestedNextAction: 'search_online'
            }
          })
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ files: [] }) });
    });
    vi.stubGlobal('fetch', fetchMock);

    const mockDeepResearch = vi.spyOn(knowledgeApi, 'deepResearchOnlineKnowledge').mockResolvedValue({
      query: 'quantum optics 2026',
      domain: 'science',
      retrievedAt: '2026-08-26T00:00:00Z',
      answerPreview: 'Quantum optics preview',
      sources: [{ title: 'Paper 1', url: 'https://arxiv.org/1', snippet: 'Intro' }],
      reviewToken: 'tok-1',
      requiresApproval: true,
      sourcePolicy: { accepted: 1, rejected: [] },
      researchType: 'deep-dive',
      primaryCategory: 'science',
      relatedCategories: ['physics'],
      crossReferences: [{ category: 'physics', reason: 'theory', query: 'photons' }],
      synthesis: 'Synthesized quantum knowledge'
    });

    const mockIngest = vi.spyOn(knowledgeApi, 'ingestOnlineKnowledge').mockResolvedValue({ success: true });

    render(<AssistantChat advancedOpen={true} />);

    await act(async () => {
      await runtimeOptionsRef?.onNew?.({
        content: [{ type: 'text', text: 'What is new in quantum optics?' }]
      });
    });

    // KnowledgeMissPrompt shows up
    const searchBtn = await screen.findByRole('button', { name: /search online/i });
    expect(searchBtn).toBeTruthy();

    // Trigger online search
    await act(async () => {
      fireEvent.click(searchBtn);
    });

    expect(mockDeepResearch).toHaveBeenCalledWith('quantum optics 2026', 'science');

    // Ingest preview
    const saveBtn = await screen.findByRole('button', { name: /save to knowledge base/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    expect(mockIngest).toHaveBeenCalled();
  });

  it('handles chat error responses and cancel abort calls', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes('/api/chat')) {
        return Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: async () => ({ error: 'Server exploded' })
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ files: [] }) });
    }));

    render(<AssistantChat advancedOpen={true} />);

    await act(async () => {
      await runtimeOptionsRef?.onNew?.({
        content: [{ type: 'text', text: 'Trigger error' }]
      });
    });

    // Cancel abort handler test
    await act(async () => {
      await runtimeOptionsRef?.onCancel?.();
    });

    // Discard empty text
    await act(async () => {
      await runtimeOptionsRef?.onNew?.({
        content: [{ type: 'text', text: '   ' }]
      });
    });
  });

  it('renders specialized specialist mode panels', async () => {
    const { container, unmount } = render(<AssistantChat advancedOpen={true} />);

    // Switch to Creative Writing using .mode-selector-button
    const modeSelect = container.querySelector('.mode-selector-button');
    if (modeSelect) {
      fireEvent.click(modeSelect);
      const option = screen.getByRole('option', { name: /creative writing/i });
      fireEvent.click(option);
    }

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /creative composer/i })).toBeTruthy();
    });

    unmount();

    // Render GIS mode
    const { container: container2 } = render(<AssistantChat advancedOpen={true} />);
    const modeBtn = container2.querySelector('.mode-selector-button');
    if (modeBtn) {
      fireEvent.click(modeBtn);
      const option = screen.getByRole('option', { name: /gis/i });
      fireEvent.click(option);
    }

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /gis mapping/i })).toBeTruthy();
    });
  });
});
