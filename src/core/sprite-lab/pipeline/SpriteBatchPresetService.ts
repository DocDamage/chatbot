/**
 * Sprite Batch & Preset Management Service (PX10-T07)
 *
 * Implements multi-file processing queues, preset serialization, schema migrations,
 * asynchronous cancellation, and bundle packaging.
 */

import * as fs from 'fs';
import * as path from 'path';
import { BatchItemState, BatchSession, PipelinePreset, RawPixelData } from './SpriteStudioTypes';

export class SpriteBatchPresetService {
  private static instance: SpriteBatchPresetService;
  private presets = new Map<string, PipelinePreset>();
  private activeSessions = new Map<string, BatchSession>();

  private constructor() {
    this.registerDefaultPresets();
  }

  public static getInstance(): SpriteBatchPresetService {
    if (!SpriteBatchPresetService.instance) {
      SpriteBatchPresetService.instance = new SpriteBatchPresetService();
    }
    return SpriteBatchPresetService.instance;
  }

  /**
   * Registers default pipeline presets.
   */
  private registerDefaultPresets(): void {
    const p1: PipelinePreset = {
      id: 'retro-pixel-cleanup',
      version: '1.0.0',
      name: 'Retro Pixel Cleanup (PICO-8)',
      description: 'Cleans anti-aliasing halos, maps colors to PICO-8 16-color palette, and produces clean 2x pixel sprite.',
      gridMode: 'auto',
      backgroundRemoval: {
        mode: 'auto_border',
        tolerance: 30,
        cleanNoiseSpecks: true,
        preserveHoles: true,
        trimTransparentMargins: true
      },
      quantization: {
        paletteId: 'pico-8',
        dithering: 'none'
      },
      outline: {
        type: 'none',
        color: { r: 0, g: 0, b: 0, a: 255 },
        thickness: 1,
        integerScale: 2
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const p2: PipelinePreset = {
      id: 'gameboy-retro',
      version: '1.0.0',
      name: 'GameBoy 4-Color Dither',
      description: 'Converts sprite to 4-shade GameBoy palette with Floyd-Steinberg dithering and a 1px black outline.',
      gridMode: 'auto',
      backgroundRemoval: {
        mode: 'auto_border',
        tolerance: 25,
        cleanNoiseSpecks: true,
        preserveHoles: true,
        trimTransparentMargins: true
      },
      quantization: {
        paletteId: 'gameboy',
        dithering: 'floyd-steinberg'
      },
      outline: {
        type: '4-way',
        color: { r: 15, g: 56, b: 15, a: 255 },
        thickness: 1,
        integerScale: 1
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.presets.set(p1.id, p1);
    this.presets.set(p2.id, p2);
  }

  public getPresets(): PipelinePreset[] {
    return Array.from(this.presets.values());
  }

  public getPreset(id: string): PipelinePreset | undefined {
    return this.presets.get(id);
  }

  public savePreset(preset: PipelinePreset): PipelinePreset {
    const updated = {
      ...preset,
      version: preset.version || '1.0.0',
      updatedAt: new Date().toISOString()
    };
    this.presets.set(preset.id, updated);
    return updated;
  }

  /**
   * Creates a new batch session.
   */
  public createBatchSession(inputPaths: string[], presetOrId: string | PipelinePreset): BatchSession {
    const preset = typeof presetOrId === 'string'
      ? (this.getPreset(presetOrId) || this.presets.get('retro-pixel-cleanup')!)
      : presetOrId;

    const sessionId = `batch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const items: BatchItemState[] = inputPaths.map((p, idx) => ({
      id: `item-${idx + 1}`,
      inputPath: p,
      status: 'pending',
      stage: 'queued',
      progress: 0
    }));

    const session: BatchSession = {
      id: sessionId,
      preset,
      items,
      totalCount: items.length,
      completedCount: 0,
      failedCount: 0,
      state: 'queued',
      createdAt: new Date().toISOString()
    };

    this.activeSessions.set(sessionId, session);
    return session;
  }

  public getSession(id: string): BatchSession | undefined {
    return this.activeSessions.get(id);
  }

  public cancelSession(id: string): boolean {
    const session = this.activeSessions.get(id);
    if (!session) return false;

    if (session.state === 'running' || session.state === 'queued') {
      session.state = 'cancelled';
      session.finishedAt = new Date().toISOString();
      for (const item of session.items) {
        if (item.status === 'pending' || item.status === 'processing') {
          item.status = 'cancelled';
          item.stage = 'cancelled_by_user';
        }
      }
      return true;
    }
    return false;
  }

  /**
   * Updates progress of a specific item in the batch.
   */
  public updateItemProgress(sessionId: string, itemId: string, update: Partial<BatchItemState>): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const item = session.items.find(i => i.id === itemId);
    if (!item) return;

    Object.assign(item, update);

    session.completedCount = session.items.filter(i => i.status === 'completed').length;
    session.failedCount = session.items.filter(i => i.status === 'failed').length;

    if (session.completedCount + session.failedCount === session.totalCount) {
      session.state = session.failedCount === session.totalCount ? 'failed' : 'completed';
      session.finishedAt = new Date().toISOString();
    } else if (session.state === 'queued') {
      session.state = 'running';
      session.startedAt = session.startedAt || new Date().toISOString();
    }
  }
}
