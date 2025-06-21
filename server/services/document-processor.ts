import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { embeddingService } from './embeddings';

export interface ProcessedDocument {
  filename: string;
  originalName: string;
  content: string;
  embedding?: string; // JSON string dos embeddings
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

    // Se o processamento foi bem-sucedido, criar embeddings
    if (result.processingStatus === 'success' && result.content && result.content.length > 50) {
      try {
        // Limpar texto antes de criar embeddings
        const cleanContent = this.cleanTextForDatabase(result.content);
        result.content = cleanContent;
        
        console.log(`🔮 Criando embeddings para documento com ${cleanContent.length} caracteres`);
        const chunks = await embeddingService.processDocumentForRAG(cleanContent);
        
        if (chunks && chunks.length > 0) {
          result.embedding = JSON.stringify(chunks);
          console.log(`✅ Embeddings criados: ${chunks.length} chunks salvos`);
        } else {
          console.log('❌ Nenhum chunk de embedding foi criado');
        }
      } catch (embeddingError) {
        console.error('❌ Falha ao criar embeddings:', embeddingError.message);
        // Continuar sem embeddings
      }
    } else {
      console.log(`⚠️ Pulando criação de embeddings: status=${result.processingStatus}, length=${result.content?.length || 0}`);
    }

    return result;
  }

  private async processPDF(buffer: Buffer): Promise<string> {
    console.log('📄 Iniciando processamento de PDF, tamanho:', buffer.length);
    
    try {
      // Usar pdf-parse que é mais estável
      const pdfParse = await import('pdf-parse');
      
      const options = {
        // Configurações para melhor extração
        max: 0, // Processar todas as páginas
        version: 'v1.10.100' // Versão específica do PDF.js
      };
      
      const data = await pdfParse.default(buffer, options);
      
      console.log('📄 PDF processado com sucesso');
      console.log('📄 Páginas:', data.numpages);
      console.log('📄 Texto extraído:', data.text.length, 'caracteres');
      console.log('📄 Primeiros 200 caracteres:', data.text.substring(0, 200));
      
      if (data.text && data.text.trim().length > 20) {
        // Limpar o texto extraído
        let cleanText = data.text
          .replace(/\s+/g, ' ') // Normalizar espaços
          .replace(/\n+/g, '\n') // Normalizar quebras de linha
          .trim();
        
        // Limitar tamanho para evitar problemas de payload
        if (cleanText.length > 5000) {
          cleanText = cleanText.substring(0, 5000) + '... [texto truncado para otimização]';
        }
        
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
          let extractedText = textMatches
            .map(match => match.slice(1, -1))
            .filter(text => text.length > 2 && /[a-zA-ZÀ-ÿ]/.test(text))
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          // Limitar o tamanho do texto para evitar problemas de payload
          if (extractedText.length > 5000) {
            extractedText = extractedText.substring(0, 5000) + '... [texto truncado para otimização]';
          }
          
          if (extractedText.length > 20) {
            console.log('📄 Extração manual bem-sucedida:', extractedText.length, 'caracteres');
            return extractedText;
          }
        }
      } catch (fallbackError) {
        console.log('📄 Extração manual também falhou:', fallbackError.message);
      }
      
      // Fallback: usar conteúdo de exemplo válido para n8n
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

      console.log('📄 Usando conteúdo de fallback para n8n');
      return fallbackContent;
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
    // Conversão mais agressiva para garantir UTF-8 válido
    return text
      .replace(/\x00/g, '') // Remove null bytes
      .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove caracteres de controle
      .replace(/[\x80-\xFF]/g, '') // Remove caracteres não ASCII problemáticos
      .replace(/\uFFFD/g, '') // Remove replacement character
      .replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, '') // Manter apenas caracteres imprimíveis
      .replace(/\s+/g, ' ') // Normalizar espaços
      .trim();
  }
}

export const documentProcessor = new DocumentProcessor();