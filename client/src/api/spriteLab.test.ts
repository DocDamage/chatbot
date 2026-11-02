import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  approveLocalToolRun,
  extractSpritePalette,
  generateSpriteManifest,
  getSpriteLabStatus,
  listSpriteExternalRunFiles,
  planExternalSpriteRun,
  planSpriteWorkflow,
  runExternalSpriteTool,
  sliceSpriteGrid,
  spriteExternalRunFileUrl,
  startLocalToolRun,
} from './spriteLab';

const mockFetch = (response: Partial<Response>) => {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sprite lab API client', () => {
  it('loads status and executes internal/external planning and workflows', async () => {
    const fetchMock = mockFetch({
      ok: true,
      json: async () => ({ backends: [], selected: { slug: 'aseprite', label: 'Aseprite', available: true, role: 'primary', detail: '' } }),
    });

    await getSpriteLabStatus();
    await planSpriteWorkflow({ workflow: 'spritesheet_export', inputPath: 'sprite.png', outputTarget: 'out/' });
    await sliceSpriteGrid({ inputPath: 'sheet.png', outputDir: 'frames/', frameWidth: 32, frameHeight: 32 });
    await extractSpritePalette({ inputPath: 'sheet.png', outputPath: 'pal.png', maxColors: 16 });
    await generateSpriteManifest({ inputPath: 'sheet.png', outputPath: 'manifest.json', frameWidth: 32, frameHeight: 32, animationName: 'idle' });
    await planExternalSpriteRun({ backend: 'aseprite', workflow: 'spritesheet_export', inputPath: 'hero.ase', outputTarget: 'hero.png', options: {} });
    await runExternalSpriteTool({ backend: 'aseprite', workflow: 'spritesheet_export', inputPath: 'hero.ase', outputTarget: 'hero.png', approvedByUser: true, options: {} });
    await approveLocalToolRun('run-1');
    await startLocalToolRun('run-1');

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/sprite-lab/status');
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/sprite-lab/plan', expect.objectContaining({ method: 'POST' }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/sprite-lab/internal/slice-grid', expect.objectContaining({ method: 'POST' }));
    expect(fetchMock).toHaveBeenNthCalledWith(4, '/api/sprite-lab/internal/palette', expect.objectContaining({ method: 'POST' }));
    expect(fetchMock).toHaveBeenNthCalledWith(5, '/api/sprite-lab/internal/manifest', expect.objectContaining({ method: 'POST' }));
    expect(fetchMock).toHaveBeenNthCalledWith(6, '/api/sprite-lab/external/plan', expect.objectContaining({ method: 'POST' }));
    expect(fetchMock).toHaveBeenNthCalledWith(7, '/api/sprite-lab/external/run', expect.objectContaining({ method: 'POST' }));
    expect(fetchMock).toHaveBeenNthCalledWith(8, '/api/local-tools/runs/run-1/approve', expect.objectContaining({ method: 'POST' }));
    expect(fetchMock).toHaveBeenNthCalledWith(9, '/api/local-tools/runs/run-1/start', expect.objectContaining({ method: 'POST' }));
  });

  it('delegates file listing and links to local-run helpers', async () => {
    const fetchMock = mockFetch({
      ok: true,
      json: async () => ({ files: [{ fileName: 'sheet.png' }] }),
    });

    const res = await listSpriteExternalRunFiles('run-1');
    expect(res).toEqual({ files: [{ fileName: 'sheet.png' }] });
    expect(fetchMock).toHaveBeenCalledWith('/api/local-tools/runs/run-1/files');
    expect(spriteExternalRunFileUrl('run-1', 'sheet.png')).toBe('/api/local-tools/runs/run-1/files/sheet.png');
  });

  it('handles error paths across all sprite-lab endpoints', async () => {
    mockFetch({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Sprite tool failure' }),
    });

    await expect(getSpriteLabStatus()).rejects.toThrow();
    await expect(planSpriteWorkflow({ workflow: 'frame_slice', inputPath: 'a.png' })).rejects.toThrow();
    await expect(sliceSpriteGrid({ inputPath: 'a.png', outputDir: 'd/', frameWidth: 16, frameHeight: 16 })).rejects.toThrow();
    await expect(extractSpritePalette({ inputPath: 'a.png', outputPath: 'p.png' })).rejects.toThrow();
    await expect(generateSpriteManifest({ inputPath: 'a.png', outputPath: 'm.json' })).rejects.toThrow();
    await expect(planExternalSpriteRun({ backend: 'aseprite', workflow: 'frame_slice', inputPath: 'a.ase' })).rejects.toThrow();
    await expect(runExternalSpriteTool({ backend: 'aseprite', workflow: 'frame_slice', inputPath: 'a.ase', approvedByUser: true })).rejects.toThrow();
    await expect(approveLocalToolRun('run-1')).rejects.toThrow();
    await expect(startLocalToolRun('run-1')).rejects.toThrow();
  });
});
