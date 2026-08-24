/**
 * Local Resource Budget & Concurrency Enforcer
 * Enforces VRAM, concurrency, queue depth, timeouts, and request cancellation.
 */

import { logger } from '../../observability/logger';

export class LocalResourceOverloadedError extends Error {
  constructor(message: string, public readonly retryAfterMs: number = 1000) {
    super(message);
    this.name = 'LocalResourceOverloadedError';
  }
}

export interface ResourceBudgetConfig {
  maxConcurrency?: number;
  maxQueueDepth?: number;
  timeoutMs?: number;
  maxVramMb?: number;
  maxRamMb?: number;
  maxCpuThreads?: number;
}

export interface LocalResourceLease {
  id: string;
  requestId: string;
  allocatedAt: number;
  release: () => void;
}

interface QueuedItem {
  id: string;
  requestId: string;
  enqueuedAt: number;
  resolve: (lease: LocalResourceLease) => void;
  reject: (reason: any) => void;
  timer: NodeJS.Timeout;
  abortCleanup?: () => void;
}

export class LocalResourceManager {
  private maxConcurrency: number;
  private maxQueueDepth: number;
  private defaultTimeoutMs: number;
  private maxVramMb?: number;
  private maxRamMb?: number;
  private maxCpuThreads?: number;

  private activeLeases = new Map<string, LocalResourceLease>();
  private queue: QueuedItem[] = [];

  constructor(config: ResourceBudgetConfig = {}) {
    this.maxConcurrency = config.maxConcurrency ?? 2;
    this.maxQueueDepth = config.maxQueueDepth ?? 8;
    this.defaultTimeoutMs = config.timeoutMs ?? 60000;
    this.maxVramMb = config.maxVramMb;
    this.maxRamMb = config.maxRamMb;
    this.maxCpuThreads = config.maxCpuThreads;
  }

  /**
   * Acquire execution slot under current concurrency and queue budget.
   */
  async acquire(
    requestId: string,
    options: {
      timeoutMs?: number;
      signal?: AbortSignal;
      requiredVramMb?: number;
      requiredRamMb?: number;
      requiredCpuThreads?: number;
    } = {}
  ): Promise<LocalResourceLease> {
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;

    // Check VRAM requirement if budget set
    if (this.maxVramMb && options.requiredVramMb && options.requiredVramMb > this.maxVramMb) {
      throw new LocalResourceOverloadedError(
        `Model requires ${options.requiredVramMb}MB VRAM exceeding system budget ${this.maxVramMb}MB`
      );
    }
    if (this.maxRamMb && options.requiredRamMb && options.requiredRamMb > this.maxRamMb) {
      throw new LocalResourceOverloadedError(
        `Model requires ${options.requiredRamMb}MB RAM exceeding system budget ${this.maxRamMb}MB`
      );
    }
    if (this.maxCpuThreads && options.requiredCpuThreads && options.requiredCpuThreads > this.maxCpuThreads) {
      throw new LocalResourceOverloadedError(
        `Request requires ${options.requiredCpuThreads} CPU threads exceeding system budget ${this.maxCpuThreads}`
      );
    }

    if (options.signal?.aborted) {
      const err = new Error('Operation aborted');
      err.name = 'AbortError';
      throw err;
    }

    // Direct grant if slots available
    if (this.activeLeases.size < this.maxConcurrency) {
      return this.createLease(requestId);
    }

    // Check queue limit
    if (this.queue.length >= this.maxQueueDepth) {
      logger.warn('Local resource manager queue saturated', {
        active: this.activeLeases.size,
        queued: this.queue.length,
        maxQueueDepth: this.maxQueueDepth
      });
      throw new LocalResourceOverloadedError(
        `Local model queue is saturated (${this.queue.length}/${this.maxQueueDepth} pending requests)`,
        Math.max(2000, this.queue.length * 500)
      );
    }

    // Enqueue
    return new Promise<LocalResourceLease>((resolve, reject) => {
      const queueId = `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      const timer = setTimeout(() => {
        this.removeFromQueue(queueId);
        reject(new Error(`Timeout waiting for local model slot after ${timeoutMs}ms`));
      }, timeoutMs);

      const item: QueuedItem = {
        id: queueId,
        requestId,
        enqueuedAt: Date.now(),
        resolve,
        reject,
        timer
      };

      if (options.signal) {
        const onAbort = () => {
          clearTimeout(timer);
          this.removeFromQueue(queueId);
          const err = new Error('Operation aborted while queued');
          err.name = 'AbortError';
          reject(err);
        };
        options.signal.addEventListener('abort', onAbort, { once: true });
        item.abortCleanup = () => options.signal?.removeEventListener('abort', onAbort);
      }

      this.queue.push(item);
    });
  }

  private createLease(requestId: string): LocalResourceLease {
    const leaseId = `lease-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    let released = false;

    const lease: LocalResourceLease = {
      id: leaseId,
      requestId,
      allocatedAt: Date.now(),
      release: () => {
        if (released) return;
        released = true;
        this.activeLeases.delete(leaseId);
        this.processNext();
      }
    };

    this.activeLeases.set(leaseId, lease);
    return lease;
  }

  private processNext(): void {
    if (this.activeLeases.size >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    const next = this.queue.shift();
    if (!next) return;

    clearTimeout(next.timer);
    if (next.abortCleanup) next.abortCleanup();

    const lease = this.createLease(next.requestId);
    next.resolve(lease);
  }

  private removeFromQueue(queueId: string): void {
    const idx = this.queue.findIndex(q => q.id === queueId);
    if (idx !== -1) {
      const [item] = this.queue.splice(idx, 1);
      clearTimeout(item.timer);
      if (item.abortCleanup) item.abortCleanup();
    }
  }

  getMetrics() {
    return {
      activeRequests: this.activeLeases.size,
      queuedRequests: this.queue.length,
      maxConcurrency: this.maxConcurrency,
      maxQueueDepth: this.maxQueueDepth,
      maxVramMb: this.maxVramMb,
      maxRamMb: this.maxRamMb,
      maxCpuThreads: this.maxCpuThreads,
      availableSlots: Math.max(0, this.maxConcurrency - this.activeLeases.size)
    };
  }

  drain(reason: string = 'Resource manager draining'): void {
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (item) {
        clearTimeout(item.timer);
        if (item.abortCleanup) item.abortCleanup();
        item.reject(new Error(reason));
      }
    }
    this.activeLeases.clear();
  }
}
