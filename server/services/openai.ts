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
      const systemMessage: ChatMessage = {
        role: "system",
        content: agent.systemPrompt,
      };

      const allMessages = [systemMessage, ...messages];

      const response = await openai.chat.completions.create({
        model: agent.model === "gpt-4" ? "gpt-4o" : agent.model,
        messages: allMessages,
        temperature: agent.temperature,
        max_tokens: agent.maxTokens,
        top_p: agent.topP,
      });

      return response.choices[0]?.message?.content || "I apologize, but I couldn't generate a response.";
    } catch (error) {
      console.error("OpenAI API error:", error);
      throw new Error("Failed to generate AI response. Please check your API configuration.");
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
