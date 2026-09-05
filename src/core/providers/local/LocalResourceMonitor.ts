/**
 * Local Resource & Hardware Monitor (PX-07 / PX07-T06)
 * Collects bounded, privacy-safe, non-invasive system metrics (CPU load, RAM availability,
 * advisory VRAM estimation, model disk capacity, queue states) to guide local routing.
 */

import * as os from 'os';
import * as fs from 'fs';

export interface LocalHardwareMetrics {
  cpuCount: number;
  cpuModel: string;
  cpuLoadPercent: number;
  totalRamMb: number;
  freeRamMb: number;
  usedRamMb: number;
  ramUsagePercent: number;
  estimatedVramTotalMb?: number;
  estimatedVramFreeMb?: number;
  modelDiskFreeMb?: number;
  timestamp: string;
}

export interface ResourceMonitorOptions {
  modelCacheDir?: string;
  vramOverrideMb?: number;
}

export class LocalResourceMonitor {
  private lastCpuMeasure: { idle: number; total: number } | null = null;
  private modelCacheDir?: string;
  private vramOverrideMb?: number;

  constructor(options: ResourceMonitorOptions = {}) {
    this.modelCacheDir = options.modelCacheDir;
    this.vramOverrideMb = options.vramOverrideMb;
  }

  /**
   * Sample current local system resource metrics safely without admin privileges
   */
  public sampleMetrics(): LocalHardwareMetrics {
    const cpus = os.cpus();
    const cpuCount = cpus.length;
    const cpuModel = cpus[0]?.model || 'Generic CPU';

    // Calculate approximate CPU load from core times
    const cpuLoadPercent = this.calculateCpuLoad(cpus);

    const totalRamBytes = os.totalmem();
    const freeRamBytes = os.freemem();
    const usedRamBytes = totalRamBytes - freeRamBytes;

    const totalRamMb = Math.round(totalRamBytes / (1024 * 1024));
    const freeRamMb = Math.round(freeRamBytes / (1024 * 1024));
    const usedRamMb = Math.round(usedRamBytes / (1024 * 1024));
    const ramUsagePercent = Math.round((usedRamMb / totalRamMb) * 100);

    // Advisory disk free space check
    let modelDiskFreeMb: number | undefined;
    if (this.modelCacheDir && fs.existsSync(this.modelCacheDir)) {
      try {
        const stat = fs.statSync(this.modelCacheDir);
        if (stat.isDirectory()) {
          // If statfs is supported in environment
          const statfs = (fs as any).statfsSync?.(this.modelCacheDir);
          if (statfs) {
            modelDiskFreeMb = Math.round((statfs.bavail * statfs.bsize) / (1024 * 1024));
          }
        }
      } catch {
        // Advisory only
      }
    }

    return {
      cpuCount,
      cpuModel,
      cpuLoadPercent,
      totalRamMb,
      freeRamMb,
      usedRamMb,
      ramUsagePercent,
      estimatedVramTotalMb: this.vramOverrideMb,
      estimatedVramFreeMb: this.vramOverrideMb ? Math.round(this.vramOverrideMb * 0.8) : undefined,
      modelDiskFreeMb,
      timestamp: new Date().toISOString()
    };
  }

  private calculateCpuLoad(cpus: os.CpuInfo[]): number {
    let idle = 0;
    let total = 0;

    for (const cpu of cpus) {
      for (const [type, time] of Object.entries(cpu.times)) {
        total += time;
        if (type === 'idle') idle += time;
      }
    }

    if (!this.lastCpuMeasure) {
      this.lastCpuMeasure = { idle, total };
      return 10; // Initial baseline estimate
    }

    const idleDiff = idle - this.lastCpuMeasure.idle;
    const totalDiff = total - this.lastCpuMeasure.total;
    this.lastCpuMeasure = { idle, total };

    if (totalDiff <= 0) return 0;
    const load = 100 - Math.round((idleDiff / totalDiff) * 100);
    return Math.max(0, Math.min(100, load));
  }
}
