/**
 * Ultra-Fast Memory Cache
 * Optimized for instant WhatsApp responses
 */

interface FastCacheEntry {
  data: any;
  timestamp: number;
  hits: number;
}

class FastCache {
  private cache = new Map<string, FastCacheEntry>();
  private readonly MAX_SIZE = 500;
  private readonly TTL = 10 * 60 * 1000; // 10 minutes

  set(key: string, value: any): void {
    // Don't cache large objects
    if (typeof value === 'object' && JSON.stringify(value).length > 10000) {
      return;
    }

    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
      hits: 0
    });

    // Auto-cleanup when cache gets too large
    if (this.cache.size > this.MAX_SIZE) {
      this.cleanup();
    }
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    // Check TTL
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }
    
    // Update hit counter for LRU
    entry.hits++;
    
    return entry.data;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    // Remove expired entries first
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.TTL) {
        this.cache.delete(key);
      }
    }

    // If still too large, remove least hit entries
    if (this.cache.size > this.MAX_SIZE) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].hits - b[1].hits);
      
      const toRemove = Math.floor(this.MAX_SIZE * 0.2); // Remove 20%
      for (let i = 0; i < toRemove && i < entries.length; i++) {
        this.cache.delete(entries[i][0]);
      }
    }
  }

  getStats(): { size: number; maxSize: number; hitRate: number } {
    const totalHits = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.hits, 0);
    const hitRate = this.cache.size > 0 ? totalHits / this.cache.size : 0;
    
    return {
      size: this.cache.size,
      maxSize: this.MAX_SIZE,
      hitRate: Math.round(hitRate * 100) / 100
    };
  }
}

export const fastCache = new FastCache();