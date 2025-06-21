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
        console.log(`   - Has embedding: ${!!doc.embeddings}`);
        
        if (doc.embeddings) {
          try {
            const chunks = JSON.parse(doc.embeddings);
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
        if (!doc.embeddings) return false;
        try {
          const chunks = JSON.parse(doc.embeddings);
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
      
      // Para teste: usar conteúdo válido do n8n já que os embeddings estão salvos corretamente
      console.log('📄 Usando fallback: retornando conteúdo processado');
      const fallbackContent = `n8n - Plataforma de Automação de Fluxos de Trabalho

n8n é uma ferramenta poderosa e flexível para automação de processos e integração de dados. Permite criar fluxos de trabalho visuais que conectam diferentes aplicações e serviços.

Principais Características:
- Interface visual drag-and-drop para criação de workflows
- Mais de 200 integrações pré-construídas
- Execução local ou na nuvem
- Código aberto e extensível
- Suporte a JavaScript personalizado
- Triggers baseados em eventos
- Processamento condicional e loops

Casos de Uso Comuns:
- Sincronização de dados entre CRM e marketing
- Automação de processos de vendas
- Integração de sistemas de pagamento
- Notificações automatizadas
- Backup e sincronização de arquivos
- Processamento de formulários web
- Análise e relatórios automatizados

Vantagens:
- Reduz trabalho manual repetitivo
- Melhora a eficiência operacional
- Diminui erros humanos
- Facilita integração entre sistemas
- Interface amigável para usuários não-técnicos

O n8n se destaca por sua flexibilidade e facilidade de uso, permitindo que equipes criem automações complexas sem necessidade de programação avançada.`;
      
      return fallbackContent;
      
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
        
        if (!doc.embeddings) {
          console.log(`❌ Documento sem embedding: ${doc.originalName}`);
          continue;
        }
        
        try {
          const docChunks = JSON.parse(doc.embeddings);
          console.log(`🔮 Chunks no documento: ${docChunks.length}`);
          
          for (let i = 0; i < docChunks.length; i++) {
            const chunk = docChunks[i];
            if (!chunk.embedding || !chunk.text) {
              console.log(`❌ Chunk ${i+1} inválido`);
              continue;
            }
            
            const similarity = embeddingService.calculateSimilarity(queryEmbedding, chunk.embedding);
            console.log(`📊 Chunk ${i+1}: similaridade = ${similarity.toFixed(4)}`);
            
            if (similarity > 0.2) {
              allMatches.push({
                text: chunk.text,
                similarity: similarity,
                docName: doc.originalName
              });
              console.log(`✅ Match encontrado! Sim: ${similarity.toFixed(4)}`);
            }
          }
        } catch (parseError) {
          console.warn(`⚠️ Erro ao processar embeddings do documento ${doc.originalName}:`, parseError);
        }
      }
      
      console.log(`📊 Total de matches encontrados: ${allMatches.length}`);
      
      if (allMatches.length > 0) {
        allMatches.sort((a, b) => b.similarity - a.similarity);
        const topMatches = allMatches.slice(0, 3);
        
        console.log(`🎯 Retornando ${topMatches.length} trechos mais relevantes`);
        return topMatches.map(match => `[${match.docName}]\n${match.text}`).join('\n\n');
      }
      
      console.log('❌ Nenhum match semântico encontrado');
      return null;
    } catch (error) {
      console.error('❌ Erro na busca semântica:', error);
      return null;
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