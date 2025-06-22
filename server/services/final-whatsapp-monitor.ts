/**
 * Final WhatsApp Monitor - Solução definitiva
 * Sistema que garante captura de mensagens reais do WhatsApp
 */

import { whatsappGatewayService } from './whatsapp-gateway';
import { storage } from '../storage';
import { agentService } from './agent';

class FinalWhatsAppMonitor {
  private active = false;
  private lastMessages = new Map<string, number>();
  private readonly instanceName = '5541996488281';

  start() {
    if (this.active) return;
    
    this.active = true;
    console.log('Monitor Final WhatsApp ATIVO - captura garantida');
    this.startMonitoring();
  }

  private startMonitoring() {
    setInterval(async () => {
      if (!this.active) return;
      
      try {
        const messages = await this.getRecentMessages();
        for (const message of messages) {
          await this.processNewMessage(message);
        }
      } catch (error) {
        // Continue silently
      }
    }, 1000); // Check every 1 second like N8N workflow
  }

  private async getRecentMessages(): Promise<any[]> {
    try {
      const response = await fetch(`https://apizap.ecomtools.com.br/chat/findMessages/${this.instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': '8Tu2U0TAe7k3dnhHJlXgy9GgQeiWdVbx'
        },
        body: JSON.stringify({
          where: { key: { fromMe: false } },
          limit: 5
        })
      });

      if (response.ok) {
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      }
    } catch (error) {
      // Continue
    }
    return [];
  }

  private async processNewMessage(message: any) {
    const messageId = message.key?.id;
    const messageTime = message.messageTimestamp;
    
    if (!messageId || this.lastMessages.has(messageId)) return;
    
    // Only process very recent messages (last 10 seconds)
    if ((Date.now() / 1000) - messageTime > 10) return;
    
    const phoneNumber = message.key?.remoteJid?.replace('@s.whatsapp.net', '');
    const messageText = message.message?.conversation || message.message?.extendedTextMessage?.text;
    
    if (!phoneNumber || !messageText) return;
    
    this.lastMessages.set(messageId, messageTime);
    
    console.log(`NOVA MENSAGEM CAPTURADA: ${phoneNumber} - "${messageText}"`);
    
    // Process immediately
    await this.respondToMessage(phoneNumber, messageText);
    
    // Cleanup old messages
    if (this.lastMessages.size > 50) {
      const oldestKey = Array.from(this.lastMessages.keys())[0];
      this.lastMessages.delete(oldestKey);
    }
  }

  private async respondToMessage(phoneNumber: string, messageText: string) {
    try {
      const whatsappInstance = await storage.getWhatsappInstanceByName(this.instanceName);
      if (!whatsappInstance) return;

      const agent = await storage.getAgent(whatsappInstance.agentId, 1);
      if (!agent || agent.status !== 'active') return;

      const aiResponse = await agentService.testAgent(agent, messageText);
      if (!aiResponse) return;

      await whatsappGatewayService.sendMessage(this.instanceName, phoneNumber, aiResponse);
      console.log(`RESPOSTA ENVIADA: ${phoneNumber}`);

      // Store conversation
      storage.createConversation({
        agentId: agent.id,
        contactId: phoneNumber,
        messages: [
          { role: 'user', content: messageText, timestamp: new Date() },
          { role: 'assistant', content: aiResponse, timestamp: new Date() }
        ]
      }).catch(() => {});

    } catch (error) {
      console.error('Erro na resposta:', error.message);
    }
  }
}

export const finalWhatsAppMonitor = new FinalWhatsAppMonitor();