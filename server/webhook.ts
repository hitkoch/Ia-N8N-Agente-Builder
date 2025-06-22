import type { Express } from "express";
import { storage } from "./storage";
import { agentService } from "./services/agent";
import { whatsappGatewayService } from "./services/whatsapp-gateway";
import { multimediaService } from "./services/multimedia";
import { validateWebhookData, webhookRateLimiter } from "./middleware/security";
import { webhookOptimizer } from "./webhook-optimizer";
import { performanceMonitor } from "./middleware/performance-monitor";

export function setupWebhookRoutes(app: Express) {
  // GET endpoint for webhook verification - MUST be accessible externally
  app.get("/api/whatsapp/webhook", (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');
    
    res.json({
      service: "WhatsApp Webhook Endpoint",
      status: "active",
      url: "https://ian8n.replit.app/api/whatsapp/webhook",
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
  app.post("/api/whatsapp/webhook", async (req, res) => {
    // Set CORS headers first
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    try {
      const { event, instance, data } = req.body;
      
      console.log('📨 Webhook recebido:', {
        event: event,
        instance: instance,
        timestamp: new Date().toISOString()
      });

      // Use optimized instance lookup
      let whatsappInstance = await webhookOptimizer.getOptimizedInstance(instance);
      
      if (!whatsappInstance && instance.startsWith('whatsapp-')) {
        const instanceNameWithoutPrefix = instance.replace('whatsapp-', '');
        whatsappInstance = await webhookOptimizer.getOptimizedInstance(instanceNameWithoutPrefix);
      }
      
      if (!whatsappInstance && instance.length > 11) {
        const shortInstance = instance.slice(-11);
        whatsappInstance = await webhookOptimizer.getOptimizedInstance(shortInstance);
      }
      
      if (!whatsappInstance) {
        console.log(`⚠️ Mensagem recebida para instância não registrada: ${instance}`);
        return res.json({ 
          status: "ignored", 
          reason: "Instance not found in system",
          timestamp: new Date().toISOString() 
        });
      }

      if (event === 'MESSAGES_UPSERT' && data?.messages) {
        for (const message of data.messages) {
          if (message.key?.fromMe) continue;

          let phoneNumber = message.key?.remoteJid?.replace('@s.whatsapp.net', '') || '';
          
          // Fix corrupted phone numbers with multiple country codes
          if (phoneNumber.startsWith('555541')) {
            phoneNumber = phoneNumber.replace('555541', '5541');
          } else if (phoneNumber.startsWith('5555')) {
            phoneNumber = phoneNumber.replace('5555', '55');
          }
          
          console.log(`📞 Número extraído do webhook: ${phoneNumber}`);
          
          // Handle messages from any WhatsApp number - respond to the sender
          console.log(`📱 Mensagem recebida de: ${phoneNumber} para instância: ${instance}`);
          let messageText = '';
          let mediaAnalysis = null;
          
          // Extract text content
          if (message.message?.conversation) {
            messageText = message.message.conversation;
          } else if (message.message?.extendedTextMessage?.text) {
            messageText = message.message.extendedTextMessage.text;
          }

          // Process multimedia content
          if (message.message?.audioMessage) {
            console.log(`🎤 Processando áudio de ${phoneNumber}`);
            try {
              // Download audio from WhatsApp
              const audioUrl = message.message.audioMessage.url;
              if (audioUrl) {
                const audioResponse = await fetch(audioUrl);
                const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
                const mimeType = message.message.audioMessage.mimetype || 'audio/ogg';
                
                const audioResult = await multimediaService.processMultimediaMessage(
                  audioBuffer, 
                  mimeType, 
                  messageText
                );
                
                messageText = audioResult.text;
                mediaAnalysis = audioResult.analysis;
              }
            } catch (error) {
              console.error('❌ Erro ao processar áudio:', error);
              messageText = messageText || 'Áudio recebido (erro no processamento)';
            }
          }

          if (message.message?.imageMessage) {
            console.log(`🖼️ Processando imagem de ${phoneNumber}`);
            try {
              // Download image from WhatsApp
              const imageUrl = message.message.imageMessage.url;
              if (imageUrl) {
                const imageResponse = await fetch(imageUrl);
                const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
                const mimeType = message.message.imageMessage.mimetype || 'image/jpeg';
                
                const imageResult = await multimediaService.processMultimediaMessage(
                  imageBuffer, 
                  mimeType, 
                  message.message.imageMessage.caption || messageText
                );
                
                messageText = imageResult.text;
                mediaAnalysis = imageResult.analysis;
              }
            } catch (error) {
              console.error('❌ Erro ao processar imagem:', error);
              messageText = messageText || message.message.imageMessage.caption || 'Imagem recebida (erro no processamento)';
            }
          }

          if (message.message?.videoMessage) {
            console.log(`🎥 Vídeo recebido de ${phoneNumber}`);
            messageText = messageText || message.message.videoMessage.caption || 'Vídeo recebido (análise não suportada)';
          }

          if (message.message?.documentMessage) {
            console.log(`📄 Documento recebido de ${phoneNumber}`);
            messageText = messageText || message.message.documentMessage.caption || 'Documento recebido';
          }
          
          if (!messageText || !phoneNumber) continue;

          console.log(`📱 Processando mensagem de ${phoneNumber}: "${messageText}"`);

          // Use optimized agent lookup with immediate fallback
          let agent = await webhookOptimizer.getOptimizedAgent(whatsappInstance.agentId, whatsappInstance.agentId);
          if (!agent) {
            // Try direct storage lookup as fallback (faster than loop)
            agent = await storage.getAgent(whatsappInstance.agentId, 1); // Default to user 1
          }

          if (!agent) {
            console.log(`❌ Agente não encontrado para instância: ${instance}`);
            continue;
          }

          // Check if agent is active
          if (agent.status !== 'active') {
            console.log(`⚠️ Agente ${agent.name} não está ativo (status: ${agent.status})`);
            continue;
          }

          console.log(`🤖 Processando com agente: ${agent.name}`);

          // Start performance monitoring
          const endTimer = performanceMonitor.startTimer('whatsapp-response');

          // Generate AI response with multimedia context
          const contextualPrompt = mediaAnalysis 
            ? `${messageText}\n\n[Contexto de mídia: ${JSON.stringify(mediaAnalysis)}]`
            : messageText;

          // Execute AI response generation
          const aiResponse = await agentService.testAgent(agent, contextualPrompt);
          
          if (aiResponse?.trim()) {
            try {
              // Send message immediately without waiting for conversation storage
              const sendPromise = whatsappGatewayService.sendMessage(whatsappInstance.instanceName, phoneNumber, aiResponse);
              
              // Store conversation in background (non-blocking)
              const storePromise = storage.createConversation({
                agentId: agent.id,
                contactId: phoneNumber,
                messages: [
                  { 
                    role: 'user', 
                    content: messageText, 
                    timestamp: new Date(),
                    metadata: mediaAnalysis ? { media: mediaAnalysis } : undefined
                  },
                  { role: 'assistant', content: aiResponse, timestamp: new Date() }
                ]
              });

              // Wait for message to be sent, store conversation in background
              await sendPromise;
              console.log(`✅ Resposta enviada para ${phoneNumber}`);
              
              // End performance monitoring
              const responseTime = endTimer(agent.id, true);
              
              // Don't wait for storage completion to avoid delays
              storePromise.then(() => {
                console.log(`💾 Conversa salva`);
              }).catch(error => {
                console.error(`❌ Erro ao salvar conversa:`, error);
              });
              
            } catch (sendError) {
              console.error(`❌ Erro ao enviar resposta para ${phoneNumber}:`, sendError.message);
              endTimer(agent.id, false); // Mark as failed
              // Continue processing other messages even if one fails
            }
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