/**
 * Webhook Performance Optimizer
 * Pre-warming and caching for faster WhatsApp responses
 */

import { storage } from "./storage";
import { whatsappInstances } from "@shared/schema";
import { db } from "./db";
import { fastCache } from "./middleware/fast-cache";

class WebhookOptimizer {
  private agentCache = new Map();
  private instanceCache = new Map();
  private warmupInterval: NodeJS.Timeout | null = null;

  async preWarmCaches() {
    try {
      console.log('🔥 Pre-aquecendo caches do sistema...');
      
      // Cache all WhatsApp instances
      const instances = await db.select().from(whatsappInstances);
      for (const instance of instances) {
        this.instanceCache.set(instance.instanceName, instance);
        
        // Pre-load agents with error handling
        try {
          const agent = await storage.getAgent(instance.agentId, instance.agentId);
          if (agent) {
            this.agentCache.set(`${instance.agentId}-${instance.agentId}`, agent);
            
            // Pre-load RAG documents
            await storage.getRagDocumentsByAgent(agent.id);
          }
        } catch (agentError) {
          console.log(`Cache skip for agent ${instance.agentId}`);
        }
      }
      
      console.log(`✅ Cache pré-aquecido: ${instances.length} instâncias`);
    } catch (error) {
      console.log('Cache warmup failed, will continue without cache');
    }
  }

  async getOptimizedInstance(instanceName: string) {
    // Check fast cache first
    const cacheKey = `instance:${instanceName}`;
    const cached = fastCache.get(cacheKey);
    if (cached) return cached;

    // Check memory cache
    if (this.instanceCache.has(instanceName)) {
      const instance = this.instanceCache.get(instanceName);
      fastCache.set(cacheKey, instance);
      return instance;
    }
    
    // Fallback to database
    const instance = await storage.getWhatsappInstanceByName(instanceName);
    if (instance) {
      this.instanceCache.set(instanceName, instance);
      fastCache.set(cacheKey, instance);
    }
    return instance;
  }

  async getOptimizedAgent(agentId: number, ownerId: number) {
    // Check fast cache first
    const fastCacheKey = `agent:${agentId}:${ownerId}`;
    const cached = fastCache.get(fastCacheKey);
    if (cached) return cached;

    // Check memory cache
    const cacheKey = `${agentId}-${ownerId}`;
    if (this.agentCache.has(cacheKey)) {
      const agent = this.agentCache.get(cacheKey);
      fastCache.set(fastCacheKey, agent);
      return agent;
    }
    
    // Fallback to database
    const agent = await storage.getAgent(agentId, ownerId);
    if (agent) {
      this.agentCache.set(cacheKey, agent);
      fastCache.set(fastCacheKey, agent);
    }
    return agent;
  }

  startPeriodicWarmup() {
    // Re-warm caches every 5 minutes for better cache hit rates
    this.warmupInterval = setInterval(() => {
      this.preWarmCaches();
    }, 5 * 60 * 1000);
  }

  stop() {
    if (this.warmupInterval) {
      clearInterval(this.warmupInterval);
      this.warmupInterval = null;
    }
    this.agentCache.clear();
    this.instanceCache.clear();
  }
}

export const webhookOptimizer = new WebhookOptimizer();