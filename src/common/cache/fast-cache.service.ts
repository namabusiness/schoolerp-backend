import { Injectable, Logger } from '@nestjs/common';

interface CacheEntry<T = any> {
  value: T;
  expiresAt: number;
}

@Injectable()
export class FastCacheService {
  private readonly logger = new Logger(FastCacheService.name);
  private cache = new Map<string, CacheEntry>();
  private inFlight = new Map<string, Promise<any>>();

  /**
   * Retrieve cached value if present and unexpired.
   */
  get<T = any>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  /**
   * Store value in cache with given TTL in seconds (default: 60s).
   */
  set<T = any>(key: string, value: T, ttlSeconds: number = 60): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Fast cache wrapper with single-flight deduplication.
   * If cached: returns in < 0.001ms without hitting database.
   * If concurrent requests hit simultaneously: executes database query only ONCE.
   */
  async getOrSet<T = any>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = 60,
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Coalesce in-flight promises to prevent database stampedes
    const running = this.inFlight.get(key);
    if (running) {
      return running as Promise<T>;
    }

    const promise = (async () => {
      try {
        const result = await fetcher();
        this.set(key, result, ttlSeconds);
        return result;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);
    return promise;
  }

  /**
   * Delete specific cache key.
   */
  del(key: string): void {
    this.cache.delete(key);
    this.inFlight.delete(key);
  }

  /**
   * Delete all keys starting with prefix (useful on mutation).
   */
  delByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache entries.
   */
  clear(): void {
    this.cache.clear();
    this.inFlight.clear();
  }
}
