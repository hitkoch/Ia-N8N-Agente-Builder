import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import xlsx from 'xlsx';
import { generateEmbedding } from './embedding.js';

export interface ProcessedDocument {
  content: string;
  chunks: Array<{
    content: string;
    embedding: number[];
    chunkIndex: number;
  }>;
  metadata: {
    filename: string;
    fileType: string;
    fileSize: number;
    chunkCount: number;
    processedAt: Date;
  };
}

/**
 * Extract text content from different file types
 */
export async function extractTextFromFile(filePath: string, filename: string): Promise<string> {
  const fileExtension = path.extname(filename).toLowerCase();
  
  try {
    switch (fileExtension) {
      case '.txt':
        return fs.readFileSync(filePath, 'utf-8');
      
      case '.pdf':
        if (!fs.existsSync(filePath)) {
          throw new Error(`Arquivo não encontrado: ${filePath}`);
        }
        const pdfBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(pdfBuffer);
        return pdfData.text;
      
      case '.docx':
        const docxBuffer = fs.readFileSync(filePath);
        const docxResult = await mammoth.extractRawText({ buffer: docxBuffer });
        return docxResult.value;
      
      case '.xlsx':
      case '.xls':
        const workbook = xlsx.readFile(filePath);
        let xlsxText = '';
        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          xlsxText += xlsx.utils.sheet_to_txt(worksheet) + '\n';
        });
        return xlsxText;
      
      default:
        throw new Error(`Tipo de arquivo não suportado: ${fileExtension}`);
    }
  } catch (error) {
    console.error(`❌ Erro ao extrair texto do arquivo ${filename}:`, error);
    throw new Error(`Falha ao processar arquivo ${fileExtension}`);
  }
}

/**
 * Split text into chunks for embedding processing
 */
export function splitTextIntoChunks(text: string, maxChunkSize: number = 1000, overlap: number = 200): string[] {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const chunks: string[] = [];
  let currentChunk = '';
  
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    
    if (currentChunk.length + trimmedSentence.length + 1 <= maxChunkSize) {
      currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk + '.');
        
        // Create overlap by taking last words
        const words = currentChunk.split(' ');
        const overlapWords = Math.min(overlap / 10, words.length);
        currentChunk = words.slice(-overlapWords).join(' ');
      }
      
      if (trimmedSentence.length <= maxChunkSize) {
        currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
      } else {
        // Split very long sentences by words
        const longWords = trimmedSentence.split(' ');
        for (let i = 0; i < longWords.length; i += 100) {
          const wordChunk = longWords.slice(i, i + 100).join(' ');
          chunks.push(wordChunk);
        }
      }
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk + '.');
  }
  
  return chunks.filter(chunk => chunk.trim().length > 0);
}

/**
 * Process a document file and generate embeddings
 */
export async function processDocument(filePath: string, filename: string): Promise<ProcessedDocument> {
  console.log(`📄 Processando documento: ${filename}`);
  
  try {
    // Extract text content
    const content = await extractTextFromFile(filePath, filename);
    
    if (!content || content.trim().length === 0) {
      throw new Error('Arquivo não contém texto válido');
    }
    
    console.log(`📝 Texto extraído: ${content.length} caracteres`);
    
    // Split into chunks
    const textChunks = splitTextIntoChunks(content);
    console.log(`🔄 Dividido em ${textChunks.length} chunks`);
    
    // Generate embeddings for each chunk
    const chunks = [];
    for (let i = 0; i < textChunks.length; i++) {
      console.log(`⚡ Gerando embedding para chunk ${i + 1}/${textChunks.length}`);
      const embedding = await generateEmbedding(textChunks[i]);
      
      chunks.push({
        content: textChunks[i],
        embedding,
        chunkIndex: i
      });
      
      // Small delay to avoid rate limiting
      if (i < textChunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    const fileStats = fs.statSync(filePath);
    
    const processedDocument: ProcessedDocument = {
      content,
      chunks,
      metadata: {
        filename,
        fileType: path.extname(filename).toLowerCase(),
        fileSize: fileStats.size,
        chunkCount: chunks.length,
        processedAt: new Date()
      }
    };
    
    console.log(`✅ Documento processado: ${filename} (${chunks.length} chunks)`);
    return processedDocument;
    
  } catch (error) {
    console.error(`❌ Erro ao processar documento ${filename}:`, error);
    throw error;
  }
}

/**
 * Clean up temporary files
 */
export function cleanupTempFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑️ Arquivo temporário removido: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Erro ao remover arquivo temporário:`, error);
  }
}