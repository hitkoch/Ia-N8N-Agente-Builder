import { Agent } from "@shared/schema";
import { openaiService, ChatMessage } from "./openai";
import { storage } from "../storage";

export class AgentService {
  private cache = new Map();

  async testAgent(agent: Agent, userMessage: string): Promise<string> {
    try {
      // Cache key for repeated queries
      const cacheKey = `${agent.id}-${userMessage.toLowerCase()}`;
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      // Parallel execution for maximum speed
      const [knowledgeContext] = await Promise.all([
        this.getKnowledgeContext(agent, userMessage)
      ]);
      
      const messages: ChatMessage[] = [
        {
          role: "system",
          content: agent.systemPrompt
        }
      ];

      if (knowledgeContext) {
        messages.push({
          role: "system", 
          content: `Base de Conhecimento:\n\n${knowledgeContext}`
        });
      }

      messages.push({
        role: "user",
        content: userMessage
      });

      const response = await openaiService.generateResponse(agent, messages);
      
      // Cache successful responses
      this.cache.set(cacheKey, response);
      if (this.cache.size > 100) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
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
      
      const messages: ChatMessage[] = [];
      
      // Adicionar prompt do sistema
      messages.push({
        role: "system",
        content: agent.systemPrompt
      });

      // Se há contexto da base de conhecimento, incluir
      if (knowledgeContext) {
        messages.push({
          role: "system",
          content: `Base de Conhecimento:\n\n${knowledgeContext}`
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
      
      // Busca otimizada para máxima velocidade
      const words = userMessage.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      
      for (const doc of ragDocs) {
        if (!doc.content) continue;
        
        const content = doc.content.toLowerCase();
        
        // Primeira palavra encontrada = retorna imediatamente
        for (const word of words.slice(0, 2)) {
          if (content.includes(word)) {
            return doc.content.substring(0, 600);
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