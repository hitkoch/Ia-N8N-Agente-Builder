import { Agent } from "@shared/schema";
import { openaiService, ChatMessage } from "./openai";

export class AgentService {
  async testAgent(agent: Agent, userMessage: string): Promise<string> {
    try {
      // Recuperar contexto da base de conhecimento
      const knowledgeContext = await this.getKnowledgeContext(agent, userMessage);
      
      const messages: ChatMessage[] = [
        {
          role: "user",
          content: knowledgeContext ? `Contexto da base de conhecimento:\n${knowledgeContext}\n\nPergunta do usuário: ${userMessage}` : userMessage,
        },
      ];
      
      const response = await openaiService.generateResponse(agent, messages);
      return response;
    } catch (error) {
      console.error("Erro ao testar agente:", error);
      throw new Error("Falha ao processar mensagem do agente");
    }
  }

  async generateConversationResponse(agent: Agent, conversationHistory: ChatMessage[]): Promise<string> {
    try {
      // Se há histórico, pegar a última mensagem do usuário para buscar contexto
      const lastUserMessage = conversationHistory
        .filter(msg => msg.role === 'user')
        .pop()?.content || '';

      const knowledgeContext = await this.getKnowledgeContext(agent, lastUserMessage);

      // Se há contexto relevante, adicionar ao início da conversa
      let enhancedHistory = [...conversationHistory];
      if (knowledgeContext) {
        enhancedHistory = [
          {
            role: "system",
            content: `Base de conhecimento disponível:\n${knowledgeContext}\n\nUse essas informações para responder quando relevante.`
          },
          ...conversationHistory
        ];
      }

      const response = await openaiService.generateResponse(agent, enhancedHistory);
      return response;
    } catch (error) {
      console.error("Erro ao gerar resposta da conversa:", error);
      throw new Error("Falha ao gerar resposta da conversa");
    }
  }

  private async getKnowledgeContext(agent: Agent, userMessage: string): Promise<string | null> {
    if (!agent.ragDocuments || !Array.isArray(agent.ragDocuments) || agent.ragDocuments.length === 0) {
      return null;
    }

    // Simulação de busca semântica (em produção, usaria embeddings)
    const relevantDocs = agent.ragDocuments.filter((doc: any) => {
      if (!doc.content) return false;
      
      const messageWords = userMessage.toLowerCase().split(' ');
      const docContent = doc.content.toLowerCase();
      
      // Verificar se pelo menos 2 palavras da pergunta estão no documento
      const matchingWords = messageWords.filter(word => 
        word.length > 3 && docContent.includes(word)
      );
      
      return matchingWords.length >= Math.min(2, messageWords.length);
    });

    if (relevantDocs.length === 0) {
      return null;
    }

    // Combinar conteúdo dos documentos relevantes
    const context = relevantDocs
      .map((doc: any) => `Documento: ${doc.originalName}\nConteúdo: ${doc.content}`)
      .join('\n\n');

    return context.substring(0, 3000); // Limitar o contexto para não exceder tokens
  }

  validateAgentConfiguration(agent: Partial<Agent>): string[] {
    const errors: string[] = [];

    if (!agent.name || agent.name.trim().length === 0) {
      errors.push("Agent name is required");
    }

    if (!agent.systemPrompt || agent.systemPrompt.trim().length === 0) {
      errors.push("System prompt is required");
    }

    if (agent.temperature !== undefined && (agent.temperature < 0 || agent.temperature > 2)) {
      errors.push("Temperature must be between 0 and 2");
    }

    if (agent.maxTokens !== undefined && (agent.maxTokens < 1 || agent.maxTokens > 4096)) {
      errors.push("Max tokens must be between 1 and 4096");
    }

    if (agent.topP !== undefined && (agent.topP < 0 || agent.topP > 1)) {
      errors.push("Top P must be between 0 and 1");
    }

    return errors;
  }
}

export const agentService = new AgentService();
