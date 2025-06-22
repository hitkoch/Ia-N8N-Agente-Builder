import { 
  users, agents, evolutionInstances, conversations, ragDocuments, whatsappInstances,
  type User, type InsertUser, type Agent, type InsertAgent, 
  type EvolutionInstance, type InsertEvolutionInstance, 
  type Conversation, type InsertConversation,
  type WhatsappInstance, type InsertWhatsappInstance
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";

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
  
  // RAG document management
  getRagDocumentsByAgent(agentId: number): Promise<any[]>;
  createRagDocument(document: any): Promise<any>;
  deleteRagDocument(id: number, ownerId: number): Promise<boolean>;
  
  getExternalApiConfigsByAgent?(agentId: number): Promise<any[]>;
  createExternalApiConfig?(config: any): Promise<any>;
  updateExternalApiConfig?(id: number, agentId: number, updates: any): Promise<any>;
  deleteExternalApiConfig?(id: number, agentId: number): Promise<boolean>;
  
  // WhatsApp Instances management
  getWhatsappInstance(agentId: number): Promise<WhatsappInstance | undefined>;
  getWhatsappInstanceByName(instanceName: string): Promise<WhatsappInstance | undefined>;
  createWhatsappInstance(instance: InsertWhatsappInstance): Promise<WhatsappInstance>;
  updateWhatsappInstance(agentId: number, updates: Partial<InsertWhatsappInstance>): Promise<WhatsappInstance | undefined>;
  updateWhatsappInstanceByName(instanceName: string, updates: Partial<InsertWhatsappInstance>): Promise<WhatsappInstance | undefined>;
  deleteWhatsappInstance(agentId: number): Promise<boolean>;
  
  sessionStore: any;
}

export class DatabaseStorage implements IStorage {
  sessionStore: any;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      conString: process.env.DATABASE_URL, 
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
    // Ensure messages field is properly handled
    const conversationData = {
      ...conversation,
      messages: conversation.messages || []
    };
    
    const [newConversation] = await db
      .insert(conversations)
      .values(conversationData)
      .returning();
    return newConversation;
  }

  async getRagDocumentsByAgent(agentId: number): Promise<any[]> {
    try {
      const documents = await db.select().from(ragDocuments).where(eq(ragDocuments.agentId, agentId));
      console.log(`📄 Encontrados ${documents.length} documentos para o agente ${agentId}`);
      
      // Clean and format documents to ensure JSON serialization works
      const cleanDocuments = documents.map(doc => ({
        id: doc.id,
        agentId: doc.agentId,
        filename: doc.filename || '',
        originalName: doc.originalName || '',
        content: doc.content || '',
        fileSize: doc.fileSize || 0,
        mimeType: doc.mimeType || '',
        processingStatus: doc.processingStatus || 'pending',
        uploadedBy: doc.uploadedBy,
        uploadedAt: doc.uploadedAt,
        embedding: doc.embedding ? JSON.parse(doc.embedding) : null
      }));
      
      return cleanDocuments;
    } catch (error) {
      console.error('❌ Erro ao buscar documentos RAG:', error);
      return [];
    }
  }

  async createRagDocument(document: any): Promise<any> {
    try {
      console.log(`📄 Criando documento RAG:`);
      console.log(`   - Agent ID: ${document.agentId}`);
      console.log(`   - Nome: ${document.originalName}`);
      console.log(`   - Conteúdo: ${document.content?.length || 0} chars`);
      console.log(`   - Embeddings: ${document.embedding ? 'presente' : 'ausente'}`);
      
      const [created] = await db.insert(ragDocuments).values(document).returning();
      console.log(`✅ Documento RAG criado com ID: ${created.id}`);
      
      // Verificar se foi salvo corretamente
      const [verified] = await db.select().from(ragDocuments).where(eq(ragDocuments.id, created.id));
      console.log(`🔍 Verificação: embedding salvo = ${!!verified.embedding}`);
      
      return created;
    } catch (error) {
      console.error('❌ Erro ao criar documento RAG:', error);
      throw error;
    }
  }

  async deleteRagDocument(id: number, ownerId: number): Promise<boolean> {
    try {
      console.log(`🗑️ Deletando documento RAG ${id} do usuário ${ownerId}`);
      
      // Buscar o documento antes de deletar para logs
      const [document] = await db.select().from(ragDocuments)
        .where(and(eq(ragDocuments.id, id), eq(ragDocuments.uploadedBy, ownerId)));
      
      if (document) {
        console.log(`📄 Documento encontrado: ${document.originalName}`);
        console.log(`🔮 Removendo embeddings associados ao documento`);
      }
      
      // Deletar documento (embeddings são deletados automaticamente pois estão na mesma linha)
      const result = await db.delete(ragDocuments)
        .where(and(eq(ragDocuments.id, id), eq(ragDocuments.uploadedBy, ownerId)));
      
      const deleted = (result.rowCount || 0) > 0;
      
      if (deleted && document) {
        console.log(`✅ Documento ${document.originalName} e seus embeddings foram excluídos permanentemente`);
      }
      
      return deleted;
    } catch (error) {
      console.error('❌ Erro ao deletar documento RAG:', error);
      return false;
    }
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

  async getWhatsappInstance(agentId: number): Promise<WhatsappInstance | undefined> {
    const [instance] = await db
      .select()
      .from(whatsappInstances)
      .where(eq(whatsappInstances.agentId, agentId));
    return instance || undefined;
  }

  async createWhatsappInstance(instance: InsertWhatsappInstance): Promise<WhatsappInstance> {
    const [newInstance] = await db
      .insert(whatsappInstances)
      .values(instance)
      .returning();
    return newInstance;
  }

  async updateWhatsappInstance(agentId: number, updates: Partial<InsertWhatsappInstance>): Promise<WhatsappInstance | undefined> {
    const [updatedInstance] = await db
      .update(whatsappInstances)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(whatsappInstances.agentId, agentId))
      .returning();
    return updatedInstance || undefined;
  }

  async updateWhatsappInstanceByName(instanceName: string, updates: Partial<InsertWhatsappInstance>): Promise<WhatsappInstance | undefined> {
    const [updatedInstance] = await db
      .update(whatsappInstances)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(whatsappInstances.instanceName, instanceName))
      .returning();
    return updatedInstance || undefined;
  }

  async getWhatsappInstanceByName(instanceName: string): Promise<WhatsappInstance | undefined> {
    const [instance] = await db
      .select()
      .from(whatsappInstances)
      .where(eq(whatsappInstances.instanceName, instanceName));
    return instance || undefined;
  }

  async deleteWhatsappInstance(agentId: number): Promise<boolean> {
    try {
      const result = await db
        .delete(whatsappInstances)
        .where(eq(whatsappInstances.agentId, agentId))
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error("Erro ao excluir instância WhatsApp:", error);
      return false;
    }
  }
}

export const storage = new DatabaseStorage();
