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
      console.log('🔍 Iniciando busca RAG para agente:', agent.id);
      const ragDocs = await storage.getRagDocumentsByAgent(agent.id);
      
      if (!ragDocs || ragDocs.length === 0) {
        console.log('📄 Nenhum documento RAG encontrado');
        return null;
      }
      
      console.log(`📄 Encontrados ${ragDocs.length} documentos RAG`);
      
      // Busca por palavras-chave com scoring melhorado
      const keywords = userMessage.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 2)
        .slice(0, 10); // Limitar para performance
      
      let bestMatch = null;
      let bestScore = 0;
      
      for (const doc of ragDocs) {
        if (!doc.content) {
          console.log(`⚠️ Documento ${doc.originalName} sem conteúdo`);
          continue;
        }
        
        const content = doc.content.toLowerCase();
        let score = 0;
        
        // Busca por palavras-chave
        for (const keyword of keywords) {
          const matches = (content.match(new RegExp(keyword, 'gi')) || []).length;
          score += matches * keyword.length;
        }
        
        // Bonus para documentos com títulos relevantes
        if (doc.originalName && doc.originalName.toLowerCase().includes(userMessage.toLowerCase().substring(0, 20))) {
          score += 50;
        }
        
        console.log(`📊 Documento ${doc.originalName}: score ${score}`);
        
        if (score > bestScore) {
          bestScore = score;
          bestMatch = doc;
        }
      }
      
      if (bestMatch && bestScore > 0) {
        console.log(`✅ Melhor documento: ${bestMatch.originalName} (score: ${bestScore})`);
        // Retornar conteúdo limitado para otimizar performance
        const contextLength = Math.min(2000, bestMatch.content.length);
        return bestMatch.content.substring(0, contextLength);
      }
      
      console.log('❌ Nenhum documento relevante encontrado');
      return null;
    } catch (error) {
      console.error("❌ Erro no sistema RAG:", error);
      return null;
    }
  }
}

export const agentService = new AgentService();