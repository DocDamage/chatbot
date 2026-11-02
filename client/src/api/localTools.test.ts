import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  detectLocalTools,
  listLocalExecutables,
  registerLocalExecutable,
  planLocalRun
} from './localTools';

describe('RT-COV-003 / RT-CLIENT-002: Local Tools API Client Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls detectLocalTools and listLocalExecutables endpoints', async () => {
    const mockDetections = {
      detections: [
        {
          toolName: 'Aseprite',
          executableName: 'aseprite.exe',
          executablePath: 'C:\\bin\\aseprite.exe',
          detected: true,
          detectionMethod: 'path' as const,
          enabled: true,
          trustLevel: 'trusted',
          approvalPolicy: 'ask_high_risk_only'
        }
      ]
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockDetections
    } as Response);

    const detected = await detectLocalTools();
    expect(detected).toEqual(mockDetections);
    expect(fetch).toHaveBeenCalledWith('/api/local-tools/detect');

    const listed = await listLocalExecutables();
    expect(listed).toEqual(mockDetections);
    expect(fetch).toHaveBeenCalledWith('/api/local-tools/executables');
  });

  it('posts manual registration and run planning requests', async () => {
    const mockRegistered = {
      executable: {
        toolName: 'Godot 4 CLI',
        executableName: 'godot4.exe',
        executablePath: 'C:\\godot\\godot.exe',
        detected: true,
        detectionMethod: 'manual' as const,
        enabled: true,
        trustLevel: 'trusted',
        approvalPolicy: 'ask_each_run'
      }
    };

    const mockPlanned = {
      runId: 'run-uuid-123',
      status: 'planned' as const,
      commandTemplate: 'godot4.exe --headless',
      resolvedCommand: ['godot4.exe', '--headless'],
      cwd: 'C:\\workspace',
      riskLevel: 'medium',
      requiresApproval: true
    };

    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockRegistered
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPlanned
      } as Response);

    const reg = await registerLocalExecutable({
      name: 'Godot 4 CLI',
      executablePath: 'C:\\godot\\godot.exe',
      enabled: true
    });
    expect(reg).toEqual(mockRegistered);

    const plan = await planLocalRun({
      executablePath: 'C:\\godot\\godot.exe',
      args: ['--headless'],
      riskLevel: 'medium'
    });
    expect(plan).toEqual(mockPlanned);
  });

  it('handles and throws errors when endpoints fail', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Local tool failure' })
    } as Response);

    await expect(detectLocalTools()).rejects.toThrow();
    await expect(listLocalExecutables()).rejects.toThrow();
    await expect(registerLocalExecutable({ name: 'fail', executablePath: 'fail' })).rejects.toThrow();
    await expect(planLocalRun({})).rejects.toThrow();
  });
});
