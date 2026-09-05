import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createGamingPlaybook, runLatticeSimulation } from './gaming';

describe('RT-COV-003 / RT-CLIENT-001: Gaming API Client Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('posts playbook generation request and returns structured playbook result', async () => {
    const mockResult = {
      kind: 'engine_selection' as const,
      title: 'Godot 4 vs Unity Architecture',
      assumptions: ['2D Pixel Art RPG'],
      recommendations: ['Use Godot 4 TileMapLayer'],
      checklist: ['Setup project.godot', 'Configure pixel snap'],
      risks: ['Physics interpolation with custom tick'],
      followUpQuestions: ['Targeting Steam or Mobile?']
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResult
    } as Response);

    const res = await createGamingPlaybook({
      kind: 'engine_selection',
      goal: 'Build a top-down pixel RPG',
      engine: 'godot',
      genre: 'rpg',
      targetPlatform: 'desktop'
    });

    expect(res).toEqual(mockResult);
    expect(fetch).toHaveBeenCalledWith('/api/gaming/playbook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'engine_selection',
        goal: 'Build a top-down pixel RPG',
        engine: 'godot',
        genre: 'rpg',
        targetPlatform: 'desktop'
      })
    });
  });

  it('throws structured api error on server failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid playbook request' })
    } as Response);

    await expect(createGamingPlaybook({
      kind: 'engine_selection',
      goal: ''
    })).rejects.toThrow();
  });

  it('runs a bounded deterministic Lattice simulation', async () => {
    const mockResult = {
      scenario: { id: 'scenario-1', title: 'Dungeon', world: { seed: 42, dimensions: { width: 8, height: 8 } } },
      asciiMap: '########',
      entityTable: '| Hero |',
      svgPreview: '<svg></svg>',
      simulation: { won: true, totalTicks: 50, seed: 42 },
      recommendations: ['Deterministic replay verified.']
    };
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => mockResult } as Response);

    await expect(runLatticeSimulation({ seed: 42 })).resolves.toEqual(mockResult);
    expect(fetch).toHaveBeenCalledWith('/api/gaming/lattice', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ seed: 42 })
    }));
  });
});
