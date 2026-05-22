import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SpriteLabPanel from './SpriteLabPanel';

vi.mock('./FileExplorerPanel', () => ({
  default: ({ onSelect }: any) => (
    <button type="button" onClick={() => onSelect({ path: 'assets/hero.aseprite' })}>
      Pick sprite
    </button>
  )
}));

beforeEach(() => {
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }
  });

  global.fetch = vi.fn(async (url: RequestInfo | URL) => {
    const path = String(url);
    if (path === '/api/sprite-lab/status') {
      return {
        ok: true,
        json: async () => ({
          selected: { slug: 'aseprite', label: 'Aseprite', available: true, role: 'primary', detail: 'Detected' },
          backends: [
            { slug: 'aseprite', label: 'Aseprite', available: true, role: 'primary', detail: 'Detected' },
            { slug: 'libresprite', label: 'LibreSprite', available: false, role: 'fallback', detail: 'Not found' },
            { slug: 'pixelorama', label: 'Pixelorama', available: false, role: 'fallback', detail: 'Template missing' }
          ]
        })
      } as Response;
    }
    if (path === '/api/sprite-lab/external/plan') {
      return {
        ok: true,
        json: async () => ({
          runId: 'run-1',
          status: 'planned',
          resolvedCommand: ['aseprite', '-b', 'assets/hero.aseprite', '--sheet', 'out.png'],
          adapter: {
            backend: 'aseprite',
            workflow: 'spritesheet_export',
            inputPath: 'assets/hero.aseprite',
            outputTarget: 'data/sprite-lab/hero.sheet.png',
            outputFiles: ['data/sprite-lab/hero.sheet.png', 'data/sprite-lab/hero.sheet.json'],
            notes: ['Requires approval']
          }
        })
      } as Response;
    }
    if (path === '/api/local-tools/runs/run-1/files') {
      return {
        ok: true,
        json: async () => ({
          runId: 'run-1',
          files: [{ fileName: 'stdout.txt', size: 12, modifiedTime: '2026-05-21T00:00:00.000Z', kind: 'stdout', downloadUrl: '/stdout' }]
        })
      } as Response;
    }
    if (path.endsWith('/approve') || path.endsWith('/start')) {
      return { ok: true, json: async () => ({ run: { status: 'completed' } }) } as Response;
    }
    return { ok: true, json: async () => ({}) } as Response;
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('SpriteLabPanel polish', () => {
  it('shows backend availability, expected outputs, and captured output links', async () => {
    const user = userEvent.setup();
    render(<SpriteLabPanel />);

    await waitFor(() => expect(screen.getByText('Aseprite')).toBeTruthy());
    expect(screen.getByText(/Detected and available/i)).toBeTruthy();

    await user.click(screen.getByText('Pick sprite'));
    await user.click(screen.getByRole('button', { name: /plan external cli/i }));

    await waitFor(() => expect(screen.getByText('External run')).toBeTruthy());
    expect(screen.getByText('data/sprite-lab/hero.sheet.png')).toBeTruthy();
    expect(screen.getByText('data/sprite-lab/hero.sheet.json')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /refresh output files/i }));
    await waitFor(() => expect(screen.getByText(/stdout\.txt/i)).toBeTruthy());

    await user.click(screen.getByRole('button', { name: /copy command/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('aseprite -b assets/hero.aseprite --sheet out.png');
  });
});
