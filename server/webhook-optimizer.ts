/**
 * Webhook Performance Optimizer
 * Pre-warming and caching for faster WhatsApp responses
 */

import { storage } from "./storage";
import { whatsappInstances } from "@shared/schema";
import { db } from "./db";

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
    if (this.instanceCache.has(instanceName)) {
      return this.instanceCache.get(instanceName);
    }
    
    const instance = await storage.getWhatsappInstanceByName(instanceName);
    if (instance) {
      this.instanceCache.set(instanceName, instance);
    }
    return instance;
  }

  async getOptimizedAgent(agentId: number, ownerId: number) {
    const cacheKey = `${agentId}-${ownerId}`;
    if (this.agentCache.has(cacheKey)) {
      return this.agentCache.get(cacheKey);
    }
    
    const agent = await storage.getAgent(agentId, ownerId);
    if (agent) {
      this.agentCache.set(cacheKey, agent);
    }
    return agent;
  }

  startPeriodicWarmup() {
    // Re-warm caches every 10 minutes
    this.warmupInterval = setInterval(() => {
      this.preWarmCaches();
    }, 10 * 60 * 1000);
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