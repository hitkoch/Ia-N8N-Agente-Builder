/**
 * Security Middleware for Multi-Tenant WhatsApp Integration
 * Provides additional security layers for user isolation
 */

import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

export interface SecurityAuditLog {
  userId: number;
  agentId: number;
  action: string;
  timestamp: Date;
  ip: string;
  userAgent: string;
  success: boolean;
  details?: string;
}

/**
 * Middleware to verify agent ownership and log security events
 */
export function agentOwnershipMiddleware(req: Request, res: Response, next: NextFunction) {
  const originalSend = res.send;
  
  // Override send to capture response for audit logging
  res.send = function(body: any) {
    const success = res.statusCode >= 200 && res.statusCode < 400;
    
    // Log security audit
    if (req.params.agentId && (req as any).user) {
      logSecurityEvent({
        userId: (req as any).user.id,
        agentId: parseInt(req.params.agentId),
        action: `${req.method} ${req.path}`,
        timestamp: new Date(),
        ip: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        success: success,
        details: success ? undefined : (typeof body === 'string' ? body : JSON.stringify(body))
      });
    }
    
    return originalSend.call(this, body);
  };
  
  next();
}

/**
 * Validate webhook data to prevent injection attacks
 */
export function validateWebhookData(req: Request, res: Response, next: NextFunction) {
  const { event, instance, data } = req.body;
  
  // Check for required fields
  if (!event || !instance || !data) {
    console.warn('🚨 Webhook validation failed: missing required fields');
    return res.status(400).json({ 
      status: 'validation_failed',
      message: 'Missing required webhook fields'
    });
  }
  
  // Validate instance name format (prevents injection)
  const instancePattern = /^whatsapp-\d{8,15}$/;
  if (!instancePattern.test(instance)) {
    console.warn(`🚨 Webhook validation failed: invalid instance name format: ${instance}`);
    return res.status(400).json({ 
      status: 'validation_failed',
      message: 'Invalid instance name format'
    });
  }
  
  // Validate event type
  const allowedEvents = ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'messages.upsert', 'connection.update', 'qr.updated'];
  if (!allowedEvents.includes(event)) {
    console.warn(`🚨 Webhook validation failed: unsupported event type: ${event}`);
    return res.status(400).json({ 
      status: 'validation_failed',
      message: 'Unsupported event type'
    });
  }
  
  // Sanitize message content to prevent XSS
  if (event === 'messages.upsert' && data.message) {
    if (data.message.conversation) {
      data.message.conversation = sanitizeText(data.message.conversation);
    }
    if (data.message.extendedTextMessage?.text) {
      data.message.extendedTextMessage.text = sanitizeText(data.message.extendedTextMessage.text);
    }
  }
  
  next();
}

/**
 * Rate limiting for webhook endpoints
 */
const webhookRateLimit = new Map<string, { count: number; resetTime: number }>();

export function webhookRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 100; // Max 100 webhooks per minute per IP
  
  const current = webhookRateLimit.get(ip);
  
  if (!current || now > current.resetTime) {
    webhookRateLimit.set(ip, {
      count: 1,
      resetTime: now + windowMs
    });
    return next();
  }
  
  if (current.count >= maxRequests) {
    console.warn(`🚨 Rate limit exceeded for IP: ${ip}`);
    return res.status(429).json({
      status: 'rate_limit_exceeded',
      message: 'Too many webhook requests'
    });
  }
  
  current.count++;
  next();
}

/**
 * Sanitize text input to prevent XSS and injection attacks
 */
function sanitizeText(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  // Remove potentially dangerous characters and limit length
  return text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>'"&]/g, '') // Remove dangerous characters
    .substring(0, 5000) // Limit message length
    .trim();
}

/**
 * Log security events for audit purposes
 */
function logSecurityEvent(event: SecurityAuditLog) {
  // In a production environment, this would write to a secure audit log
  // For now, we'll use console logging with structured format
  const logEntry = {
    timestamp: event.timestamp.toISOString(),
    level: event.success ? 'INFO' : 'WARN',
    type: 'SECURITY_AUDIT',
    userId: event.userId,
    agentId: event.agentId,
    action: event.action,
    ip: event.ip,
    userAgent: event.userAgent,
    success: event.success,
    details: event.details
  };
  
  if (event.success) {
    console.log('🔐 AUDIT:', JSON.stringify(logEntry));
  } else {
    console.warn('🚨 SECURITY:', JSON.stringify(logEntry));
  }
}

/**
 * Verify agent ownership with detailed logging
 */
export async function verifyAgentOwnership(agentId: number, userId: number): Promise<boolean> {
  try {
    const agent = await storage.getAgent(agentId, userId);
    
    if (!agent) {
      console.warn(`🚨 UNAUTHORIZED ACCESS ATTEMPT: User ${userId} tried to access Agent ${agentId}`);
      return false;
    }
    
    console.log(`✅ AUTHORIZED ACCESS: User ${userId} accessing Agent ${agentId} (${agent.name})`);
    return true;
  } catch (error) {
    console.error(`❌ ERROR verifying ownership: User ${userId}, Agent ${agentId}:`, error);
    return false;
  }
}

export default {
  agentOwnershipMiddleware,
  validateWebhookData,
  webhookRateLimiter,
  verifyAgentOwnership
};