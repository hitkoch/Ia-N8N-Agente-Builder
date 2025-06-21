import { pgTable, text, serial, integer, boolean, timestamp, real } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("user"), // user, admin
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  systemPrompt: text("system_prompt").notNull(),
  model: text("model").notNull().default("gpt-4o"),
  temperature: real("temperature").notNull().default(0.7),
  maxTokens: integer("max_tokens").notNull().default(2048),
  topP: real("top_p").notNull().default(1.0),
  status: text("status").notNull().default("draft"), // draft, active, testing
  capabilities: text("capabilities").array(), // Array of capabilities like "web_search", "image_analysis", etc.
  tools: text("tools").array(), // Array of enabled tools
  knowledgeBase: text("knowledge_base"), // Custom knowledge/context
  ragDocuments: text("rag_documents"), // Uploaded documents for RAG (JSON string)
  googleServices: text("google_services").array(), // Google integrations: calendar, drive, sheets, docs
  externalApis: text("external_apis"), // JSON string of API configurations
  responseStyle: text("response_style").default("professional"), // professional, casual, technical, creative
  language: text("language").default("pt"), // Default language
  ownerId: integer("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Nova tabela para documentos RAG
export const ragDocuments = pgTable("rag_documents", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  content: text("content"), // Extracted text content
  embeddings: text("embeddings"), // Vector embeddings for similarity search
  uploadedBy: integer("uploaded_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Nova tabela para configurações de APIs externas
export const externalApiConfigs = pgTable("external_api_configs", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  baseUrl: text("base_url").notNull(),
  authType: text("auth_type").notNull(), // bearer, api_key, oauth, basic
  authConfig: text("auth_config"), // JSON with auth details
  endpoints: text("endpoints"), // JSON with available endpoints
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const evolutionInstances = pgTable("evolution_instances", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  instanceId: text("instance_id").notNull(),
  apiKey: text("api_key"),
  status: text("status").notNull().default("inactive"), // active, inactive, testing, connected
  webhookUrl: text("webhook_url"),
  webhookSecret: text("webhook_secret"),
  webhookEvents: text("webhook_events").array(), // Array of subscribed events
  connectedAgentId: integer("connected_agent_id").references(() => agents.id, { onDelete: "set null" }),
  qrCode: text("qr_code"), // Base64 QR code for WhatsApp connection
  phoneNumber: text("phone_number"), // Connected phone number
  lastActivity: timestamp("last_activity"),
  connectionData: text("connection_data"), // JSON string for additional connection info
  ownerId: integer("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  messages: text("messages").notNull(), // JSON stringified array of messages
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  agents: many(agents),
  evolutionInstances: many(evolutionInstances),
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
  owner: one(users, {
    fields: [agents.ownerId],
    references: [users.id],
  }),
  conversations: many(conversations),
}));

export const evolutionInstancesRelations = relations(evolutionInstances, ({ one }) => ({
  owner: one(users, {
    fields: [evolutionInstances.ownerId],
    references: [users.id],
  }),
}));

export const conversationsRelations = relations(conversations, ({ one }) => ({
  agent: one(agents, {
    fields: [conversations.agentId],
    references: [agents.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  email: true,
});

export const insertAgentSchema = createInsertSchema(agents).omit({
  id: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRagDocumentSchema = createInsertSchema(ragDocuments).omit({
  id: true,
  agentId: true,
  uploadedBy: true,
  createdAt: true,
});

export const insertExternalApiConfigSchema = createInsertSchema(externalApiConfigs).omit({
  id: true,
  agentId: true,
  createdAt: true,
});

export const insertEvolutionInstanceSchema = createInsertSchema(evolutionInstances).omit({
  id: true,
  ownerId: true,
  createdAt: true,
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Agent = typeof agents.$inferSelect;
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type RagDocument = typeof ragDocuments.$inferSelect;
export type InsertRagDocument = z.infer<typeof insertRagDocumentSchema>;
export type ExternalApiConfig = typeof externalApiConfigs.$inferSelect;
export type InsertExternalApiConfig = z.infer<typeof insertExternalApiConfigSchema>;
export type EvolutionInstance = typeof evolutionInstances.$inferSelect;
export type InsertEvolutionInstance = z.infer<typeof insertEvolutionInstanceSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
