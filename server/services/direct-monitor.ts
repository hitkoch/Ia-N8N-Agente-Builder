/**
 * Direct WhatsApp Message Monitor
 * Actively monitors Evolution API for new messages when webhook fails
 */

import { whatsappGatewayService } from './whatsapp-gateway';
import { storage } from '../storage';
import { agentService } from './agent';

class DirectMonitor {
  private isRunning = false;
  private processedMessageIds = new Set<string>();
  private lastCheckTime = Date.now() - 60000; // Start 1 minute ago

  async start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🎯 Monitor direto de mensagens ativado');
    
    this.monitorLoop();
  }

  stop() {
    this.isRunning = false;
    console.log('⏹️ Monitor direto parado');
  }

  private async monitorLoop() {
    while (this.isRunning) {
      try {
        await this.checkForNewMessages();
        await new Promise(resolve => setTimeout(resolve, 3000)); // Check every 3 seconds
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait longer on error
      }
    }
  }

  private async checkForNewMessages() {
    try {
      const instanceName = '5541996488281';
      
      // Try multiple endpoints to fetch messages
      const endpoints = [
        `https://apizap.ecomtools.com.br/chat/fetchMessages/${instanceName}`,
        `https://apizap.ecomtools.com.br/chat/findMessages/${instanceName}`,
        `https://apizap.ecomtools.com.br/message/findMessages/${instanceName}`
      ];

      let response = null;
      for (const endpoint of endpoints) {
        try {
          response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': '8Tu2U0TAe7k3dnhHJlXgy9GgQeiWdVbx'
            },
            body: JSON.stringify({
              where: {
                messageTimestamp: {
                  $gte: Math.floor(this.lastCheckTime / 1000)
                },
                key: { fromMe: false }
              },
              limit: 5
            })
          });
          if (response.ok) break;
        } catch (e) {
          continue;
        }
      }

      if (!response.ok) return;

      const data = await response.json();
      let messages = [];

      // Handle different response formats
      if (Array.isArray(data)) {
        messages = data;
      } else if (data.messages) {
        messages = data.messages;
      } else if (data.data) {
        messages = data.data;
      }

      for (const message of messages) {
        await this.processNewMessage(message, instanceName);
      }

      this.lastCheckTime = Date.now();

    } catch (error) {
      // Continue silently on errors
    }
  }

  private async processNewMessage(message: any, instanceName: string) {
    try {
      // Skip if already processed
      if (this.processedMessageIds.has(message.key?.id)) return;

      const phoneNumber = message.key?.remoteJid?.replace('@s.whatsapp.net', '');
      const messageText = message.message?.conversation || 
                         message.message?.extendedTextMessage?.text || '';

      if (!phoneNumber || !messageText) return;

      console.log(`📨 NOVA MENSAGEM DETECTADA: ${phoneNumber} - "${messageText}"`);

      // Get WhatsApp instance and agent
      const whatsappInstance = await storage.getWhatsappInstanceByName(instanceName);
      if (!whatsappInstance) return;

      const agent = await storage.getAgent(whatsappInstance.agentId, 1);
      if (!agent || agent.status !== 'active') return;

      // Generate AI response
      const aiResponse = await agentService.testAgent(agent, messageText);
      if (!aiResponse?.trim()) return;

      // Send response
      await whatsappGatewayService.sendMessage(instanceName, phoneNumber, aiResponse);
      console.log(`✅ RESPOSTA ENVIADA (MONITOR): ${phoneNumber}`);

      // Store conversation
      await storage.createConversation({
        agentId: agent.id,
        contactId: phoneNumber,
        messages: [
          { role: 'user', content: messageText, timestamp: new Date() },
          { role: 'assistant', content: aiResponse, timestamp: new Date() }
        ]
      });

      // Mark as processed
      this.processedMessageIds.add(message.key.id);

      // Clean up old processed IDs (keep last 100)
      if (this.processedMessageIds.size > 100) {
        const idsArray = Array.from(this.processedMessageIds);
        this.processedMessageIds.clear();
        idsArray.slice(-50).forEach(id => this.processedMessageIds.add(id));
      }

    } catch (error) {
      console.error('Erro ao processar mensagem:', error.message);
    }
  }
}

export const directMonitor = new DirectMonitor();