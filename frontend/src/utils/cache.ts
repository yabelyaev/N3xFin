/**
 * Simple in-memory cache with TTL (Time To Live) and stale-while-revalidate support
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  staleTime: number; // Time after which data is considered stale but still usable
}

class Cache {
  private cache: Map<string, CacheEntry<any>> = new Map();

  /**
   * Get cached data if it exists and hasn't expired
   * Returns { data, isStale } where isStale indicates if background refresh is needed
   */
  get<T>(key: string): { data: T; isStale: boolean } | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    const now = Date.now();
    const age = now - entry.timestamp;

    // Check if cache has completely expired (hard TTL)
    if (age > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Check if data is stale (soft TTL) - still return it but mark as stale
    const isStale = age > entry.staleTime;

    return {
      data: entry.data as T,
      isStale,
    };
  }

  /**
   * Set cache data with TTL and stale time in milliseconds
   * @param key Cache key
   * @param data Data to cache
   * @param ttl Total time to live (hard expiration)
   * @param staleTime Time after which to fetch fresh data in background (soft expiration)
   */
  set<T>(key: string, data: T, ttl: number = 60000, staleTime?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      staleTime: staleTime || ttl / 2, // Default: stale at 50% of TTL
    });
  }

  /**
   * Clear specific cache entry
   */
  clear(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clearAll(): void {
    this.cache.clear();
  }

  /**
   * Clear all cache entries matching a pattern
   */
  clearPattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }
}

// Export singleton instance
export const cache = new Cache();

// Cache TTL constants (in milliseconds)
export const CACHE_TTL = {
  ANALYTICS: 2 * 60 * 1000,      // 2 minutes (stale after 1 minute)
  RECOMMENDATIONS: 5 * 60 * 1000, // 5 minutes (stale after 2.5 minutes)
  PREDICTIONS: 5 * 60 * 1000,     // 5 minutes (stale after 2.5 minutes)
  REPORTS: 10 * 60 * 1000,        // 10 minutes (stale after 5 minutes)
  CONVERSATIONS: 1 * 60 * 1000,   // 1 minute (stale after 30 seconds)
};

// Stale times (when to trigger background refresh)
export const CACHE_STALE_TIME = {
  ANALYTICS: 1 * 60 * 1000,       // 1 minute
  RECOMMENDATIONS: 2.5 * 60 * 1000, // 2.5 minutes
  PREDICTIONS: 2.5 * 60 * 1000,     // 2.5 minutes
  REPORTS: 5 * 60 * 1000,          // 5 minutes
  CONVERSATIONS: 30 * 1000,        // 30 seconds
};
