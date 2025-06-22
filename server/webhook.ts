// Substitua todo o conteúdo de server/webhook.ts por este código:

import type { Express, Request, Response } from "express";
import { agentService } from "./services/agent";
import { whatsappGatewayService } from "./services/whatsapp-gateway";
import { webhookOptimizer } from "./webhook-optimizer";
import { performanceMonitor } from "./middleware/performance-monitor";
import { db } from './db';
import { whatsappInstances, agents } from '../shared/schema';
import { eq } from 'drizzle-orm';

export function setupWebhookRoutes(app: Express) {

  // --- O ÚNICO E DEFINITIVO HANDLER PARA O WEBHOOK ---
  const webhookHandler = async (req: Request, res: Response) => {
    // Envia a resposta imediata para o remetente (n8n/Evolution) não ficar esperando
    res.status(200).json({ status: "received", timestamp: new Date().toISOString() });
    
    // --- Inicia o processamento assíncrono em segundo plano ---
    try {
      const { event, instance, data } = req.body;
      
      console.log('📨 Webhook recebido:', {
        event: event,
        instance: instance,
        timestamp: new Date().toISOString()
      });

      // Processa apenas eventos de novas mensagens de usuários
      if (event !== 'MESSAGES_UPSERT' && event !== 'messages.upsert' || !data?.messages || data.messages[0]?.key?.fromMe) {
        console.log('Evento ignorado (não é mensagem de usuário ou é do próprio bot).');
        return; // Encerra o processamento para este evento
      }

      for (const message of data.messages) {
        // Extrai as informações essenciais
        const userMessageText = message.message?.conversation || message.message?.extendedTextMessage?.text || message.message?.imageMessage?.caption;
        const recipientJid = message.key?.remoteJid;

        if (!userMessageText || !recipientJid) {
          console.log('Mensagem ignorada: sem texto ou destinatário válido.');
          continue; // Pula para a próxima mensagem no lote
        }

        console.log(`📱 Processando mensagem de ${recipientJid} para instância: ${instance}`);
        console.log(`💬 Conteúdo: "${userMessageText}"`);

        // Busca o agente correspondente no banco de dados usando Drizzle
        const results = await db.select({
          agent: agents,
          instance: whatsappInstances
        })
          .from(whatsappInstances)
          .innerJoin(agents, eq(whatsappInstances.agentId, agents.id))
          .where(eq(whatsappInstances.instanceName, instance))
          .limit(1);

        if (results.length === 0) {
          console.log(`❌ Agente para a instância ${instance} não foi encontrado.`);
          continue;
        }

        const agent = results[0].agent;
        console.log(`🤖 Processando com agente: ${agent.name} (ID: ${agent.id})`);

        if (agent.status !== 'active') {
          console.log(`⚠️ Agente ${agent.name} não está ativo (status: ${agent.status})`);
          continue;
        }

        // --- Lógica de chamada à IA ---
        const aiResponse = await agentService.testAgent(agent, userMessageText);

        if (aiResponse?.trim()) {
          console.log(`✅ Resposta da IA: "${aiResponse}"`);
          await whatsappGatewayService.sendMessage(instance, recipientJid.replace('@s.whatsapp.net', ''), aiResponse);
          console.log(`📤 Resposta enviada para ${recipientJid}`);
        } else {
          console.log('🤔 A IA não gerou uma resposta.');
        }
      }
    } catch (error) {
      console.error('❌ Erro CRÍTICO no processamento do webhook:', error);
    }
  };

  // --- REGISTRO DAS ROTAS ---
  // Registra o handler para as rotas principais
  app.post("/api/whatsapp/webhook", webhookHandler);
  app.post("/webhook", webhookHandler);

  // Endpoint GET para verificação de status
  app.get("/api/whatsapp/webhook", (req, res) => {
    res.json({
      service: "WhatsApp Webhook Endpoint",
      status: "active",
      description: "Endpoint para receber webhooks da Evolution API WhatsApp Gateway",
    });
  });

  console.log("✔️  Rotas de Webhook unificadas e configuradas.");
}