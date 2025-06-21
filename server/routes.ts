import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertAgentSchema, insertEvolutionInstanceSchema, insertConversationSchema } from "@shared/schema";
import { z } from "zod";
import { agentService } from "./services/agent";

function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

// Type assertion helper for authenticated requests
function getAuthenticatedUser(req: any) {
  return req.user!;
}

export function registerRoutes(app: Express): Server {
  // Setup authentication routes
  setupAuth(app);

  // Agent routes
  app.get("/api/agents", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthenticatedUser(req);
      const agents = await storage.getAgentsByOwner(user.id);
      res.json(agents);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/agents/:id", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthenticatedUser(req);
      const agentId = parseInt(req.params.id);
      const agent = await storage.getAgent(agentId, user.id);
      
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      
      res.json(agent);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/agents", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthenticatedUser(req);
      const validatedData = insertAgentSchema.parse(req.body);
      const agent = await storage.createAgent({
        ...validatedData,
        ownerId: user.id,
      });
      res.status(201).json(agent);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      next(error);
    }
  });

  app.put("/api/agents/:id", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthenticatedUser(req);
      const agentId = parseInt(req.params.id);
      const validatedData = insertAgentSchema.partial().parse(req.body);
      
      const updatedAgent = await storage.updateAgent(agentId, user.id, validatedData);
      
      if (!updatedAgent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      
      res.json(updatedAgent);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      next(error);
    }
  });

  app.delete("/api/agents/:id", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthenticatedUser(req);
      const agentId = parseInt(req.params.id);
      const deleted = await storage.deleteAgent(agentId, user.id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Agent not found" });
      }
      
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  });

  // Agent testing route
  app.post("/api/agents/:id/test", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthenticatedUser(req);
      const agentId = parseInt(req.params.id);
      const { message } = req.body;

      if (!message || typeof message !== "string") {
        return res.status(400).json({ message: "Message is required" });
      }

      const agent = await storage.getAgent(agentId, user.id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const response = await agentService.testAgent(agent, message);
      res.json({ response });
    } catch (error) {
      next(error);
    }
  });

  // Evolution API instance routes
  app.get("/api/evolution-instances", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthenticatedUser(req);
      const instances = await storage.getEvolutionInstancesByOwner(user.id);
      res.json(instances);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/evolution-instances", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthenticatedUser(req);
      const validatedData = insertEvolutionInstanceSchema.parse(req.body);
      const instance = await storage.createEvolutionInstance({
        ...validatedData,
        ownerId: user.id,
      });
      res.status(201).json(instance);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      next(error);
    }
  });

  app.put("/api/evolution-instances/:id", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthenticatedUser(req);
      const instanceId = parseInt(req.params.id);
      const validatedData = insertEvolutionInstanceSchema.partial().parse(req.body);
      
      const updatedInstance = await storage.updateEvolutionInstance(instanceId, user.id, validatedData);
      
      if (!updatedInstance) {
        return res.status(404).json({ message: "Evolution instance not found" });
      }
      
      res.json(updatedInstance);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      next(error);
    }
  });

  // Conversation routes
  app.get("/api/agents/:id/conversations", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthenticatedUser(req);
      const agentId = parseInt(req.params.id);
      
      // Verify agent ownership
      const agent = await storage.getAgent(agentId, user.id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      
      const conversations = await storage.getConversationsByAgent(agentId);
      res.json(conversations);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/conversations", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthenticatedUser(req);
      const validatedData = insertConversationSchema.parse(req.body);
      
      // Verify agent ownership
      const agent = await storage.getAgent(validatedData.agentId, user.id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      
      const conversation = await storage.createConversation(validatedData);
      res.status(201).json(conversation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error", 
          errors: error.errors 
        });
      }
      next(error);
    }
  });

  // Dashboard stats route
  app.get("/api/dashboard/stats", requireAuth, async (req, res, next) => {
    try {
      const user = getAuthenticatedUser(req);
      const agents = await storage.getAgentsByOwner(user.id);
      const instances = await storage.getEvolutionInstancesByOwner(user.id);
      
      const totalAgents = agents.length;
      const activeAgents = agents.filter(a => a.status === "active").length;
      const integrations = instances.length;
      
      // Count total conversations across all agents
      let totalConversations = 0;
      for (const agent of agents) {
        const conversations = await storage.getConversationsByAgent(agent.id);
        totalConversations += conversations.length;
      }
      
      res.json({
        totalAgents,
        activeAgents,
        integrations,
        conversations: totalConversations,
      });
    } catch (error) {
      next(error);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
