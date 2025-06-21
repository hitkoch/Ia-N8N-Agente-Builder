import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface AudioTranscriptionResult {
  text: string;
  duration: number;
  language?: string;
}

export interface ImageAnalysisResult {
  description: string;
  objects: string[];
  text?: string;
  sentiment?: string;
}

export interface VoiceResponse {
  audioBuffer: Buffer;
  format: string;
  duration: number;
}

export class MultimediaService {
  private tempDir = path.join(process.cwd(), 'temp');

  constructor() {
    // Create temp directory if it doesn't exist
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Transcribe audio to text using OpenAI Whisper
   */
  async transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<AudioTranscriptionResult> {
    try {
      console.log('🎤 Iniciando transcrição de áudio...');
      
      // Save buffer to temporary file
      const extension = this.getAudioExtension(mimeType);
      const tempFileName = `audio_${uuidv4()}.${extension}`;
      const tempFilePath = path.join(this.tempDir, tempFileName);
      
      fs.writeFileSync(tempFilePath, audioBuffer);
      
      console.log(`📁 Áudio salvo temporariamente: ${tempFileName}`);
      
      // Transcribe using OpenAI Whisper
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: "whisper-1",
        language: "pt", // Portuguese
      });
      
      // Clean up temp file
      fs.unlinkSync(tempFilePath);
      
      console.log(`✅ Transcrição concluída: "${transcription.text}"`);
      
      return {
        text: transcription.text,
        duration: 0, // Whisper doesn't return duration
        language: "pt"
      };
      
    } catch (error) {
      console.error('❌ Erro na transcrição de áudio:', error);
      throw new Error(`Falha na transcrição: ${error.message}`);
    }
  }

  /**
   * Analyze image using OpenAI Vision
   */
  async analyzeImage(imageBuffer: Buffer, mimeType: string): Promise<ImageAnalysisResult> {
    try {
      console.log('🖼️ Iniciando análise de imagem...');
      
      // Convert image to base64
      const base64Image = imageBuffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64Image}`;
      
      console.log(`📊 Imagem convertida para base64 (${mimeType})`);
      
      // Analyze using OpenAI Vision
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analise esta imagem detalhadamente em português. Forneça:
                1. Uma descrição geral da imagem
                2. Lista de objetos principais identificados
                3. Qualquer texto visível na imagem
                4. O sentimento ou emoção transmitida

                Responda em formato JSON com as chaves: description, objects, text, sentiment`
              },
              {
                type: "image_url",
                image_url: {
                  url: dataUrl
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        response_format: { type: "json_object" }
      });
      
      const analysisResult = JSON.parse(response.choices[0].message.content);
      
      console.log('✅ Análise de imagem concluída');
      
      return {
        description: analysisResult.description || "Imagem analisada",
        objects: Array.isArray(analysisResult.objects) ? analysisResult.objects : [],
        text: analysisResult.text || undefined,
        sentiment: analysisResult.sentiment || undefined
      };
      
    } catch (error) {
      console.error('❌ Erro na análise de imagem:', error);
      throw new Error(`Falha na análise: ${error.message}`);
    }
  }

  /**
   * Generate voice response using OpenAI TTS
   */
  async generateVoiceResponse(text: string, voice: string = "alloy"): Promise<VoiceResponse> {
    try {
      console.log('🗣️ Gerando resposta em voz...');
      
      // Generate speech using OpenAI TTS
      const mp3 = await openai.audio.speech.create({
        model: "tts-1",
        voice: voice as any, // alloy, echo, fable, onyx, nova, shimmer
        input: text.substring(0, 4096), // TTS has character limit
      });
      
      const audioBuffer = Buffer.from(await mp3.arrayBuffer());
      
      console.log(`✅ Áudio gerado (${audioBuffer.length} bytes)`);
      
      return {
        audioBuffer,
        format: "mp3",
        duration: Math.ceil(text.length / 10) // Rough estimate
      };
      
    } catch (error) {
      console.error('❌ Erro na geração de voz:', error);
      throw new Error(`Falha na síntese: ${error.message}`);
    }
  }

  /**
   * Process multimedia message and generate appropriate response
   */
  async processMultimediaMessage(
    mediaBuffer: Buffer, 
    mimeType: string, 
    caption?: string
  ): Promise<{ text: string; analysis?: any }> {
    try {
      console.log(`📱 Processando mídia: ${mimeType}`);
      
      if (mimeType.startsWith('audio/')) {
        // Process audio
        const transcription = await this.transcribeAudio(mediaBuffer, mimeType);
        
        const combinedText = caption 
          ? `${caption}\n\nÁudio transcrito: "${transcription.text}"`
          : `Áudio transcrito: "${transcription.text}"`;
          
        return {
          text: combinedText,
          analysis: { type: 'audio', transcription }
        };
        
      } else if (mimeType.startsWith('image/')) {
        // Process image
        const imageAnalysis = await this.analyzeImage(mediaBuffer, mimeType);
        
        const combinedText = caption 
          ? `${caption}\n\nImagem: ${imageAnalysis.description}`
          : `Imagem recebida: ${imageAnalysis.description}`;
          
        return {
          text: combinedText,
          analysis: { type: 'image', imageAnalysis }
        };
        
      } else {
        // Unsupported media type
        const fallbackText = caption || "Mídia não suportada recebida.";
        return {
          text: fallbackText,
          analysis: { type: 'unsupported', mimeType }
        };
      }
      
    } catch (error) {
      console.error('❌ Erro no processamento de mídia:', error);
      const fallbackText = caption || "Erro ao processar mídia.";
      return {
        text: fallbackText,
        analysis: { type: 'error', error: error.message }
      };
    }
  }

  /**
   * Get appropriate file extension for audio mime type
   */
  private getAudioExtension(mimeType: string): string {
    const mimeToExtension: { [key: string]: string } = {
      'audio/mpeg': 'mp3',
      'audio/mp3': 'mp3',
      'audio/wav': 'wav',
      'audio/wave': 'wav',
      'audio/x-wav': 'wav',
      'audio/ogg': 'ogg',
      'audio/webm': 'webm',
      'audio/mp4': 'm4a',
      'audio/aac': 'aac'
    };
    
    return mimeToExtension[mimeType] || 'mp3';
  }

  /**
   * Clean up temporary files (call periodically)
   */
  cleanupTempFiles(): void {
    try {
      const files = fs.readdirSync(this.tempDir);
      const now = Date.now();
      const maxAge = 60 * 60 * 1000; // 1 hour
      
      files.forEach(file => {
        const filePath = path.join(this.tempDir, file);
        const stats = fs.statSync(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlinkSync(filePath);
          console.log(`🗑️ Arquivo temporário removido: ${file}`);
        }
      });
    } catch (error) {
      console.error('❌ Erro na limpeza de arquivos temporários:', error);
    }
  }
}

export const multimediaService = new MultimediaService();

// Clean up temp files every hour
setInterval(() => {
  multimediaService.cleanupTempFiles();
}, 60 * 60 * 1000);