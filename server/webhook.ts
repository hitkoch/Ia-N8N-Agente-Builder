// Conteúdo completo para o arquivo que define setupWebhookRoutes

import { type Express } from "express";
import { db } from './db';
import { whatsappInstances, agents } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { agentService } from './services/agent';
import { whatsappGatewayService } from './services/whatsapp-gateway';

export const setupWebhookRoutes = (app: Express) => {
  // Rota principal para receber eventos da API Evolution via n8n
  app.post('/api/whatsapp/webhook', async (req, res) => {
    console.log("--- INÍCIO DO PROCESSAMENTO DO WEBHOOK (DRIZZLE) ---");
    const eventData = req.body;

    // Responde imediatamente ao remetente para evitar timeouts
    res.status(200).json({ status: "received", message: "Webhook recebido, processando em segundo plano." });

    // Inicia o processamento assíncrono real
    try {
      if (eventData.event === "MESSAGES_UPSERT" && eventData.data && eventData.data.messages) {
        console.log("[ETAPA 1/5] Evento de nova mensagem detectado.");

        for (const message of eventData.data.messages) {
          if (message.key?.fromMe) continue;
          
          const userMessageText = message.message?.conversation || message.message?.extendedTextMessage?.text || message.message?.imageMessage?.caption;
          const phoneNumber = message.key?.remoteJid?.replace('@s.whatsapp.net', '') || '';

          if (userMessageText && phoneNumber) {
            console.log(`[ETAPA 2/5] Texto extraído: "${userMessageText}". Buscando agente...`);
            
            const results = await db.select({
              agent: agents,
              instance: whatsappInstances
            })
              .from(whatsappInstances)
              .innerJoin(agents, eq(whatsappInstances.agentId, agents.id))
              .where(eq(whatsappInstances.instanceName, eventData.instance))
              .limit(1);

            if (results.length === 0) {
              console.log(`Agente para a instância ${eventData.instance} não foi encontrado.`);
              continue;
            }
            
            const agent = results[0].agent;
            console.log(`[ETAPA 3/5] Agente '${agent.name}' encontrado. Chamando OpenAI...`);

            const responseText = await agentService.testAgent(agent, userMessageText);
            console.log(`[ETAPA 4/5] Resposta da OpenAI recebida. Enviando para o WhatsApp...`);

            await whatsappGatewayService.sendMessage(eventData.instance, phoneNumber, responseText);
            
            console.log("[ETAPA 5/5] Resposta enviada com sucesso para o WhatsApp.");
          } else {
            console.log("Mensagem ignorada: sem conteúdo de texto processável.");
          }
        }
      } else {
        console.log("Evento ignorado (não é uma nova mensagem de usuário ou é do próprio bot).");
      }
    } catch (error) {
      console.error("--- ERRO NO PROCESSAMENTO EM SEGUNDO PLANO DO WEBHOOK ---:", error);
    }
  });

  // Webhook alternativo para compatibilidade
  app.post('/webhook', async (req, res) => {
    res.status(200).json({ status: "received", timestamp: new Date().toISOString() });
    
    try {
      // Redireciona para o processamento principal
      const eventData = req.body;
      if (eventData.event === "MESSAGES_UPSERT" && eventData.data && eventData.data.messages) {
        // Processa da mesma forma que a rota principal
        for (const message of eventData.data.messages) {
          if (message.key?.fromMe) continue;
          
          const userMessageText = message.message?.conversation || message.message?.extendedTextMessage?.text;
          const phoneNumber = message.key?.remoteJid?.replace('@s.whatsapp.net', '') || '';

          if (userMessageText && phoneNumber) {
            const results = await db.select({
              agent: agents,
              instance: whatsappInstances
            })
              .from(whatsappInstances)
              .innerJoin(agents, eq(whatsappInstances.agentId, agents.id))
              .where(eq(whatsappInstances.instanceName, eventData.instance))
              .limit(1);

            if (results.length > 0) {
              const agent = results[0].agent;
              const responseText = await agentService.testAgent(agent, userMessageText);
              await whatsappGatewayService.sendMessage(eventData.instance, phoneNumber, responseText);
            }
          }
        }
      }
    } catch (error) {
      console.error('ERRO NO WEBHOOK ALTERNATIVO:', error);
    }
  });

  console.log("✔️  Rotas de Webhook configuradas.");
};