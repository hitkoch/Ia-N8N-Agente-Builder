import { Agent } from "@shared/schema";
import { openaiService, ChatMessage } from "./openai";
import { storage } from "../storage";

export class AgentService {
  async testAgent(agent: Agent, userMessage: string): Promise<string> {
    try {
      // Recuperar contexto da base de conhecimento de forma otimizada
      const knowledgeContext = await this.getKnowledgeContext(agent, userMessage);
      
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

      // Adicionar mensagem do usuário
      messages.push({
        role: "user",
        content: userMessage
      });

      const response = await openaiService.generateResponse(agent, messages);
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
      console.log('📄 Buscando documentos para o agente:', agent.id);
      const ragDocs = await storage.getRagDocumentsByAgent(agent.id);
      
      if (!ragDocs || ragDocs.length === 0) {
        console.log('📄 Nenhum documento encontrado - prosseguindo sem RAG');
        return null;
      }
      
      console.log(`📄 ${ragDocs.length} documentos encontrados - usando busca otimizada`);
      
      // Busca rápida por palavras-chave
      const keywords = userMessage.toLowerCase().split(' ').filter(word => word.length > 3);
      let bestMatch = null;
      let bestScore = 0;
      
      for (const doc of ragDocs) {
        if (!doc.content) continue;
        
        const content = doc.content.toLowerCase();
        let score = 0;
        
        for (const keyword of keywords) {
          if (content.includes(keyword)) {
            score += keyword.length;
          }
        }
        
        if (score > bestScore) {
          bestScore = score;
          bestMatch = doc;
        }
      }
      
      if (bestMatch && bestScore > 0) {
        console.log(`📄 Documento relevante: ${bestMatch.originalName}`);
        return bestMatch.content.substring(0, 1500);
      }
      
      console.log('📄 Usando resposta geral');
      return null;
    } catch (error) {
      console.error("Erro ao buscar contexto:", error.message);
      return null;
    }
  }
}

export const agentService = new AgentService();