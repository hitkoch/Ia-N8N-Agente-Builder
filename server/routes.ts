import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import { documentProcessor } from "./services/document-processor";

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { agentService } from "./services/agent";
import { whatsappGatewayService } from "./services/whatsapp-gateway";
import { multimediaService } from "./services/multimedia";
import { validateWebhookData, webhookRateLimiter, agentOwnershipMiddleware } from "./middleware/security";
import { registerWhatsAppStatusRoutes } from "./routes/whatsapp-status";

import type { Agent } from "@shared/schema";

function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Autenticação necessária" });
  }
  next();
}

function getAuthenticatedUser(req: any) {
  return req.user;
}

function generateWebchatCode(agent: Agent, baseUrl: string): string {
  return `<!-- Cole este código antes do fechamento da tag </body> do seu site -->
<script 
  src="${baseUrl}/js/webchat-loader.js" 
  data-agent-id="${agent.id}"
  data-agent-name="${agent.name.replace(/"/g, '&quot;')}"
  data-primary-color="#022b44"
  data-accent-color="#b8ec00"
  data-title="${agent.name.replace(/"/g, '&quot;')}"
  data-subtitle="Como posso ajudar você hoje?"
  defer>
</script>`;
}

export function registerRoutes(app: Express): Server {
  // Webhook routes are now handled in webhook.ts

  // Other routes
  setupAuth(app);
  registerWhatsAppStatusRoutes(app);

  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
  });

  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    const user = getAuthenticatedUser(req);
    
    try {
      const agents = await storage.getAgentsByOwner(user.id);
      const evolutionInstances = await storage.getEvolutionInstancesByOwner(user.id);
      
      const stats = {
        totalAgents: agents.length,
        activeAgents: agents.filter(a => a.status === "active").length,
        integrations: evolutionInstances.length,
        totalConversations: 0
      };
      
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar estatísticas" });
    }
  });

  app.get("/api/user", requireAuth, (req, res) => {
    const user = getAuthenticatedUser(req);
    res.json(user);
  });

  app.get("/api/agents", requireAuth, async (req, res) => {
    const user = getAuthenticatedUser(req);
    
    try {
      const agents = await storage.getAgentsByOwner(user.id);
      res.json(agents);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar agentes" });
    }
  });

  // Multimedia processing endpoints
  app.post("/api/agents/:agentId/multimedia/audio", requireAuth, upload.single('audio'), async (req: MulterRequest, res) => {
    const user = getAuthenticatedUser(req);
    const agentId = parseInt(req.params.agentId);
    
    try {
      const agent = await storage.getAgent(agentId, user.id);
      if (!agent) {
        return res.status(404).json({ message: "Agente não encontrado" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "Arquivo de áudio não enviado" });
      }

      console.log('🎤 Processando áudio via API...');
      
      // Process audio
      const audioResult = await multimediaService.processMultimediaMessage(
        req.file.buffer,
        req.file.mimetype,
        ''
      );

      // Generate AI response
      const aiResponse = await agentService.testAgent(agent, audioResult.text);
      
      let audioResponse = null;
      if (req.body.voice_response === 'true' && aiResponse) {
        console.log('🗣️ Gerando resposta em voz...');
        const voiceResult = await multimediaService.generateVoiceResponse(aiResponse);
        audioResponse = voiceResult.audioBuffer.toString('base64');
      }

      res.json({
        transcription: audioResult.text,
        analysis: audioResult.analysis,
        response: aiResponse,
        audioResponse
      });

    } catch (error) {
      console.error('❌ Erro no processamento de áudio:', error);
      res.status(500).json({ message: "Erro ao processar áudio", error: error.message });
    }
  });

  app.post("/api/agents/:agentId/multimedia/image", requireAuth, upload.single('image'), async (req: MulterRequest, res) => {
    const user = getAuthenticatedUser(req);
    const agentId = parseInt(req.params.agentId);
    
    try {
      const agent = await storage.getAgent(agentId, user.id);
      if (!agent) {
        return res.status(404).json({ message: "Agente não encontrado" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "Arquivo de imagem não enviado" });
      }

      console.log('🖼️ Processando imagem via API...');
      
      // Process image
      const imageResult = await multimediaService.processMultimediaMessage(
        req.file.buffer,
        req.file.mimetype,
        ''
      );

      // Generate AI response
      const aiResponse = await agentService.testAgent(agent, imageResult.text);
      
      let audioResponse = null;
      if (req.body.voice_response === 'true' && aiResponse) {
        console.log('🗣️ Gerando resposta em voz...');
        const voiceResult = await multimediaService.generateVoiceResponse(aiResponse);
        audioResponse = voiceResult.audioBuffer.toString('base64');
      }

      res.json({
        analysis: imageResult.analysis,
        description: imageResult.text,
        response: aiResponse,
        audioResponse
      });

    } catch (error) {
      console.error('❌ Erro no processamento de imagem:', error);
      res.status(500).json({ message: "Erro ao processar imagem", error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}