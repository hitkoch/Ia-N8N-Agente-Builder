/**
 * Evolution API Webhook Listener
 * Creates a persistent connection to monitor Evolution API events
 * and automatically processes incoming WhatsApp messages
 */

import { whatsappGatewayService } from './whatsapp-gateway';
import { storage } from '../storage';
import { agentService } from './agent';

class EvolutionWebhookListener {
  private isListening = false;
  private processedMessageIds = new Set<string>();
  private lastCheckTimestamp = Date.now() - 60000; // Start 1 minute ago
  private readonly instanceName = '5541996488281';
  private readonly apiToken = '8Tu2U0TAe7k3dnhHJlXgy9GgQeiWdVbx';
  private readonly baseUrl = 'https://apizap.ecomtools.com.br';

  async startListening() {
    if (this.isListening) return;
    
    this.isListening = true;
    console.log('Evolution Webhook Listener ativo - monitorando mensagens automaticamente');
    
    // Configure webhook to point to our server
    await this.configureWebhook();
    
    // Start continuous monitoring as backup
    this.continuousMonitoring();
  }

  stop() {
    this.isListening = false;
  }

  private async configureWebhook() {
    try {
      // Ensure webhook is properly configured
      const webhookConfig = await fetch(`${this.baseUrl}/webhook/set/${this.instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.apiToken
        },
        body: JSON.stringify({
          webhook: {
            enabled: true,
            url: "https://ian8n.replit.app/webhook",
            events: ["MESSAGES_UPSERT", "messages.upsert"],
            webhookByEvents: false,
            webhookBase64: false
          }
        })
      });

      if (webhookConfig.ok) {
        console.log('Webhook configurado para Evolution API');
      }
    } catch (error) {
      console.log('Continuando sem webhook configurado');
    }
  }

  private async continuousMonitoring() {
    while (this.isListening) {
      try {
        await this.checkForNewMessages();
        await this.sleep(500); // Check every 500ms for real-time response
      } catch (error) {
        await this.sleep(1000);
      }
    }
  }

  private async checkForNewMessages() {
    try {
      // Query Evolution API for recent messages
      const response = await fetch(`${this.baseUrl}/chat/findMessages/${this.instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.apiToken
        },
        body: JSON.stringify({
          where: {
            messageTimestamp: {
              $gte: Math.floor((this.lastCheckTimestamp - 5000) / 1000) // 5 second buffer
            },
            key: { fromMe: false }
          },
          limit: 10
        })
      });

      if (!response.ok) return;

      const data = await response.json();
      const messages = Array.isArray(data) ? data : (data.messages || []);

      for (const message of messages) {
        await this.processIncomingMessage(message);
      }

      this.lastCheckTimestamp = Date.now();

    } catch (error) {
      // Continue silently on errors
    }
  }

  private async processIncomingMessage(message: any) {
    try {
      const messageId = message.key?.id;
      if (!messageId || this.processedMessageIds.has(messageId)) return;

      // Check if message is recent (last 10 seconds)
      const messageTime = message.messageTimestamp * 1000;
      const timeDiff = Date.now() - messageTime;
      if (timeDiff > 10000) return;

      const phoneNumber = message.key?.remoteJid?.replace('@s.whatsapp.net', '');
      const messageText = message.message?.conversation || 
                         message.message?.extendedTextMessage?.text;

      if (!phoneNumber || !messageText) return;

      console.log(`NOVA MENSAGEM AUTOMATICA: ${phoneNumber} - "${messageText}"`);

      // Mark as processed immediately to avoid duplicates
      this.processedMessageIds.add(messageId);

      // Get agent configuration
      const whatsappInstance = await storage.getWhatsappInstanceByName(this.instanceName);
      if (!whatsappInstance) return;

      const agent = await storage.getAgent(whatsappInstance.agentId, 1);
      if (!agent || agent.status !== 'active') return;

      // Generate AI response
      const aiResponse = await agentService.testAgent(agent, messageText);
      if (!aiResponse?.trim()) return;

      // Send response immediately
      await whatsappGatewayService.sendMessage(this.instanceName, phoneNumber, aiResponse);
      console.log(`RESPOSTA AUTOMATICA: ${phoneNumber} - "${aiResponse.substring(0, 50)}..."`);

      // Store conversation
      storage.createConversation({
        agentId: agent.id,
        contactId: phoneNumber,
        messages: [
          { role: 'user', content: messageText, timestamp: new Date() },
          { role: 'assistant', content: aiResponse, timestamp: new Date() }
        ]
      }).catch(() => {});

      // Clean up old processed IDs
      if (this.processedMessageIds.size > 100) {
        const idsArray = Array.from(this.processedMessageIds);
        this.processedMessageIds.clear();
        idsArray.slice(-50).forEach(id => this.processedMessageIds.add(id));
      }

    } catch (error) {
      console.error('Erro no processamento:', error.message);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const evolutionWebhookListener = new EvolutionWebhookListener();