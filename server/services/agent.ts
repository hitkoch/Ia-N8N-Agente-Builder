import { Agent } from "@shared/schema";
import { openaiService, ChatMessage } from "./openai";

export class AgentService {
  async testAgent(agent: Agent, userMessage: string): Promise<string> {
    try {
      // Recuperar contexto da base de conhecimento
      const knowledgeContext = await this.getKnowledgeContext(agent, userMessage);
      
      const messages: ChatMessage[] = [];
      
      if (knowledgeContext) {
        messages.push({
          role: "system",
          content: `IMPORTANTE: Use as informações da base de conhecimento abaixo para responder às perguntas do usuário. Se a pergunta se relacionar com essas informações, priorize-as na sua resposta.\n\n${knowledgeContext}`
        });
      }
      
      messages.push({
        role: "user",
        content: userMessage,
      });
      
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
    console.log("🔍 Buscando contexto para:", userMessage);
    console.log("📄 Documentos disponíveis:", agent.ragDocuments?.length || 0);
    
    if (!agent.ragDocuments || !Array.isArray(agent.ragDocuments) || agent.ragDocuments.length === 0) {
      console.log("❌ Nenhum documento na base de conhecimento");
      return null;
    }

    // Busca mais flexível
    const relevantDocs = agent.ragDocuments.filter((doc: any) => {
      if (!doc.content) {
        console.log("⚠️ Documento sem conteúdo:", doc.originalName);
        return false;
      }
      
      const messageWords = userMessage.toLowerCase().split(/\s+/);
      const docContent = doc.content.toLowerCase();
      
      // Palavras-chave específicas para melhor busca
      const keyWords = messageWords.filter(word => word.length > 2);
      
      // Verificar se alguma palavra da pergunta está no documento
      const hasRelevantContent = keyWords.some(word => docContent.includes(word)) ||
        docContent.includes('empresa') ||
        docContent.includes('suporte') ||
        docContent.includes('produto') ||
        docContent.includes('contato') ||
        docContent.includes('treinamento');
      
      console.log(`📄 ${doc.originalName}: ${hasRelevantContent ? '✅ relevante' : '❌ não relevante'}`);
      return hasRelevantContent;
    });

    if (relevantDocs.length === 0) {
      console.log("❌ Nenhum documento relevante encontrado");
      return null;
    }

    console.log(`✅ Encontrados ${relevantDocs.length} documentos relevantes`);

    // Combinar conteúdo dos documentos relevantes
    const context = relevantDocs
      .map((doc: any) => `[Documento: ${doc.originalName}]\n${doc.content}`)
      .join('\n\n---\n\n');

    const finalContext = context.substring(0, 4000);
    console.log("📋 Contexto criado com", finalContext.length, "caracteres");
    
    return finalContext;
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
