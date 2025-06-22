/**
 * WhatsApp Message Monitor
 * Monitora mensagens da Evolution API e responde automaticamente
 */

import { whatsappGatewayService } from './whatsapp-gateway';
import { storage } from '../storage';
import { agentService } from './agent';

class WhatsAppMonitor {
  private isActive = false;
  private processedIds = new Set<string>();
  private readonly instanceName = '5541996488281';

  start() {
    if (this.isActive) return;
    
    this.isActive = true;
    console.log('WhatsApp Monitor iniciado');
    this.monitor();
  }

  private monitor() {
    setInterval(async () => {
      if (!this.isActive) return;
      
      try {
        const messages = await this.fetchMessages();
        if (messages.length > 0) {
          console.log(`Verificando ${messages.length} mensagens...`);
        }
        for (const message of messages) {
          await this.handleMessage(message);
        }
      } catch (error) {
        console.log('Erro no monitor:', error.message);
      }
    }, 2000); // Check every 2 seconds
  }

  private async fetchMessages() {
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

  private async handleMessage(message: any) {
    const messageId = message.key?.id;
    if (!messageId || this.processedIds.has(messageId)) return;

    // Check if message is recent (last 30 seconds)
    const messageTime = message.messageTimestamp * 1000;
    if (Date.now() - messageTime > 30000) return;

    const phoneNumber = message.key?.remoteJid?.replace('@s.whatsapp.net', '');
    const messageText = message.message?.conversation || message.message?.extendedTextMessage?.text;

    if (!phoneNumber || !messageText) return;

    this.processedIds.add(messageId);
    console.log(`📱 NOVA MENSAGEM DETECTADA: ${phoneNumber} - "${messageText}"`);

    await this.respondToMessage(phoneNumber, messageText);

    // Cleanup old IDs
    if (this.processedIds.size > 50) {
      const oldIds = Array.from(this.processedIds).slice(0, 25);
      oldIds.forEach(id => this.processedIds.delete(id));
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
      console.log(`✅ RESPOSTA AUTOMATICA ENVIADA para ${phoneNumber}: "${aiResponse.substring(0, 50)}..."`);

      // Store conversation
      await storage.createConversation({
        agentId: agent.id,
        contactId: phoneNumber,
        messages: [
          { role: 'user', content: messageText, timestamp: new Date() },
          { role: 'assistant', content: aiResponse, timestamp: new Date() }
        ]
      }).catch(() => {});

    } catch (error) {
      console.error('Erro ao responder:', error.message);
    }
  }
}

export const whatsappMonitor = new WhatsAppMonitor();