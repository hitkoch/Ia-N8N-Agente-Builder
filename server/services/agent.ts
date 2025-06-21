import { Agent } from "@shared/schema";
import { openaiService, ChatMessage } from "./openai";
import { embeddingService } from "./embeddings";
import { storage } from "../storage";

export class AgentService {
  async testAgent(agent: Agent, userMessage: string): Promise<string> {
    try {
      // Recuperar contexto da base de conhecimento
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
      const ragDocs = await storage.getRagDocumentsByAgent(agent.id);
      
      if (!ragDocs || ragDocs.length === 0) {
        console.log('📄 Nenhum documento encontrado na base de conhecimento');
        return null;
      }
      
      console.log('📄 Documentos disponíveis:', ragDocs.length);
      
      // Verificar se temos documentos com embeddings
      const docsWithEmbeddings = ragDocs.filter(doc => doc.embedding);
      
      if (docsWithEmbeddings.length > 0) {
        console.log('🔮 Usando busca semântica com embeddings');
        return await this.getSemanticContext(docsWithEmbeddings, userMessage);
      } else {
        console.log('📝 Usando busca por palavras-chave (fallback)');
        return await this.getKeywordContext(ragDocs, userMessage);
      }
      
    } catch (error) {
      console.error('❌ Erro ao buscar contexto da base de conhecimento:', error);
      return null;
    }
  }
  
  private async getSemanticContext(ragDocs: any[], userMessage: string): Promise<string | null> {
    try {
      // Criar embedding da pergunta do usuário
      const queryEmbedding = await embeddingService.createEmbedding(userMessage);
      
      let allRelevantChunks: { text: string; similarity: number; docName: string }[] = [];
      
      // Buscar chunks similares em todos os documentos
      for (const doc of ragDocs) {
        if (!doc.embedding) continue;
        
        try {
          const docChunks = JSON.parse(doc.embedding);
          const similarChunks = await embeddingService.findSimilarChunks(queryEmbedding, docChunks, 3);
          
          // Adicionar nome do documento aos chunks
          const chunksWithDoc = similarChunks.map(chunk => ({
            ...chunk,
            docName: doc.originalName
          }));
          
          allRelevantChunks.push(...chunksWithDoc);
        } catch (parseError) {
          console.warn(`⚠️ Erro ao processar embeddings do documento ${doc.originalName}:`, parseError);
        }
      }
      
      if (allRelevantChunks.length === 0) {
        console.log('📄 Nenhum chunk relevante encontrado');
        return null;
      }
      
      // Ordenar por similaridade e pegar os melhores
      allRelevantChunks.sort((a, b) => b.similarity - a.similarity);
      const topChunks = allRelevantChunks.slice(0, 5);
      
      // Filtrar apenas chunks com similaridade razoável
      const relevantChunks = topChunks.filter(chunk => chunk.similarity > 0.3);
      
      if (relevantChunks.length === 0) {
        console.log('📄 Nenhum chunk com similaridade suficiente encontrado');
        return null;
      }
      
      console.log(`✅ Encontrados ${relevantChunks.length} chunks relevantes`);
      
      // Combinar os chunks mais relevantes
      const combinedContent = relevantChunks
        .map(chunk => `=== ${chunk.docName} ===\n${chunk.text}`)
        .join('\n\n---\n\n');
      
      console.log('📋 Contexto semântico criado com', combinedContent.length, 'caracteres');
      return combinedContent;
      
    } catch (error) {
      console.error('❌ Erro na busca semântica:', error);
      // Fallback para busca por palavras-chave
      return await this.getKeywordContext(ragDocs, userMessage);
    }
  }
  
  private async getKeywordContext(ragDocs: any[], userMessage: string): Promise<string | null> {
    const messageWords = userMessage.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    
    const relevantDocs = ragDocs.filter(doc => {
      const docContent = doc.content.toLowerCase();
      
      // Ignorar arquivos não processados
      if (docContent.includes('[arquivo não processado]') || 
          docContent.includes('[formato não suportado]') ||
          docContent.includes('[erro ao processar]') ||
          docContent.includes('[PDF DETECTADO:')) {
        console.log(`⚠️ ${doc.originalName}: arquivo não processado, ignorando`);
        return false;
      }
      
      // Calcular relevância baseada em palavras-chave
      const keyWords = messageWords.filter(word => word.length > 2);
      const matchCount = keyWords.filter(keyword => docContent.includes(keyword)).length;
      const relevanceScore = matchCount / keyWords.length;
      
      console.log(`📄 ${doc.originalName}: ${relevanceScore > 0.1 ? '✅ relevante' : '❌ não relevante'}`);
      return relevanceScore > 0.1;
    });
    
    if (relevantDocs.length === 0) {
      console.log('📄 Nenhum documento relevante encontrado');
      return null;
    }
    
    console.log(`✅ Encontrados ${relevantDocs.length} documentos relevantes`);
    
    const combinedContent = relevantDocs
      .map(doc => `=== ${doc.originalName} ===\n${doc.content}`)
      .join('\n\n---\n\n');
    
    const maxContextLength = 3000;
    const truncatedContent = combinedContent.length > maxContextLength
      ? combinedContent.substring(0, maxContextLength) + '...'
      : combinedContent;
    
    console.log('📋 Contexto criado com', truncatedContent.length, 'caracteres');
    return truncatedContent;
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