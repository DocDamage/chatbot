/**
 * Godot Profiler & Performance Monitor (PX08-T08)
 *
 * Samples FPS, frame time, draw calls, memory, node counts, and flags
 * performance regressions against baseline snapshots.
 */

import { EngineProfileSnapshot } from '../engine/GameEngineTypes';

export class GodotProfiler {
  private baseline?: EngineProfileSnapshot;

  /**
   * Set a baseline snapshot for regression tracking
   */
  public setBaseline(baseline: EngineProfileSnapshot): void {
    this.baseline = baseline;
  }

  /**
   * Capture a performance profile snapshot
   */
  public captureSnapshot(
    customMetrics: Pick<EngineProfileSnapshot, 'fps' | 'frameTimeMs' | 'nodeCount' | 'memoryMb'> & Partial<EngineProfileSnapshot>
  ): EngineProfileSnapshot {
    const { fps, frameTimeMs, drawCalls, nodeCount, memoryMb, vramMb, physicsTickRate } = customMetrics;

    const regressions: EngineProfileSnapshot['regressions'] = [];

    if (this.baseline) {
      if (fps < this.baseline.fps * 0.85) {
        regressions.push({
          metric: 'fps',
          delta: +(fps - this.baseline.fps).toFixed(2),
          severity: 'critical'
        });
      }
      if (frameTimeMs > this.baseline.frameTimeMs * 1.25) {
        regressions.push({
          metric: 'frameTimeMs',
          delta: +(frameTimeMs - this.baseline.frameTimeMs).toFixed(2),
          severity: 'warning'
        });
      }
      if (memoryMb > this.baseline.memoryMb * 1.5) {
        regressions.push({
          metric: 'memoryMb',
          delta: +(memoryMb - this.baseline.memoryMb).toFixed(2),
          severity: 'warning'
        });
      }
    }

    return {
      timestamp: new Date().toISOString(),
      fps,
      frameTimeMs,
      drawCalls,
      nodeCount,
      memoryMb,
      vramMb,
      physicsTickRate,
      regressions: regressions.length > 0 ? regressions : undefined
    };
  }
}
