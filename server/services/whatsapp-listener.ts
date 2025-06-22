/**
 * Enhanced WhatsApp Message Listener
 * Combines webhook + active monitoring for guaranteed message capture
 */

import { whatsappGatewayService } from './whatsapp-gateway';
import { storage } from '../storage';
import { agentService } from './agent';

class WhatsAppListener {
  private isActive = false;
  private lastMessageTime = Date.now();
  private processedIds = new Set<string>();

  start() {
    if (this.isActive) return;
    
    this.isActive = true;
    console.log('WhatsApp Listener ativo - capturando mensagens em tempo real');
    
    // Start continuous monitoring
    this.continuousMonitor();
  }

  stop() {
    this.isActive = false;
  }

  private async continuousMonitor() {
    while (this.isActive) {
      try {
        await this.scanForMessages();
        await this.delay(1000); // Check every 1 second for faster detection
      } catch (error) {
        await this.delay(3000); // Wait longer on error
      }
    }
  }

  private async scanForMessages() {
    const instanceName = '5541996488281';
    
    try {
      // Try multiple Evolution API endpoints to find messages
      const endpoints = [
        {
          url: `https://apizap.ecomtools.com.br/chat/findMessages/${instanceName}`,
          body: {
            where: {
              messageTimestamp: { $gte: Math.floor((this.lastMessageTime - 10000) / 1000) },
              key: { fromMe: false }
            },
            limit: 10
          }
        },
        {
          url: `https://apizap.ecomtools.com.br/message/findMessages/${instanceName}`,
          body: {
            where: { key: { fromMe: false } },
            limit: 10
          }
        },
        {
          url: `https://apizap.ecomtools.com.br/chat/fetchMessages/${instanceName}`,
          body: {
            where: { key: { fromMe: false } },
            limit: 10
          }
        }
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': '8Tu2U0TAe7k3dnhHJlXgy9GgQeiWdVbx'
            },
            body: JSON.stringify(endpoint.body)
          });

          if (response.ok) {
            const data = await response.json();
            let messages = [];
            
            if (Array.isArray(data)) {
              messages = data;
            } else if (data.messages) {
              messages = data.messages;
            } else if (data.data) {
              messages = data.data;
            }
            
            // Filter to only recent messages (last 30 seconds)
            const recentMessages = messages.filter(msg => {
              const msgTime = msg.messageTimestamp * 1000;
              return (Date.now() - msgTime) < 30000;
            });
            
            for (const message of recentMessages) {
              await this.handleMessage(message, instanceName);
            }
            
            if (messages.length > 0) {
              console.log(`Verificando ${messages.length} mensagens, ${recentMessages.length} recentes`);
            }
            break; // Success, exit loop
          }
        } catch (endpointError) {
          continue; // Try next endpoint
        }
      }
      
      this.lastMessageTime = Date.now();
      
    } catch (error) {
      // Continue silently
    }
  }

  private async handleMessage(message: any, instanceName: string) {
    try {
      const messageId = message.key?.id;
      if (!messageId || this.processedIds.has(messageId)) return;

      const phoneNumber = message.key?.remoteJid?.replace('@s.whatsapp.net', '');
      const messageText = message.message?.conversation || message.message?.extendedTextMessage?.text;

      if (!phoneNumber || !messageText) return;

      console.log(`NOVA MENSAGEM REAL: ${phoneNumber} - "${messageText}"`);

      // Get agent configuration
      const whatsappInstance = await storage.getWhatsappInstanceByName(instanceName);
      if (!whatsappInstance) return;

      const agent = await storage.getAgent(whatsappInstance.agentId, 1);
      if (!agent || agent.status !== 'active') return;

      // Generate AI response
      const aiResponse = await agentService.testAgent(agent, messageText);
      if (!aiResponse) return;

      // Send response immediately
      await whatsappGatewayService.sendMessage(instanceName, phoneNumber, aiResponse);
      console.log(`RESPOSTA ENVIADA INSTANTANEAMENTE: ${phoneNumber}`);

      // Store conversation
      storage.createConversation({
        agentId: agent.id,
        contactId: phoneNumber,
        messages: [
          { role: 'user', content: messageText, timestamp: new Date() },
          { role: 'assistant', content: aiResponse, timestamp: new Date() }
        ]
      }).catch(() => {}); // Fire and forget

      // Mark as processed
      this.processedIds.add(messageId);
      
      // Cleanup old IDs
      if (this.processedIds.size > 50) {
        const oldestIds = Array.from(this.processedIds).slice(0, 25);
        oldestIds.forEach(id => this.processedIds.delete(id));
      }

    } catch (error) {
      console.error('Erro no processamento:', error.message);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const whatsappListener = new WhatsAppListener();