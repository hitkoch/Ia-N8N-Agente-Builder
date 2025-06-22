/**
 * Real Message Detector
 * Continuously monitors Evolution API for incoming WhatsApp messages
 * and automatically triggers webhook processing
 */

import { whatsappGatewayService } from './whatsapp-gateway';
import { storage } from '../storage';
import { agentService } from './agent';

interface MessageCache {
  id: string;
  timestamp: number;
  processed: boolean;
}

class RealMessageDetector {
  private isRunning = false;
  private messageCache = new Map<string, MessageCache>();
  private lastScanTime = Date.now() - 30000; // Start 30 seconds ago
  private readonly instanceName = '5541996488281';
  private readonly apiToken = '8Tu2U0TAe7k3dnhHJlXgy9GgQeiWdVbx';

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('Real Message Detector iniciado - monitoramento ativo');
    this.detectLoop();
  }

  stop() {
    this.isRunning = false;
  }

  private async detectLoop() {
    while (this.isRunning) {
      try {
        await this.scanForNewMessages();
        await this.sleep(800); // Scan every 800ms for rapid detection
      } catch (error) {
        await this.sleep(2000);
      }
    }
  }

  private async scanForNewMessages() {
    try {
      const response = await fetch(`https://apizap.ecomtools.com.br/chat/findMessages/${this.instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.apiToken
        },
        body: JSON.stringify({
          where: {
            key: { fromMe: false }
          },
          limit: 20
        })
      });

      if (!response.ok) return;

      const messages = await response.json();
      if (!Array.isArray(messages)) return;

      // Process messages in reverse chronological order (newest first)
      const sortedMessages = messages.sort((a, b) => b.messageTimestamp - a.messageTimestamp);

      for (const message of sortedMessages) {
        await this.processMessage(message);
      }

      // Clean old cache entries
      this.cleanCache();

    } catch (error) {
      // Continue silently
    }
  }

  private async processMessage(message: any) {
    const messageId = message.key?.id;
    if (!messageId) return;

    // Check if already processed
    if (this.messageCache.has(messageId)) return;

    const messageTime = message.messageTimestamp * 1000;
    const timeSinceMessage = Date.now() - messageTime;

    // Only process messages from the last 15 seconds
    if (timeSinceMessage > 15000) return;

    const phoneNumber = message.key?.remoteJid?.replace('@s.whatsapp.net', '');
    const messageText = message.message?.conversation || 
                       message.message?.extendedTextMessage?.text;

    if (!phoneNumber || !messageText) return;

    // Mark as processing
    this.messageCache.set(messageId, {
      id: messageId,
      timestamp: Date.now(),
      processed: false
    });

    console.log(`MENSAGEM REAL DETECTADA: ${phoneNumber} - "${messageText}"`);

    // Process immediately
    await this.handleRealMessage(message, phoneNumber, messageText);

    // Mark as processed
    this.messageCache.set(messageId, {
      id: messageId,
      timestamp: Date.now(),
      processed: true
    });
  }

  private async handleRealMessage(message: any, phoneNumber: string, messageText: string) {
    try {
      // Get WhatsApp instance and agent
      const whatsappInstance = await storage.getWhatsappInstanceByName(this.instanceName);
      if (!whatsappInstance) return;

      const agent = await storage.getAgent(whatsappInstance.agentId, 1);
      if (!agent || agent.status !== 'active') return;

      // Generate AI response
      const startTime = Date.now();
      const aiResponse = await agentService.testAgent(agent, messageText);
      const responseTime = Date.now() - startTime;

      if (!aiResponse?.trim()) return;

      // Send response immediately
      await whatsappGatewayService.sendMessage(this.instanceName, phoneNumber, aiResponse);
      
      console.log(`RESPOSTA AUTOMATICA ENVIADA em ${responseTime}ms: ${phoneNumber}`);

      // Store conversation asynchronously
      storage.createConversation({
        agentId: agent.id,
        contactId: phoneNumber,
        messages: [
          { role: 'user', content: messageText, timestamp: new Date() },
          { role: 'assistant', content: aiResponse, timestamp: new Date() }
        ]
      }).catch(() => {});

    } catch (error) {
      console.error('Erro no processamento automatico:', error.message);
    }
  }

  private cleanCache() {
    const now = Date.now();
    for (const [id, cache] of this.messageCache.entries()) {
      // Remove entries older than 5 minutes
      if (now - cache.timestamp > 300000) {
        this.messageCache.delete(id);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const realMessageDetector = new RealMessageDetector();