import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate embeddings for text using OpenAI
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
      encoding_format: "float",
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('❌ Erro ao gerar embedding:', error);
    throw new Error('Falha ao gerar embedding do texto');
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vetores devem ter o mesmo tamanho');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * Find similar documents using vector similarity
 */
export async function findSimilarDocuments(
  queryEmbedding: number[],
  documents: Array<{ id: number; embedding: number[]; content: string; filename: string }>,
  threshold: number = 0.7,
  limit: number = 5
): Promise<Array<{ id: number; content: string; filename: string; similarity: number }>> {
  const similarities = documents.map(doc => ({
    id: doc.id,
    content: doc.content,
    filename: doc.filename,
    similarity: cosineSimilarity(queryEmbedding, doc.embedding)
  }));

  return similarities
    .filter(doc => doc.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}