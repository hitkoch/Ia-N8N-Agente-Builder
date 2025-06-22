/**
 * Webhook Performance Optimizer
 * Pre-warming and caching for faster WhatsApp responses
 */

import { storage } from "./storage";
import { whatsappInstances } from "@shared/schema";

class WebhookOptimizer {
  private agentCache = new Map();
  private instanceCache = new Map();
  private warmupInterval: NodeJS.Timeout | null = null;

  async preWarmCaches() {
    try {
      console.log('🔥 Pre-aquecendo caches do sistema...');
      
      // Cache all WhatsApp instances
      const instances = await storage.db.select().from(whatsappInstances);
      for (const instance of instances) {
        this.instanceCache.set(instance.instanceName, instance);
        
        // Pre-load agents
        const agent = await storage.getAgent(instance.agentId, instance.agentId);
        if (agent) {
          this.agentCache.set(instance.agentId, agent);
          
          // Pre-load RAG documents
          await storage.getRagDocumentsByAgent(agent.id);
        }
      }
      
      console.log(`✅ Cache pré-aquecido: ${instances.length} instâncias, ${this.agentCache.size} agentes`);
    } catch (error) {
      console.error('❌ Erro no pré-aquecimento:', error);
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