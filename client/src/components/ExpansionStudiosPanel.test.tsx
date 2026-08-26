import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ExpansionStudiosPanel from './ExpansionStudiosPanel';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ExpansionStudiosPanel', () => {
  it('exposes every added studio and runs writing and study workflows', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ ok: true, path: String(input) }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }));
    const user = userEvent.setup();
    localStorage.setItem('token', 'local-test-token');
    render(<ExpansionStudiosPanel initialCapabilityId="writing_studio" />);

    for (const name of ['Context Economy', 'Agent Operations', 'Game Studio', 'Sprite Studio', 'Music Studio', 'Media Accessibility', 'Writing Studio', 'Study Studio']) {
      expect(screen.getByRole('tab', { name })).toBeTruthy();
    }

    const content = screen.getByLabelText('Content');
    await user.type(content, 'A locally reviewed document.');
    await user.clear(screen.getByLabelText('Title or agent name'));
    await user.type(screen.getByLabelText('Title or agent name'), 'Reviewed draft');
    await user.click(screen.getByRole('button', { name: 'Open document' }));
    await waitFor(() => expect(calls).toContain('/api/writing-studio/documents/open'));
    await user.click(screen.getByRole('button', { name: 'Proofread' }));
    await waitFor(() => expect(calls).toContain('/api/writing-studio/proofread'));
    await user.click(screen.getByRole('button', { name: 'Save snapshot' }));
    await waitFor(() => expect(calls).toContain('/api/writing-studio/save'));

    await user.click(screen.getByRole('tab', { name: 'Study Studio' }));
    await user.clear(screen.getByLabelText('Project or subject'));
    await user.type(screen.getByLabelText('Project or subject'), 'Evidence-based testing');
    await user.click(screen.getByRole('button', { name: 'Create collection' }));
    await waitFor(() => expect(calls).toContain('/api/study-studio/collections'));
    await user.click(screen.getByRole('button', { name: 'Add source' }));
    await waitFor(() => expect(calls).toContain('/api/study-studio/sources'));
    for (const [button, path] of [
      ['Generate notes', '/api/study-studio/notes'],
      ['Flashcards', '/api/study-studio/flashcards/generate'],
      ['Quiz', '/api/study-studio/quizzes/generate'],
      ['Study plan', '/api/study-studio/plan']
    ]) {
      await user.click(screen.getByRole('button', { name: button }));
      await waitFor(() => expect(calls).toContain(path));
    }

    await user.click(screen.getByRole('button', { name: 'Refresh status' }));
    await waitFor(() => expect(calls).toContain('/api/study-studio/state'));

    await user.click(screen.getByRole('tab', { name: 'Context Economy' }));
    await user.click(screen.getByRole('button', { name: 'Compress context' }));
    await waitFor(() => expect(calls).toContain('/api/context-economy/compress'));

    await user.click(screen.getByRole('tab', { name: 'Agent Operations' }));
    await user.click(screen.getByRole('button', { name: 'Register read-only session' }));
    await waitFor(() => expect(calls).toContain('/api/agent-operations/sessions'));

    for (const [tab, path] of [
      ['Game Studio', '/api/game-studio/summary'],
      ['Sprite Studio', '/api/sprite-studio/presets'],
      ['Music Studio', '/api/music-studio/hardware-probe'],
      ['Media Accessibility', '/api/media-accessibility/status']
    ]) {
      await user.click(screen.getByRole('tab', { name: tab }));
      await user.click(screen.getByRole('button', { name: 'Check capability' }));
      await waitFor(() => expect(calls).toContain(path));
    }
    localStorage.removeItem('token');
  });

  it('reports guarded API failures instead of claiming success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Local worker is not configured.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    })));
    const user = userEvent.setup();
    render(<ExpansionStudiosPanel initialCapabilityId="stem_mix_lab" />);
    await user.click(screen.getByRole('button', { name: 'Check capability' }));
    expect(await screen.findByText(/Local worker is not configured/)).toBeTruthy();
    expect(screen.getByText('No result yet.')).toBeTruthy();
  });

  it('handles malformed and non-Error transport failures honestly', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('not-json', { status: 502 }))
      .mockRejectedValueOnce('offline');
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<ExpansionStudiosPanel initialCapabilityId="not-a-capability" />);
    await user.click(screen.getByRole('button', { name: 'Refresh status' }));
    expect(await screen.findByText(/HTTP 502/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Refresh status' }));
    expect(await screen.findByText(/offline/)).toBeTruthy();
  });
});
