/**
 * Message Polling Service
 * Active polling for WhatsApp messages when webhooks fail
 */

import { whatsappGatewayService } from './whatsapp-gateway';
import { storage } from '../storage';
import { agentService } from './agent';
import { db } from '../db';
import { whatsappInstances } from '@shared/schema';

interface ProcessedMessage {
  id: string;
  timestamp: number;
}

class MessagePollerService {
  private intervalId: NodeJS.Timeout | null = null;
  private processedMessages = new Map<string, ProcessedMessage>();
  private readonly pollInterval = 2000; // 2 seconds for faster detection
  private readonly maxProcessedMessages = 1000;

  start() {
    if (this.intervalId) return;

    console.log('🔄 Iniciando polling de mensagens WhatsApp...');
    
    this.intervalId = setInterval(async () => {
      await this.pollMessages();
    }, this.pollInterval);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('⏹️ Polling de mensagens parado');
    }
  }

  private async pollMessages() {
    try {
      // Get all WhatsApp instances from whatsapp_instances table
      const instances = await db.select().from(whatsappInstances);
      
      for (const instance of instances) {
        await this.checkInstanceMessages(instance.instanceName);
      }
    } catch (error) {
      console.error('❌ Erro no polling:', error.message);
    }
  }

  private async checkInstanceMessages(instanceName: string) {
    try {
      // Try different Evolution API endpoints for fetching messages
      const endpoints = [
        `https://apizap.ecomtools.com.br/chat/findMessages/${instanceName}`,
        `https://apizap.ecomtools.com.br/message/findMessages/${instanceName}`,
        `https://apizap.ecomtools.com.br/chat/fetchMessages/${instanceName}`
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': process.env.WHATSAPP_GATEWAY_TOKEN || '8Tu2U0TAe7k3dnhHJlXgy9GgQeiWdVbx'
            },
            body: JSON.stringify({
              where: {
                key: {
                  fromMe: false
                }
              },
              limit: 5
            })
          });

          if (response.ok) {
            const result = await response.json();
            let messages = [];
            
            if (Array.isArray(result)) {
              messages = result;
            } else if (result.messages && Array.isArray(result.messages)) {
              messages = result.messages;
            } else if (result.data && Array.isArray(result.data)) {
              messages = result.data;
            }
            
            for (const message of messages) {
              await this.processMessage(message, instanceName);
            }
            break; // Success, exit loop
          }
        } catch (endpointError) {
          continue; // Try next endpoint
        }
      }
      
    } catch (error) {
      // Silently continue - polling errors are expected
    }
  }

  private async processMessage(message: any, instanceName: string) {
    try {
      // Skip if already processed
      if (this.processedMessages.has(message.key.id)) return;

      // Skip messages older than 30 seconds
      const messageTime = message.messageTimestamp * 1000;
      if (Date.now() - messageTime > 30000) return;

      // Extract message details
      const phoneNumber = message.key.remoteJid.replace('@s.whatsapp.net', '');
      const messageText = message.message?.conversation || 
                         message.message?.extendedTextMessage?.text || '';

      if (!messageText) return;

      console.log(`📨 NOVA MENSAGEM (POLLING): ${phoneNumber} - "${messageText}"`);

      // Get WhatsApp instance and agent
      const whatsappInstance = await storage.getWhatsappInstanceByName(instanceName);
      if (!whatsappInstance) return;

      const agent = await storage.getAgent(whatsappInstance.agentId, 1);
      if (!agent) {
        console.log(`POLLING: Agente ${whatsappInstance.agentId} não encontrado`);
        return;
      }
      if (agent.status !== 'active') {
        console.log(`POLLING: Agente ${agent.name} não está ativo`);
        return;
      }

      // Generate AI response
      const aiResponse = await agentService.testAgent(agent, messageText);
      if (!aiResponse?.trim()) return;

      // Send response
      await whatsappGatewayService.sendMessage(instanceName, phoneNumber, aiResponse);
      console.log(`✅ RESPOSTA ENVIADA (POLLING): ${phoneNumber}`);

      // Store conversation
      await storage.createConversation({
        agentId: agent.id,
        contactId: phoneNumber,
        messages: [
          { role: 'user', content: messageText, timestamp: new Date() },
          { role: 'assistant', content: aiResponse, timestamp: new Date() }
        ]
      });

      // Mark message as processed
      this.processedMessages.set(message.key.id, {
        id: message.key.id,
        timestamp: Date.now()
      });

      // Cleanup old processed messages
      if (this.processedMessages.size > this.maxProcessedMessages) {
        const oldest = Array.from(this.processedMessages.entries())
          .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
        this.processedMessages.delete(oldest[0]);
      }

    } catch (error) {
      console.error(`❌ Erro ao processar mensagem:`, error.message);
    }
  }
}

export const messagePollerService = new MessagePollerService();