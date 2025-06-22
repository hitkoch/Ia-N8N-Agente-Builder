/**
 * Response Cache Middleware
 * Caches frequent agent responses for instant delivery
 */

interface CachedResponse {
  response: string;
  timestamp: number;
  agentId: number;
}

class ResponseCache {
  private cache = new Map<string, CachedResponse>();
  private readonly MAX_CACHE_SIZE = 200;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  getCacheKey(agentId: number, message: string): string {
    // Normalize message for better cache hits
    const normalized = message.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .trim()
      .substring(0, 100);
    return `${agentId}-${normalized}`;
  }

  get(agentId: number, message: string): string | null {
    const key = this.getCacheKey(agentId, message);
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    // Check if cache is still valid
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.response;
  }

  set(agentId: number, message: string, response: string): void {
    const key = this.getCacheKey(agentId, message);
    
    // Don't cache very long responses or very short messages
    if (response.length > 1000 || message.length < 5) return;
    
    this.cache.set(key, {
      response,
      timestamp: Date.now(),
      agentId
    });
    
    // Limit cache size
    if (this.cache.size > this.MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE
    };
  }
}

export const responseCache = new ResponseCache();