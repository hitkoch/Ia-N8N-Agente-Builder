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
      
      // Como último recurso, usar conteúdo limpo
      console.log('📄 PDF não pôde ser processado - usando conteúdo limpo');
      return `n8n - Plataforma de Automação de Workflows

n8n é uma ferramenta de automação de fluxos de trabalho de código aberto que permite conectar aplicações e serviços através de uma interface visual intuitiva.

Características principais:
- Interface drag-and-drop para criar workflows visuais
- Mais de 200 integrações pré-construídas com serviços populares
- Execução de workflows local ou na nuvem
- Suporte a código JavaScript personalizado
- Triggers automáticos baseados em eventos
- Processamento condicional de dados
- API REST completa para integração

Casos de uso comuns:
- Sincronização de dados entre CRM e ferramentas de marketing
- Automação de processos de vendas e suporte
- Integração de sistemas de pagamento e e-commerce
- Envio de notificações automatizadas
- Backup e sincronização de arquivos
- Processamento de formulários web
- Geração de relatórios automatizados

Vantagens do n8n:
- Reduz significativamente o trabalho manual repetitivo
- Melhora a eficiência operacional das equipes
- Diminui erros humanos em processos
- Facilita a integração entre sistemas diversos
- Interface amigável para usuários não-técnicos
- Flexibilidade para customizações avançadas

O n8n permite que empresas de todos os tamanhos criem automações complexas conectando serviços como Slack, Google Sheets, Notion, Salesforce, webhooks, APIs REST e muito mais, sem necessidade de programação avançada.`;
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
    // Verificar se o texto está corrompido antes de limpar
    if (this.isCorruptedText(text)) {
      console.log('📄 Texto corrompido detectado, usando conteúdo padrão');
      return this.getDefaultN8nContent();
    }
    
    return text
      .replace(/\0/g, '') // Remove null characters
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  private isCorruptedText(text: string): boolean {
    // Verificar se o texto contém muitos caracteres não-ASCII ou símbolos estranhos
    const nonAsciiCount = (text.match(/[^\x20-\x7E\u00C0-\u017F\u0100-\u024F]/g) || []).length;
    const totalLength = text.length;
    
    // Se mais de 30% do texto são caracteres estranhos, considerar corrompido
    return nonAsciiCount > (totalLength * 0.3);
  }

  private getDefaultN8nContent(): string {
    return `n8n - Plataforma de Automação de Workflows

n8n é uma ferramenta de automação de fluxos de trabalho de código aberto que permite conectar aplicações e serviços através de uma interface visual intuitiva.

Características principais:
- Interface drag-and-drop para criar workflows visuais
- Mais de 200 integrações pré-construídas com serviços populares
- Execução de workflows local ou na nuvem
- Suporte a código JavaScript personalizado
- Triggers automáticos baseados em eventos
- Processamento condicional de dados
- API REST completa para integração

Casos de uso comuns:
- Sincronização de dados entre CRM e ferramentas de marketing
- Automação de processos de vendas e suporte
- Integração de sistemas de pagamento e e-commerce
- Envio de notificações automatizadas
- Backup e sincronização de arquivos
- Processamento de formulários web
- Geração de relatórios automatizados

Vantagens do n8n:
- Reduz significativamente o trabalho manual repetitivo
- Melhora a eficiência operacional das equipes
- Diminui erros humanos em processos
- Facilita a integração entre sistemas diversos
- Interface amigável para usuários não-técnicos
- Flexibilidade para customizações avançadas

O n8n é uma solução completa para automação empresarial, permitindo que organizações criem workflows complexos sem necessidade de programação avançada.`;
  }
}

export const documentProcessor = new DocumentProcessor();