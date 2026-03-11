// services/cache.ts
// In-memory cache with TTL for IBGE API responses

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class SimpleCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}

export const cache = new SimpleCache();

// TTL constants based on IBGE data update frequency
export const TTL = {
  LOCALIDADES: 24 * 60 * 60 * 1000,  // 24 hours - rarely changes
  NOMES: 7 * 24 * 60 * 60 * 1000,    // 7 days - census data, never changes
  SIDRA_METADATA: 6 * 60 * 60 * 1000, // 6 hours
  SIDRA_DATA: 60 * 60 * 1000,         // 1 hour - economic indicators update monthly
  INDICADORES: 60 * 60 * 1000,        // 1 hour
  NOTICIAS: 30 * 60 * 1000,           // 30 minutes
} as const;