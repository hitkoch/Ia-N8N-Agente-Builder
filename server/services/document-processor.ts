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
    
    try {
      // Usar pdf-parse que é mais estável
      const pdfParse = require('pdf-parse');
      
      const options = {
        // Configurações para melhor extração
        max: 0, // Processar todas as páginas
        version: 'v1.10.100' // Versão específica do PDF.js
      };
      
      const data = await pdfParse(buffer, options);
      
      console.log('📄 PDF processado com sucesso');
      console.log('📄 Páginas:', data.numpages);
      console.log('📄 Texto extraído:', data.text.length, 'caracteres');
      console.log('📄 Primeiros 200 caracteres:', data.text.substring(0, 200));
      
      if (data.text && data.text.trim().length > 20) {
        // Limpar o texto extraído
        const cleanText = data.text
          .replace(/\s+/g, ' ') // Normalizar espaços
          .replace(/\n+/g, '\n') // Normalizar quebras de linha
          .trim();
        
        return cleanText;
      }
      
      throw new Error('Texto insuficiente extraído do PDF');
      
    } catch (error) {
      console.log('📄 Erro ao processar PDF:', error.message);
      
      // Fallback: tentar extração manual simples
      try {
        console.log('📄 Tentando extração manual...');
        const pdfString = buffer.toString('latin1');
        
        // Extrair texto básico
        const textMatches = pdfString.match(/\(([^)]+)\)/g);
        if (textMatches) {
          const extractedText = textMatches
            .map(match => match.slice(1, -1))
            .filter(text => text.length > 2 && /[a-zA-ZÀ-ÿ]/.test(text))
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          if (extractedText.length > 20) {
            console.log('📄 Extração manual bem-sucedida:', extractedText.length, 'caracteres');
            return extractedText;
          }
        }
      } catch (fallbackError) {
        console.log('📄 Extração manual também falhou:', fallbackError.message);
      }
      
      // Último recurso: retornar informações sobre o PDF
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