export interface ResourceGuardrailState {
  canProceed: boolean;
  freeDiskGB: number;
  minFreeDiskGB: number;
  memoryUsageRatio: number;
  maxMemoryUsageRatio: number;
  isDatabaseHealthy: boolean;
  isEmbeddingProviderHealthy: boolean;
  pauseReasons: string[];
}

export interface ResourceGuardrailOptions {
  minFreeDiskGB?: number;
  maxMemoryUsageRatio?: number;
  diskCheckFn?: () => Promise<number>;
  dbCheckFn?: () => Promise<boolean>;
  embeddingHealthCheckFn?: () => Promise<boolean>;
}

export class ResourceGuardrailService {
  private minFreeDiskGB: number;
  private maxMemoryUsageRatio: number;
  private diskCheckFn: () => Promise<number>;
  private dbCheckFn: () => Promise<boolean>;
  private embeddingHealthCheckFn: () => Promise<boolean>;

  constructor(options: ResourceGuardrailOptions = {}) {
    this.minFreeDiskGB = options.minFreeDiskGB ?? 5;
    this.maxMemoryUsageRatio = options.maxMemoryUsageRatio ?? 0.90; // 90% heap threshold
    this.diskCheckFn = options.diskCheckFn ?? (async () => 50); // default simulated 50GB
    this.dbCheckFn = options.dbCheckFn ?? (async () => true);
    this.embeddingHealthCheckFn = options.embeddingHealthCheckFn ?? (async () => true);
  }

  public async evaluateGuardrails(): Promise<ResourceGuardrailState> {
    const pauseReasons: string[] = [];

    // 1. Disk check
    let freeDisk = 0;
    try {
      freeDisk = await this.diskCheckFn();
      if (freeDisk < this.minFreeDiskGB) {
        pauseReasons.push(`Free disk space (${freeDisk} GB) is below safety threshold (${this.minFreeDiskGB} GB).`);
      }
    } catch (err: any) {
      pauseReasons.push(`Failed to verify free disk space: ${err.message}`);
    }

    // 2. Memory check
    const mem = process.memoryUsage();
    const memoryRatio = mem.heapTotal > 0 ? mem.heapUsed / mem.heapTotal : 0;
    if (memoryRatio > this.maxMemoryUsageRatio) {
      pauseReasons.push(`Memory pressure (${(memoryRatio * 100).toFixed(1)}%) exceeds limit (${(this.maxMemoryUsageRatio * 100).toFixed(1)}%).`);
    }

    // 3. Database check
    let dbHealthy = false;
    try {
      dbHealthy = await this.dbCheckFn();
      if (!dbHealthy) {
        pauseReasons.push('Database connection is unavailable or degraded.');
      }
    } catch (err: any) {
      pauseReasons.push(`Database health probe failed: ${err.message}`);
    }

    // 4. Embedding provider health check
    let embedHealthy = false;
    try {
      embedHealthy = await this.embeddingHealthCheckFn();
      if (!embedHealthy) {
        pauseReasons.push('Embedding provider is unhealthy or rate-limited.');
      }
    } catch (err: any) {
      pauseReasons.push(`Embedding health probe failed: ${err.message}`);
    }

    return {
      canProceed: pauseReasons.length === 0,
      freeDiskGB: freeDisk,
      minFreeDiskGB: this.minFreeDiskGB,
      memoryUsageRatio: Math.round(memoryRatio * 100) / 100,
      maxMemoryUsageRatio: this.maxMemoryUsageRatio,
      isDatabaseHealthy: dbHealthy,
      isEmbeddingProviderHealthy: embedHealthy,
      pauseReasons
    };
  }
}
