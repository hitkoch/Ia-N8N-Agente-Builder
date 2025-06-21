import { users, agents, evolutionInstances, conversations, type User, type InsertUser, type Agent, type InsertAgent, type EvolutionInstance, type InsertEvolutionInstance, type Conversation, type InsertConversation } from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getAgentsByOwner(ownerId: number): Promise<Agent[]>;
  getAgent(id: number, ownerId: number): Promise<Agent | undefined>;
  createAgent(agent: InsertAgent & { ownerId: number }): Promise<Agent>;
  updateAgent(id: number, ownerId: number, updates: Partial<InsertAgent>): Promise<Agent | undefined>;
  deleteAgent(id: number, ownerId: number): Promise<boolean>;
  
  getEvolutionInstancesByOwner(ownerId: number): Promise<EvolutionInstance[]>;
  getEvolutionInstance(id: number, ownerId: number): Promise<EvolutionInstance | undefined>;
  createEvolutionInstance(instance: InsertEvolutionInstance & { ownerId: number }): Promise<EvolutionInstance>;
  updateEvolutionInstance(id: number, ownerId: number, updates: Partial<InsertEvolutionInstance>): Promise<EvolutionInstance | undefined>;
  deleteEvolutionInstance(id: number, ownerId: number): Promise<boolean>;
  
  getConversationsByAgent(agentId: number): Promise<Conversation[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  
  // Placeholder for future RAG and API features
  getRagDocumentsByAgent?(agentId: number): Promise<any[]>;
  createRagDocument?(document: any): Promise<any>;
  deleteRagDocument?(id: number, ownerId: number): Promise<boolean>;
  
  getExternalApiConfigsByAgent?(agentId: number): Promise<any[]>;
  createExternalApiConfig?(config: any): Promise<any>;
  updateExternalApiConfig?(id: number, agentId: number, updates: any): Promise<any>;
  deleteExternalApiConfig?(id: number, agentId: number): Promise<boolean>;
  
  sessionStore: any;
}

export class DatabaseStorage implements IStorage {
  sessionStore: any;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getAgentsByOwner(ownerId: number): Promise<Agent[]> {
    return await db.select().from(agents).where(eq(agents.ownerId, ownerId));
  }

  async getAgent(id: number, ownerId: number): Promise<Agent | undefined> {
    const [agent] = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, id), eq(agents.ownerId, ownerId)));
    return agent || undefined;
  }

  async createAgent(agent: InsertAgent & { ownerId: number }): Promise<Agent> {
    const [newAgent] = await db
      .insert(agents)
      .values(agent)
      .returning();
    return newAgent;
  }

  async updateAgent(id: number, ownerId: number, updates: Partial<InsertAgent>): Promise<Agent | undefined> {
    const [updatedAgent] = await db
      .update(agents)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(agents.id, id), eq(agents.ownerId, ownerId)))
      .returning();
    return updatedAgent || undefined;
  }

  async deleteAgent(id: number, ownerId: number): Promise<boolean> {
    const result = await db
      .delete(agents)
      .where(and(eq(agents.id, id), eq(agents.ownerId, ownerId)));
    return (result.rowCount || 0) > 0;
  }

  async getEvolutionInstancesByOwner(ownerId: number): Promise<EvolutionInstance[]> {
    return await db.select().from(evolutionInstances).where(eq(evolutionInstances.ownerId, ownerId));
  }

  async getEvolutionInstance(id: number, ownerId: number): Promise<EvolutionInstance | undefined> {
    const [instance] = await db
      .select()
      .from(evolutionInstances)
      .where(and(eq(evolutionInstances.id, id), eq(evolutionInstances.ownerId, ownerId)));
    return instance || undefined;
  }

  async createEvolutionInstance(instance: InsertEvolutionInstance & { ownerId: number }): Promise<EvolutionInstance> {
    const [newInstance] = await db
      .insert(evolutionInstances)
      .values(instance)
      .returning();
    return newInstance;
  }

  async updateEvolutionInstance(id: number, ownerId: number, updates: Partial<InsertEvolutionInstance>): Promise<EvolutionInstance | undefined> {
    const [updatedInstance] = await db
      .update(evolutionInstances)
      .set(updates)
      .where(and(eq(evolutionInstances.id, id), eq(evolutionInstances.ownerId, ownerId)))
      .returning();
    return updatedInstance || undefined;
  }

  async deleteEvolutionInstance(id: number, ownerId: number): Promise<boolean> {
    const result = await db
      .delete(evolutionInstances)
      .where(and(eq(evolutionInstances.id, id), eq(evolutionInstances.ownerId, ownerId)));
    return (result.rowCount || 0) > 0;
  }

  async getConversationsByAgent(agentId: number): Promise<Conversation[]> {
    return await db.select().from(conversations).where(eq(conversations.agentId, agentId));
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const [newConversation] = await db
      .insert(conversations)
      .values(conversation)
      .returning();
    return newConversation;
  }

  // Future implementations for RAG and API features
  async getRagDocumentsByAgent(agentId: number): Promise<any[]> {
    // Will be implemented when RAG documents table is properly migrated
    return [];
  }

  async createRagDocument(document: any): Promise<any> {
    // Will be implemented when RAG documents table is properly migrated
    return document;
  }

  async deleteRagDocument(id: number, ownerId: number): Promise<boolean> {
    // Will be implemented when RAG documents table is properly migrated
    return true;
  }

  async getExternalApiConfigsByAgent(agentId: number): Promise<any[]> {
    // Will be implemented when external API configs table is properly migrated
    return [];
  }

  async createExternalApiConfig(config: any): Promise<any> {
    // Will be implemented when external API configs table is properly migrated
    return config;
  }

  async updateExternalApiConfig(id: number, agentId: number, updates: any): Promise<any> {
    // Will be implemented when external API configs table is properly migrated
    return updates;
  }

  async deleteExternalApiConfig(id: number, agentId: number): Promise<boolean> {
    // Will be implemented when external API configs table is properly migrated
    return true;
  }
}

export const storage = new DatabaseStorage();
