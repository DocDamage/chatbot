import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import KnowledgeOnlinePanel from './KnowledgeOnlinePanel';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  global.fetch = vi.fn(async (url: RequestInfo | URL) => {
    const path = String(url);
    if (path.includes('/api/knowledge-online/check')) {
      return {
        ok: true,
        json: async () => ({
          answer: 'Local answer is weak.',
          confidence: 0.2,
          needsOnlineResearch: true,
          suggestedQuery: 'sprite metadata'
        })
      } as Response;
    }
    if (path.includes('/api/knowledge-online/search')) {
      return {
        ok: true,
        json: async () => ({
          query: 'sprite metadata',
          domain: 'gaming',
          retrievedAt: '2026-05-21T00:00:00.000Z',
          answerPreview: 'Online preview answer',
          sources: [{ title: 'Sprite docs', url: 'https://example.com/sprite-docs', snippet: 'Sprite metadata guide' }],
          reviewToken: 'review-1',
          requiresApproval: true,
          sourcePolicy: { accepted: 1, rejected: [] }
        })
      } as Response;
    }
    return {
      ok: true,
      json: async () => ({ ingestionId: 'ing-1', ingested: true })
    } as Response;
  });
});

describe('KnowledgeOnlinePanel', () => {
  it('checks local confidence and shows online research handoff', async () => {
    const user = userEvent.setup();
    render(<KnowledgeOnlinePanel />);

    await user.type(screen.getByPlaceholderText(/question or search query/i), 'unknown topic');
    await user.click(screen.getByRole('button', { name: /^check$/i }));

    await waitFor(() => expect(screen.getByText(/confidence: 0.20/i)).toBeTruthy());
    expect(screen.getByText(/needs online research/i)).toBeTruthy();
    expect(screen.getByText(/local answer is weak/i)).toBeTruthy();
  });

  it('searches, displays sources, and ingests preview', async () => {
    const user = userEvent.setup();
    render(<KnowledgeOnlinePanel />);

    await user.type(screen.getByPlaceholderText(/question or search query/i), 'sprite metadata');
    await user.click(screen.getByRole('button', { name: /^search$/i }));

    await waitFor(() => expect(screen.getByText(/online preview answer/i)).toBeTruthy());
    expect(screen.getByText(/sprite docs/i)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /ingest current preview/i }));

    await waitFor(() => expect(screen.getByText(/ingestion result/i)).toBeTruthy());
    expect(fetch).toHaveBeenCalledWith('/api/knowledge-online/ingest', expect.objectContaining({ method: 'POST' }));
  });
});
