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

  // Get single agent
  app.get("/api/agents/:agentId", requireAuth, async (req, res) => {
    const user = getAuthenticatedUser(req);
    const agentId = parseInt(req.params.agentId);
    
    try {
      const agent = await storage.getAgent(agentId, user.id);
      if (!agent) {
        return res.status(404).json({ message: "Agente não encontrado" });
      }
      res.json(agent);
    } catch (error) {
      console.error('Error fetching agent:', error);
      res.status(500).json({ message: "Erro ao buscar agente" });
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

  // Get agent documents
  app.get("/api/agents/:agentId/documents", requireAuth, async (req, res) => {
    const user = getAuthenticatedUser(req);
    const agentId = parseInt(req.params.agentId);
    
    try {
      const agent = await storage.getAgent(agentId, user.id);
      if (!agent) {
        return res.status(404).json({ message: "Agente não encontrado" });
      }

      const documents = await storage.getRagDocumentsByAgent(agentId);
      
      // Ensure documents are properly formatted for JSON response
      const formattedDocuments = documents.map(doc => ({
        id: doc.id,
        originalName: doc.originalName || '',
        fileSize: doc.fileSize || 0,
        mimeType: doc.mimeType || '',
        processingStatus: doc.processingStatus || 'pending',
        contentPreview: doc.content ? doc.content.substring(0, 200) + '...' : '',
        hasEmbedding: !!doc.embedding,
        uploadedAt: doc.uploadedAt || new Date().toISOString(),
        agentId: doc.agentId
      }));
      
      res.json(formattedDocuments);
    } catch (error) {
      console.error('❌ Erro ao buscar documentos:', error);
      res.status(500).json({ message: "Erro ao buscar documentos", error: error.message });
    }
  });

  // Upload document to agent
  app.post("/api/agents/:agentId/upload-document", requireAuth, upload.single('document'), async (req: MulterRequest, res) => {
    const user = getAuthenticatedUser(req);
    const agentId = parseInt(req.params.agentId);
    
    try {
      const agent = await storage.getAgent(agentId, user.id);
      if (!agent) {
        return res.status(404).json({ message: "Agente não encontrado" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "Arquivo não enviado" });
      }

      console.log(`📄 Processando upload: ${req.file.originalname}`);
      
      try {
        // Simple document storage without complex processing
        console.log(`📄 Processando arquivo: ${req.file.originalname}, tamanho: ${req.file.size} bytes`);
        
        // Convert buffer to text for simple files
        let content = `[Arquivo ${req.file.originalname}]`;
        if (req.file.mimetype.includes('text/')) {
          content = req.file.buffer.toString('utf8');
        }
        
        // Create simple RAG document record
        const ragDocument = await storage.createRagDocument({
          agentId: agentId,
          filename: req.file.originalname,
          originalName: req.file.originalname,
          content: content,
          fileType: path.extname(req.file.originalname).toLowerCase(),
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          embedding: null,
          processingStatus: 'completed',
          uploadedBy: user.id,
          chunkIndex: 0,
          totalChunks: 1
        });
        
        console.log(`✅ Documento salvo: ${ragDocument.id}`);
        
        res.json({
          message: "Documento enviado com sucesso",
          document: {
            id: ragDocument.id,
            filename: ragDocument.filename,
            originalName: ragDocument.originalName,
            fileSize: ragDocument.fileSize,
            mimeType: ragDocument.mimeType,
            processingStatus: ragDocument.processingStatus
          }
        });
        
      } catch (processingError) {
        console.error('❌ Erro no processamento:', processingError);
        throw new Error(`Erro no processamento: ${processingError.message}`);
      }
      
    } catch (error) {
      console.error('❌ Erro no upload de documento:', error);
      res.status(500).json({ message: "Erro no upload", error: error.message });
    }
  });

  // Delete document from agent
  app.delete("/api/agents/:agentId/documents/:documentId", requireAuth, async (req, res) => {
    const user = getAuthenticatedUser(req);
    const agentId = parseInt(req.params.agentId);
    const documentId = parseInt(req.params.documentId);
    
    try {
      const agent = await storage.getAgent(agentId, user.id);
      if (!agent) {
        return res.status(404).json({ message: "Agente não encontrado" });
      }

      if (isNaN(documentId)) {
        return res.status(400).json({ message: "ID do documento inválido" });
      }

      console.log(`🗑️ Deletando documento RAG ${documentId} do usuário ${user.id}`);

      const deleted = await storage.deleteRagDocument(documentId, user.id);
      
      if (deleted) {
        res.json({ message: "Documento excluído com sucesso" });
      } else {
        res.status(404).json({ message: "Documento não encontrado" });
      }
      
    } catch (error) {
      console.error('❌ Erro ao excluir documento:', error);
      res.status(500).json({ message: "Erro ao excluir documento", error: error.message });
    }
  });

  // Update agent
  app.put("/api/agents/:agentId", requireAuth, async (req, res) => {
    const user = getAuthenticatedUser(req);
    const agentId = parseInt(req.params.agentId);
    
    try {
      console.log(`📝 Atualizando agente ${agentId} para usuário ${user.id}`);
      console.log(`📋 Dados recebidos:`, req.body);
      
      const agent = await storage.getAgent(agentId, user.id);
      if (!agent) {
        console.log(`❌ Agente ${agentId} não encontrado`);
        return res.status(404).json({ message: "Agente não encontrado" });
      }

      const updatedAgent = await storage.updateAgent(agentId, user.id, req.body);
      
      if (updatedAgent) {
        console.log(`✅ Agente ${agentId} atualizado com sucesso`);
        res.setHeader('Content-Type', 'application/json');
        res.json({
          id: updatedAgent.id,
          name: updatedAgent.name,
          description: updatedAgent.description,
          systemPrompt: updatedAgent.systemPrompt,
          knowledgeBase: updatedAgent.knowledgeBase,
          model: updatedAgent.model,
          temperature: updatedAgent.temperature,
          status: updatedAgent.status,
          ownerId: updatedAgent.ownerId,
          createdAt: updatedAgent.createdAt
        });
      } else {
        console.log(`❌ Falha ao atualizar agente ${agentId}`);
        res.status(404).json({ message: "Agente não encontrado" });
      }
      
    } catch (error) {
      console.error('❌ Erro ao atualizar agente:', error);
      res.status(500).json({ message: "Erro ao atualizar agente", error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}