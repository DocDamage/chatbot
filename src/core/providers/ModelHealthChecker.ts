import { ProviderHealthState } from '../../types/model-registry';

export interface HealthRecord {
  state: ProviderHealthState;
  lastCheckedAt: number;
  cooldownUntil?: number;
  failureCount: number;
  lastErrorMessage?: string;
}

export class ModelHealthChecker {
  private healthRecords = new Map<string, HealthRecord>();

  private getKey(provider: string, model: string): string {
    return `${provider.toLowerCase()}::${model.toLowerCase()}`;
  }

  public recordSuccess(provider: string, model: string): void {
    const key = this.getKey(provider, model);
    this.healthRecords.set(key, {
      state: 'healthy',
      lastCheckedAt: Date.now(),
      failureCount: 0
    });
  }

  public recordError(
    provider: string,
    model: string,
    errorState: ProviderHealthState,
    errorMessage?: string,
    cooldownMs: number = 30000
  ): void {
    const key = this.getKey(provider, model);
    const existing = this.healthRecords.get(key);
    const failureCount = (existing?.failureCount ?? 0) + 1;

    let cooldownUntil: number | undefined;
    if (errorState === 'rate-limited' || errorState === 'timeout' || errorState === 'unavailable') {
      cooldownUntil = Date.now() + cooldownMs;
    }

    this.healthRecords.set(key, {
      state: errorState,
      lastCheckedAt: Date.now(),
      cooldownUntil,
      failureCount,
      lastErrorMessage: errorMessage
    });
  }

  public getHealthState(provider: string, model: string): ProviderHealthState {
    const key = this.getKey(provider, model);
    const record = this.healthRecords.get(key);
    if (!record) {
      return 'healthy'; // Default unobserved is assumed tentatively healthy until checked
    }

    // Check if cooldown expired for temporary errors
    if (record.cooldownUntil && Date.now() > record.cooldownUntil) {
      return 'healthy';
    }

    return record.state;
  }

  public isAvailable(provider: string, model: string): boolean {
    const state = this.getHealthState(provider, model);
    return state === 'healthy';
  }

  public reset(provider?: string, model?: string): void {
    if (provider && model) {
      this.healthRecords.delete(this.getKey(provider, model));
    } else {
      this.healthRecords.clear();
    }
  }
}
