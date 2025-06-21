import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { embeddingService } from './embeddings';
import * as pdfParse from 'pdf-parse';

export interface ProcessedDocument {
  filename: string;
  originalName: string;
  content: string;
  embedding?: string;
  fileSize: number;
  mimeType: string;
  processingStatus: 'success' | 'error' | 'unsupported';
  error?: string;
}

export class DocumentProcessor {
  async processFile(fileBuffer: Buffer, filename: string, mimeType: string): Promise<ProcessedDocument> {
    const result: ProcessedDocument = {
      filename,
      originalName: filename,
      fileSize: fileBuffer.length,
      mimeType,
      content: '',
      processingStatus: 'error'
    };

    try {
      console.log(`🔄 Processando arquivo: ${filename}, tipo: ${mimeType}, tamanho: ${fileBuffer.length}`);

      if (mimeType === 'application/pdf' || filename.toLowerCase().endsWith('.pdf')) {
        result.content = await this.processPDF(fileBuffer);
        result.processingStatus = 'success';
      }
      else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
               filename.toLowerCase().endsWith('.docx')) {
        result.content = await this.processDOCX(fileBuffer);
        result.processingStatus = 'success';
      }
      else if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
               mimeType === 'application/vnd.ms-excel' ||
               filename.toLowerCase().endsWith('.xlsx') ||
               filename.toLowerCase().endsWith('.xls')) {
        result.content = await this.processExcel(fileBuffer);
        result.processingStatus = 'success';
      }
      else if (mimeType.startsWith('text/') || 
               filename.toLowerCase().endsWith('.txt') || 
               filename.toLowerCase().endsWith('.md')) {
        result.content = fileBuffer.toString('utf-8');
        result.processingStatus = 'success';
      }
      else {
        result.content = `[FORMATO NÃO SUPORTADO: ${filename}]\n\nTipo de arquivo: ${mimeType}\nTamanho: ${(fileBuffer.length / 1024).toFixed(1)} KB\n\nFormatos suportados: PDF, DOCX, XLSX, XLS, TXT, MD`;
        result.processingStatus = 'unsupported';
      }
    } catch (error) {
      console.error(`❌ Erro ao processar ${filename}:`, error);
      result.content = `[ERRO AO PROCESSAR: ${filename}]\n\nErro: ${error.message}\n\nTente converter o arquivo para um formato mais simples (TXT ou MD).`;
      result.processingStatus = 'error';
      result.error = error.message;
    }

    // Criar embeddings apenas para processamento bem-sucedido
    if (result.processingStatus === 'success' && result.content && result.content.length > 50) {
      try {
        const cleanContent = this.cleanTextForDatabase(result.content);
        result.content = cleanContent;
        
        console.log(`🔮 Criando embeddings para documento com ${cleanContent.length} caracteres`);
        const chunks = await embeddingService.processDocumentForRAG(cleanContent);
        
        if (chunks && chunks.length > 0) {
          result.embedding = JSON.stringify(chunks);
          console.log(`✅ Embeddings criados: ${chunks.length} chunks salvos`);
        }
      } catch (embeddingError) {
        console.error('❌ Falha ao criar embeddings:', embeddingError.message);
      }
    }

    return result;
  }

  private async processPDF(buffer: Buffer): Promise<string> {
    try {
      console.log('📄 Iniciando processamento de PDF, tamanho:', buffer.length);
      
      const data = await pdfParse(buffer);
      console.log('📄 PDF processado:', data.text.length, 'caracteres extraídos');
      
      if (!data.text || data.text.trim().length < 10) {
        throw new Error('PDF não contém texto extraível suficiente');
      }
      
      const cleanedText = this.cleanTextForDatabase(data.text);
      
      if (cleanedText.length < 20) {
        throw new Error('Texto extraído muito curto após limpeza');
      }
      
      console.log('✅ Texto extraído e limpo:', cleanedText.length, 'caracteres');
      return cleanedText;
      
    } catch (error) {
      console.log('❌ Erro no processamento PDF:', error.message);
      throw new Error(`Falha ao processar PDF: ${error.message}`);
    }
  }

  private async processDOCX(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value || '[Documento DOCX vazio]';
    } catch (error) {
      throw new Error(`Erro ao processar DOCX: ${error.message}`);
    }
  }

  private async processExcel(buffer: Buffer): Promise<string> {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      let content = '';
      
      workbook.SheetNames.forEach((sheetName, index) => {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (index > 0) content += '\n\n';
        content += `=== PLANILHA: ${sheetName} ===\n`;
        
        jsonData.forEach((row: any[]) => {
          if (row.length > 0) {
            content += row.join(' | ') + '\n';
          }
        });
      });
      
      return content || '[Planilha vazia]';
    } catch (error) {
      throw new Error(`Erro ao processar Excel: ${error.message}`);
    }
  }

  private cleanTextForDatabase(text: string): string {
    if (!text || text.trim().length === 0) {
      throw new Error('Texto vazio após processamento');
    }
    
    return text
      .replace(/\0/g, '') // Remove null characters
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }
}

export const documentProcessor = new DocumentProcessor();