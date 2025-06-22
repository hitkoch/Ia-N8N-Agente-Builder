import OpenAI from "openai";
import { Agent } from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR 
});

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export class OpenAIService {
  async generateResponse(agent: Agent, messages: ChatMessage[]): Promise<string> {
    try {
      // Don't duplicate system message if it's already in messages
      const hasSystemMessage = messages.some(msg => msg.role === "system");
      const finalMessages = hasSystemMessage ? messages : [
        { role: "system", content: agent.systemPrompt },
        ...messages
      ];

      const response = await openai.chat.completions.create({
        model: agent.model === "gpt-4" ? "gpt-4o-mini" : (agent.model || "gpt-4o-mini"), // Use faster mini model for speed
        messages: finalMessages,
        temperature: agent.temperature || 0.7,
        max_tokens: Math.min(agent.maxTokens || 500, 500), // Limit tokens for faster response
        top_p: agent.topP || 1,
        stream: false, // Ensure no streaming for consistent timing
      });

      return response.choices[0]?.message?.content || "Desculpe, não consegui gerar uma resposta no momento.";
    } catch (error) {
      console.error("OpenAI API error:", error);
      throw new Error("Falha ao gerar resposta da IA. Verifique a configuração da API.");
    }
  }

  async generateResponseWithImage(agent: Agent, systemPrompt: string, userMessage: string, imageBase64: string): Promise<string> {
    if (!openai) {
      throw new Error("OpenAI não está configurada. Verifique a variável OPENAI_API_KEY.");
    }

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: userMessage
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: agent.maxTokens || 1000,
        temperature: agent.temperature || 0.7,
      });

      return completion.choices[0]?.message?.content || "Desculpe, não consegui processar sua imagem.";
    } catch (error) {
      console.error("Erro ao chamar OpenAI com imagem:", error);
      throw new Error("Falha ao processar imagem com IA");
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await openai.models.list();
      return true;
    } catch (error) {
      console.error("OpenAI connection test failed:", error);
      return false;
    }
  }
}

export const openaiService = new OpenAIService();
