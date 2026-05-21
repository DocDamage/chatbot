interface CacheEntry<T> {
  value: T;
  expiresAt?: number;
  createdAt: number;
}

export class GISCache {
  private readonly entries = new Map<string, CacheEntry<unknown>>();

  constructor(private readonly defaultTtlMs = Number(process.env.GIS_PROVIDER_CACHE_TTL_SECONDS || 3600) * 1000) {}

  get<T>(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs = this.defaultTtlMs): void {
    this.entries.set(key, {
      value,
      createdAt: Date.now(),
      expiresAt: ttlMs > 0 ? Date.now() + ttlMs : undefined
    });
  }

  delete(key: string): boolean {
    return this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  stats(): { entries: number } {
    return { entries: this.entries.size };
  }
}
