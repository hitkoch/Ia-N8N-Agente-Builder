import OpenAI from 'openai';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

export class EmbeddingService {
  async createEmbedding(text: string): Promise<number[]> {
    try {
      console.log('🔮 Criando embedding para texto de', text.length, 'caracteres');
      
      // Limitar o tamanho do texto para o modelo de embedding
      const maxLength = 8000; // Limite seguro para embeddings
      const limitedText = text.length > maxLength ? text.substring(0, maxLength) : text;
      
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small", // Modelo mais moderno e eficiente
        input: limitedText,
        dimensions: 1536, // Dimensões específicas para melhor qualidade
      });
      
      console.log('✅ Embedding criado com sucesso');
      return response.data[0].embedding;
    } catch (error) {
      console.error('❌ Erro ao criar embedding:', error);
      throw new Error(`Falha ao criar embedding: ${error.message}`);
    }
  }
  
  async processDocumentForRAG(content: string, chunkSize: number = 1000): Promise<{ text: string; embedding: number[] }[]> {
    try {
      console.log('📝 Processando documento para RAG');
      
      // Dividir o texto em chunks menores para melhor busca
      const chunks = this.chunkText(content, chunkSize);
      console.log('📄 Documento dividido em', chunks.length, 'chunks');
      
      const processedChunks = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`🔄 Processando chunk ${i + 1}/${chunks.length}`);
        
        const embedding = await this.createEmbedding(chunk);
        processedChunks.push({
          text: chunk,
          embedding: embedding
        });
        
        // Pequena pausa para não sobrecarregar a API
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      console.log('✅ Documento processado para RAG com', processedChunks.length, 'chunks');
      return processedChunks;
    } catch (error) {
      console.error('❌ Erro ao processar documento para RAG:', error);
      throw error;
    }
  }
  
  private chunkText(text: string, chunkSize: number): string[] {
    const chunks = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    let currentChunk = '';
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      
      if (currentChunk.length + trimmedSentence.length + 2 <= chunkSize) {
        currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk + '.');
        }
        currentChunk = trimmedSentence;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk + '.');
    }
    
    return chunks.filter(chunk => chunk.length > 10); // Filtrar chunks muito pequenos
  }
  
  calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings devem ter o mesmo tamanho');
    }
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }
  
  async findSimilarChunks(
    queryEmbedding: number[], 
    documentEmbeddings: { text: string; embedding: number[] }[], 
    topK: number = 3
  ): Promise<{ text: string; similarity: number }[]> {
    console.log('🔍 Buscando chunks similares');
    
    const similarities = documentEmbeddings.map(doc => ({
      text: doc.text,
      similarity: this.calculateSimilarity(queryEmbedding, doc.embedding)
    }));
    
    // Ordenar por similaridade (maior primeiro) e retornar os top K
    const topChunks = similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
    
    console.log('📊 Top', topK, 'chunks encontrados com similaridades:', 
      topChunks.map(c => c.similarity.toFixed(3)).join(', '));
    
    return topChunks;
  }
}

export const embeddingService = new EmbeddingService();