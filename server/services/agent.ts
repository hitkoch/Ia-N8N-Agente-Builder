import { Agent } from "@shared/schema";
import { openaiService, ChatMessage } from "./openai";
import { storage } from "../storage";
import { responseCache } from "../middleware/response-cache";

export class AgentService {
  private cache = new Map();

  async testAgent(agent: Agent, userMessage: string): Promise<string> {
    try {
      // Check response cache first (fastest)
      const cachedResponse = responseCache.get(agent.id, userMessage);
      if (cachedResponse) {
        console.log(`⚡ Cache hit para agente ${agent.name}`);
        return cachedResponse;
      }

      // Fallback to local cache
      const cacheKey = `${agent.id}-${userMessage.toLowerCase().substring(0, 50)}`;
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      // Start knowledge context search and OpenAI call preparation in parallel
      const knowledgePromise = this.getKnowledgeContext(agent, userMessage);
      
      let systemContent = agent.systemPrompt;
      
      // Add knowledge base to system prompt
      if (agent.knowledgeBase) {
        systemContent += `\n\nBase de Conhecimento Adicional:\n${agent.knowledgeBase}`;
      }

      const baseMessages: ChatMessage[] = [
        {
          role: "system",
          content: systemContent
        }
      ];

      // Wait for knowledge context with timeout
      let knowledgeContext: string | null = null;
      try {
        knowledgeContext = await Promise.race([
          knowledgePromise,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000)) // 1 second timeout
        ]);
      } catch (error) {
        console.log("Knowledge context timeout, proceeding without it");
        knowledgeContext = null;
      }

      if (knowledgeContext) {
        baseMessages.push({
          role: "system", 
          content: `Documentos da Base de Conhecimento:\n\n${knowledgeContext}`
        });
      }

      baseMessages.push({
        role: "user",
        content: userMessage
      });

      const response = await openaiService.generateResponse(agent, baseMessages);
      
      // Cache successful responses in both caches
      if (response && response.length < 1000) {
        // Response cache (faster, with TTL)
        responseCache.set(agent.id, userMessage, response);
        
        // Local cache (fallback)
        this.cache.set(cacheKey, response);
        if (this.cache.size > 50) {
          const firstKey = this.cache.keys().next().value;
          this.cache.delete(firstKey);
        }
      }
      
      return response;
    } catch (error) {
      console.error("Erro ao testar agente:", error);
      throw new Error("Falha ao gerar resposta do agente");
    }
  }

  async generateConversationResponse(agent: Agent, conversationHistory: ChatMessage[]): Promise<string> {
    try {
      // Se há histórico, extrair a última mensagem do usuário para busca na base de conhecimento
      const lastUserMessage = conversationHistory
        .filter(msg => msg.role === "user")
        .pop()?.content || "";

      const knowledgeContext = await this.getKnowledgeContext(agent, lastUserMessage);
      
      let systemContent = agent.systemPrompt;
      
      // Add knowledge base to system prompt
      if (agent.knowledgeBase) {
        systemContent += `\n\nBase de Conhecimento Adicional:\n${agent.knowledgeBase}`;
      }

      const messages: ChatMessage[] = [];
      
      // Adicionar prompt do sistema
      messages.push({
        role: "system",
        content: systemContent
      });

      // Se há contexto da base de conhecimento, incluir
      if (knowledgeContext) {
        messages.push({
          role: "system",
          content: `Documentos da Base de Conhecimento:\n\n${knowledgeContext}`
        });
      }

      // Adicionar histórico da conversa
      messages.push(...conversationHistory);

      const response = await openaiService.generateResponse(agent, messages);
      return response;
    } catch (error) {
      console.error("Erro ao gerar resposta da conversa:", error);
      throw new Error("Falha ao gerar resposta da conversa");
    }
  }

  private async getKnowledgeContext(agent: Agent, userMessage: string): Promise<string | null> {
    try {
      const ragDocs = await storage.getRagDocumentsByAgent(agent.id);
      
      if (!ragDocs?.length) return null;
      
      // Ultra-fast keyword matching
      const keywords = userMessage.toLowerCase().split(/\s+/).filter(w => w.length > 2).slice(0, 3);
      const keywordSet = new Set(keywords);
      
      // Search through documents with early termination
      for (const doc of ragDocs.slice(0, 5)) { // Limit to first 5 docs for speed
        if (!doc.content) continue;
        
        const content = doc.content.toLowerCase();
        
        // Check if any keyword exists in the document
        for (const keyword of keywordSet) {
          if (content.includes(keyword)) {
            // Return truncated content immediately
            return doc.content.substring(0, 400); // Reduced from 600 for faster processing
          }
        }
      }
      
      return null;
    } catch {
      return null;
    }
  }
}

export const agentService = new AgentService();