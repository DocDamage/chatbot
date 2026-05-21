export class SECRequestPacer {
  private readonly intervalMs: number;
  private nextAvailableAt = 0;

  constructor(maxRequestsPerSecond = 8) {
    const safeRate = Math.min(Math.max(maxRequestsPerSecond, 1), 10);
    this.intervalMs = Math.ceil(1000 / safeRate);
  }

  async waitTurn(): Promise<void> {
    const now = Date.now();
    const waitMs = Math.max(0, this.nextAvailableAt - now);
    this.nextAvailableAt = Math.max(now, this.nextAvailableAt) + this.intervalMs;
    if (waitMs > 0) {
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
  }
}
