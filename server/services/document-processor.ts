import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';

export interface ProcessedDocument {
  filename: string;
  originalName: string;
  content: string;
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
      content: '',
      fileSize: fileBuffer.length,
      mimeType,
      processingStatus: 'error'
    };

    try {
      console.log(`🔄 Processando arquivo: ${filename}, tipo: ${mimeType}, tamanho: ${fileBuffer.length}`);
      
      if (mimeType === 'application/pdf' || filename.toLowerCase().endsWith('.pdf')) {
        result.content = await this.processPDF(fileBuffer);
        result.processingStatus = result.content.includes('[PDF DETECTADO:') ? 'unsupported' : 'success';
      } 
      else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
               filename.toLowerCase().endsWith('.docx')) {
        result.content = await this.processDOCX(fileBuffer);
        result.processingStatus = 'success';
      }
      else if (mimeType === 'application/msword' || filename.toLowerCase().endsWith('.doc')) {
        result.content = `[FORMATO DOC NÃO SUPORTADO: ${filename}]\n\nArquivos .doc (Word 97-2003) não são suportados atualmente.\nPor favor, converta para .docx ou .txt para processamento automático.`;
        result.processingStatus = 'unsupported';
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
      console.error(`❌ Erro geral ao processar ${filename}:`, error);
      result.content = `[ERRO AO PROCESSAR: ${filename}]\n\nErro: ${error.message}\n\nTente converter o arquivo para um formato mais simples (TXT ou MD).`;
      result.processingStatus = 'error';
      result.error = error.message;
    }

    return result;
  }

  private async processPDF(buffer: Buffer): Promise<string> {
    console.log('📄 Iniciando processamento de PDF, tamanho:', buffer.length);
    
    // Estratégia simplificada: extrair texto básico diretamente do buffer
    try {
      const pdfString = buffer.toString('latin1');
      
      // Procurar por padrões de texto em PDFs
      const textMatches = pdfString.match(/\(([^)]+)\)/g);
      const streamMatches = pdfString.match(/stream\s*(.*?)\s*endstream/gs);
      
      let extractedText = '';
      
      // Extrair texto de strings em parênteses (método básico)
      if (textMatches) {
        const cleanTexts = textMatches
          .map(match => match.slice(1, -1)) // Remove parênteses
          .filter(text => text.length > 2 && /[a-zA-ZÀ-ÿ]/.test(text)) // Filtra textos válidos
          .filter(text => !text.includes('\\') || text.includes(' ')) // Remove códigos de controle
          .join(' ');
        
        extractedText += cleanTexts;
      }
      
      // Tentar extrair de streams de texto (método avançado)
      if (streamMatches && extractedText.length < 100) {
        for (const stream of streamMatches) {
          const streamContent = stream.replace(/^stream\s*/, '').replace(/\s*endstream$/, '');
          // Procurar por texto legível no stream
          const readableText = streamContent.match(/[a-zA-ZÀ-ÿ\s]{10,}/g);
          if (readableText) {
            extractedText += ' ' + readableText.join(' ');
          }
        }
      }
      
      // Limpar e formatar o texto extraído
      extractedText = extractedText
        .replace(/\s+/g, ' ')
        .replace(/[^\w\sÀ-ÿ.,!?;:()\-]/g, '')
        .trim();
      
      console.log('📄 Texto extraído do PDF:', extractedText.length, 'caracteres');
      
      if (extractedText.length > 50) {
        return extractedText;
      }
      
      // Se não conseguiu extrair texto suficiente, usar fallback
      throw new Error('Texto insuficiente extraído');
      
    } catch (error) {
      console.log('📄 Extração direta falhou, usando fallback informativo');
      
      // Fallback: retornar conteúdo processável ao invés de falhar
      return `[PDF DETECTADO: ${buffer.length} bytes]

Este é um arquivo PDF que foi carregado no sistema.
O processamento automático de texto não está disponível no momento.

Para usar este conteúdo:
1. Extraia o texto manualmente do PDF
2. Cole o conteúdo relevante em um arquivo TXT
3. Faça upload do arquivo TXT

Informações do arquivo:
- Tamanho: ${(buffer.length / 1024).toFixed(1)} KB
- Formato: PDF`;
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
}

export const documentProcessor = new DocumentProcessor();