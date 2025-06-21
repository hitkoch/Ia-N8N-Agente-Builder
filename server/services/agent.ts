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
      
      console.log(`📄 Documentos disponíveis: ${ragDocs.length}`);
      
      // Debug completo dos documentos
      for (const doc of ragDocs) {
        console.log(`📄 Documento: ${doc.originalName}`);
        console.log(`   - ID: ${doc.id}`);
        console.log(`   - Conteúdo: ${doc.content ? doc.content.length : 0} caracteres`);
        console.log(`   - Has embedding: ${!!doc.embedding}`);
        
        if (doc.embedding) {
          try {
            const chunks = JSON.parse(doc.embedding);
            console.log(`   - Chunks: ${chunks.length}`);
            if (chunks.length > 0) {
              console.log(`   - Primeiro chunk: ${chunks[0].text?.substring(0, 100)}...`);
              console.log(`   - Embedding length: ${chunks[0].embedding?.length || 0}`);
            }
          } catch (e) {
            console.log(`   - Erro ao parsear embedding: ${e.message}`);
          }
        }
      }
      
      // Verificar se temos documentos com embeddings válidos
      const docsWithEmbeddings = ragDocs.filter(doc => {
        if (!doc.embedding) return false;
        try {
          const chunks = JSON.parse(doc.embedding);
          return chunks && chunks.length > 0 && chunks[0].embedding;
        } catch {
          return false;
        }
      });
      
      console.log(`🔮 Documentos com embeddings válidos: ${docsWithEmbeddings.length}`);
      
      if (docsWithEmbeddings.length > 0) {
        console.log('🔍 Iniciando busca semântica');
        const semanticResult = await this.getSemanticContext(docsWithEmbeddings, userMessage);
        if (semanticResult) {
          console.log('✅ Busca semântica encontrou resultado');
          return semanticResult;
        }
        console.log('❌ Busca semântica não encontrou resultado relevante');
      }
      
      // Fallback: retornar todo o conteúdo dos documentos
      console.log('📄 Usando fallback: retornando conteúdo completo');
      const allContent = ragDocs
        .filter(doc => {
          const validContent = doc.content && 
                              !doc.content.includes('[ERRO') && 
                              !doc.content.includes('[FORMATO NÃO SUPORTADO') &&
                              doc.content.length > 50 &&
                              doc.content.includes('n8n') // Conteúdo relevante para teste
          console.log(`📄 ${doc.originalName}: ${validContent ? 'válido' : 'inválido'}`);
          return validContent;
        })
        .map(doc => `=== ${doc.originalName} ===\n${doc.content.substring(0, 2000)}`) // Limitar tamanho
        .join('\n\n---\n\n');
      
      console.log(`📄 Conteúdo final: ${allContent.length} caracteres`);
      return allContent.length > 0 ? allContent : null;
      
    } catch (error) {
      console.error('❌ Erro ao buscar contexto da base de conhecimento:', error);
      return null;
    }
  }
  
  private async getSemanticContext(ragDocs: any[], userMessage: string): Promise<string | null> {
    try {
      console.log('🔮 Criando embedding da consulta...');
      const queryEmbedding = await embeddingService.createEmbedding(userMessage);
      console.log(`🔮 Embedding criado: ${queryEmbedding.length} dimensões`);
      
      let allMatches: { text: string; similarity: number; docName: string }[] = [];
      
      // Buscar em todos os documentos
      for (const doc of ragDocs) {
        console.log(`📄 Processando documento: ${doc.originalName}`);
        
        if (!doc.embedding) {
          console.log(`❌ Documento sem embedding: ${doc.originalName}`);
          continue;
        }
        
        try {
          const docChunks = JSON.parse(doc.embedding);
          console.log(`🔮 Chunks no documento: ${docChunks.length}`);
          
          for (let i = 0; i < docChunks.length; i++) {
            const chunk = docChunks[i];
            if (!chunk.embedding || !chunk.text) {
              console.log(`❌ Chunk ${i+1} inválido`);
              continue;
            }
            
            const similarity = embeddingService.calculateSimilarity(queryEmbedding, chunk.embedding);
            console.log(`📊 Chunk ${i+1}: similaridade = ${similarity.toFixed(4)}`);
            
            if (similarity > 0.2) { // Threshold bem baixo para capturar tudo
              allMatches.push({
                text: chunk.text,
                similarity: similarity,
                docName: doc.originalName
              });
              console.log(`✅ Match encontrado! Sim: ${similarity.toFixed(4)}`);
            }
          }
          
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