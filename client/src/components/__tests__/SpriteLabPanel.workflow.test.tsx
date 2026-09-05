import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import SpriteLabPanel from '../SpriteLabPanel';
import * as spriteLabApi from '../../api/spriteLab';
import * as filesApi from '../../api/files';

describe('RT-COV-003 / RT-CLIENT-006: SpriteLabPanel Actions, Slicing, and Planning Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(filesApi, 'fetchFileTree').mockResolvedValue({
      name: '.',
      path: '.',
      type: 'directory',
      children: []
    });
  });

  afterEach(() => {
    cleanup();
  });

  const mockStatus: spriteLabApi.SpriteLabStatus = {
    backends: [
      {
        slug: 'aseprite',
        label: 'Aseprite CLI',
        available: true,
        role: 'primary',
        detail: 'System PATH'
      }
    ],
    selected: {
      slug: 'aseprite',
      label: 'Aseprite CLI',
      available: true,
      role: 'primary',
      detail: 'System PATH'
    }
  };

  it('slices sprite grid, extracts palette, and generates manifest', async () => {
    vi.spyOn(spriteLabApi, 'getSpriteLabStatus').mockResolvedValue(mockStatus);
    const sliceSpy = vi.spyOn(spriteLabApi, 'sliceSpriteGrid').mockResolvedValue({
      outputFiles: ['frame_0.png', 'frame_1.png'],
      frames: [{ frameIndex: 0, path: 'frame_0.png' }, { frameIndex: 1, path: 'frame_1.png' }]
    } as any);

    const paletteSpy = vi.spyOn(spriteLabApi, 'extractSpritePalette').mockResolvedValue({
      colors: ['#000000', '#ffffff', '#ff0000'],
      colorCount: 3
    } as any);

    const manifestSpy = vi.spyOn(spriteLabApi, 'generateSpriteManifest').mockResolvedValue({
      manifestPath: 'sprite_manifest.json',
      manifest: { name: 'hero', frames: [] }
    } as any);

    render(<SpriteLabPanel />);

    await waitFor(() => {
      expect(screen.getByText('Aseprite CLI')).toBeTruthy();
    });

    // Enter input path
    const inputField = screen.getByPlaceholderText('assets/sprites/hero.aseprite');
    fireEvent.change(inputField, { target: { value: 'sprites/hero.png' } });

    // 1. Slice grid
    const sliceButton = screen.getByRole('button', { name: 'Slice Grid' });
    fireEvent.click(sliceButton);

    await waitFor(() => {
      expect(sliceSpy).toHaveBeenCalledWith(expect.objectContaining({
        inputPath: 'sprites/hero.png',
        frameWidth: 16,
        frameHeight: 16
      }));
    });

    // 2. Extract palette
    const paletteButton = screen.getByRole('button', { name: 'Extract Palette' });
    fireEvent.click(paletteButton);

    await waitFor(() => {
      expect(paletteSpy).toHaveBeenCalledWith(expect.objectContaining({
        inputPath: 'sprites/hero.png',
        maxColors: 256
      }));
    });

    // 3. Generate manifest
    const manifestButton = screen.getByRole('button', { name: 'Generate Manifest' });
    fireEvent.click(manifestButton);

    await waitFor(() => {
      expect(manifestSpy).toHaveBeenCalledWith(expect.objectContaining({
        inputPath: 'sprites/hero.png'
      }));
    });
  });

  it('plans workflow and external runs with approval and start execution', async () => {
    vi.spyOn(spriteLabApi, 'getSpriteLabStatus').mockResolvedValue(mockStatus);
    const planSpy = vi.spyOn(spriteLabApi, 'planSpriteWorkflow').mockResolvedValue({
      workflow: 'spritesheet_export',
      inputPath: 'sprites/hero.png',
      outputTarget: 'dist/hero.png',
      selectedBackend: {
        slug: 'aseprite',
        label: 'Aseprite CLI',
        available: true,
        priority: 1,
        detectionMethod: 'path',
        trustLevel: 'trusted',
        approvalPolicy: 'ask_high_risk_only'
      },
      notes: ['Render layer', 'Export packed PNG']
    } as any);

    const planExtSpy = vi.spyOn(spriteLabApi, 'planExternalSpriteRun').mockResolvedValue({
      runId: 'ext-run-123',
      backend: 'aseprite',
      workflow: 'spritesheet_export',
      commandTemplate: 'aseprite -b hero.ase --sheet hero.png',
      resolvedCommand: ['aseprite', '-b', 'hero.ase', '--sheet', 'hero.png'],
      cwd: 'C:\\workspace',
      riskLevel: 'low',
      requiresApproval: true,
      status: 'planned'
    } as any);

    const approveSpy = vi.spyOn(spriteLabApi, 'approveLocalToolRun').mockResolvedValue({
      run: { id: 'ext-run-123', status: 'approved' }
    } as any);

    const startSpy = vi.spyOn(spriteLabApi, 'startLocalToolRun').mockResolvedValue({
      run: { id: 'ext-run-123', status: 'completed' }
    } as any);

    vi.spyOn(spriteLabApi, 'listSpriteExternalRunFiles').mockResolvedValue({
      files: [{ path: 'dist/hero.png', name: 'hero.png', size: 2048, isDirectory: false }]
    } as any);

    render(<SpriteLabPanel />);

    await waitFor(() => {
      expect(screen.getByText('Aseprite CLI')).toBeTruthy();
    });

    const inputField = screen.getByPlaceholderText('assets/sprites/hero.aseprite');
    fireEvent.change(inputField, { target: { value: 'sprites/hero.png' } });

    // Plan workflow
    const planButton = screen.getByRole('button', { name: 'Plan Workflow' });
    fireEvent.click(planButton);

    await waitFor(() => {
      expect(planSpy).toHaveBeenCalled();
    });

    // Plan external tool run
    const planExtButton = screen.getByRole('button', { name: 'Plan External CLI' });
    fireEvent.click(planExtButton);

    await waitFor(() => {
      expect(planExtSpy).toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Approve Planned CLI' })).toBeTruthy();
    });

    // Approve external run
    fireEvent.click(screen.getByRole('button', { name: 'Approve Planned CLI' }));
    await waitFor(() => {
      expect(approveSpy).toHaveBeenCalledWith('ext-run-123');
      expect(screen.getByRole('button', { name: 'Start Approved CLI' })).toBeTruthy();
    });

    // Start external run
    fireEvent.click(screen.getByRole('button', { name: 'Start Approved CLI' }));
    await waitFor(() => {
      expect(startSpy).toHaveBeenCalledWith('ext-run-123');
    });
  });
});
