import type { Express } from "express";
import { storage } from "./storage";
import { agentService } from "./services/agent";
import { whatsappGatewayService } from "./services/whatsapp-gateway";
import { validateWebhookData, webhookRateLimiter } from "./middleware/security";

export function setupWebhookRoutes(app: Express) {
  // GET endpoint for webhook verification - MUST be accessible externally
  app.get("/api/whatsapp/webhook", (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');
    
    res.json({
      service: "WhatsApp Webhook Endpoint",
      status: "active",
      url: "https://workspace.hitkoch.replit.dev/api/whatsapp/webhook",
      methods: ["GET", "POST"],
      description: "Endpoint para receber webhooks da Evolution API WhatsApp Gateway",
      supportedEvents: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
      lastUpdated: new Date().toISOString(),
      version: "1.0.0",
      server: "Express",
      runtime: "Node.js"
    });
  });

  // POST endpoint for webhook processing - MUST be accessible externally
  app.post("/api/whatsapp/webhook", webhookRateLimiter, validateWebhookData, async (req, res) => {
    try {
      console.log('📨 Webhook recebido:', {
        event: req.body.event,
        instance: req.body.instance,
        timestamp: new Date().toISOString()
      });

      const { event, instance, data } = req.body;

      if (event === 'MESSAGES_UPSERT' && data?.messages) {
        for (const message of data.messages) {
          if (message.key?.fromMe) continue;

          const phoneNumber = message.key?.remoteJid?.replace('@s.whatsapp.net', '') || '';
          const messageText = message.message?.conversation || '';
          
          if (!messageText || !phoneNumber) continue;

          console.log(`📱 Processando mensagem de ${phoneNumber}: "${messageText}"`);

          const whatsappInstance = await storage.getWhatsappInstanceByName(instance);
          if (!whatsappInstance) {
            console.log(`❌ Instância não encontrada: ${instance}`);
            continue;
          }

          let agent = null;
          for (let userId = 1; userId <= 100; userId++) {
            try {
              const userAgents = await storage.getAgentsByOwner(userId);
              const foundAgent = userAgents.find(a => a.id === whatsappInstance.agentId);
              if (foundAgent) {
                agent = foundAgent;
                break;
              }
            } catch (error) {
              continue;
            }
          }

          if (!agent) {
            console.log(`❌ Agente não encontrado para instância: ${instance}`);
            continue;
          }

          console.log(`🤖 Processando com agente: ${agent.name}`);

          const aiResponse = await agentService.testAgent(agent, messageText);
          if (aiResponse?.trim()) {
            await whatsappGatewayService.sendMessage(instance, phoneNumber, aiResponse);
            console.log(`✅ Resposta enviada para ${phoneNumber}`);

            await storage.createConversation({
              agentId: agent.id,
              contactId: phoneNumber,
              messages: [
                { role: 'user', content: messageText, timestamp: new Date() },
                { role: 'assistant', content: aiResponse, timestamp: new Date() }
              ]
            });
            console.log(`💾 Conversa salva no banco`);
          }
        }
      }
      
      res.json({ 
        status: 'processed',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Erro no webhook:', error);
      res.status(500).json({ 
        status: 'error',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Test endpoint for external connectivity
  app.get("/api/ping", (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    res.json({ 
      message: "API accessible externally",
      timestamp: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  });
}