import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { documentProcessor } from "./services/document-processor";

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { agentService } from "./services/agent";
import { whatsappGatewayService } from "./services/whatsapp-gateway";
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
  // Configurar autenticação
  setupAuth(app);
  
  // Register WhatsApp status routes
  registerWhatsAppStatusRoutes(app);
  


  // Configurar multer para upload de arquivos
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
  });

  // Rota das estatísticas do painel
  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    const user = getAuthenticatedUser(req);
    
    try {
      const agents = await storage.getAgentsByOwner(user.id);
      const evolutionInstances = await storage.getEvolutionInstancesByOwner(user.id);
      
      const stats = {
        totalAgents: agents.length,
        activeAgents: agents.filter(a => a.status === "active").length,
        integrations: evolutionInstances.length,
        conversations: 0, // Será calculado das conversas
      };
      res.json(stats);
    } catch (error: any) {
      console.error("Erro ao buscar estatísticas do painel:", error);
      res.status(500).json({ message: "Falha ao buscar estatísticas do painel" });
    }
  });

  // Rotas dos agentes
  app.get("/api/agents", requireAuth, async (req, res) => {
    const user = getAuthenticatedUser(req);
    
    try {
      const agents = await storage.getAgentsByOwner(user.id);
      res.json(agents);
    } catch (error: any) {
      console.error("Erro ao buscar agentes:", error);
      res.status(500).json({ message: "Falha ao buscar agentes" });
    }
  });

  app.get("/api/agents/:id", requireAuth, async (req, res) => {
    const agentId = parseInt(req.params.id);
    const user = getAuthenticatedUser(req);
    
    try {
      const agent = await storage.getAgent(agentId, user.id);
      if (!agent) {
        return res.status(404).json({ message: "Agente não encontrado" });
      }
      res.json(agent);
    } catch (error: any) {
      console.error("Erro ao buscar agente:", error);
      res.status(500).json({ message: "Falha ao buscar agente" });
    }
  });

  app.post("/api/agents", requireAuth, async (req, res) => {
    const user = getAuthenticatedUser(req);
    
    try {
      const agent = await storage.createAgent({
        ...req.body,
        ownerId: user.id,
      });
      res.status(201).json(agent);
    } catch (error: any) {
      console.error("Erro ao criar agente:", error);
      res.status(500).json({ message: "Falha ao criar agente" });
    }
  });

  app.put("/api/agents/:id", requireAuth, async (req, res) => {
    const agentId = parseInt(req.params.id);
    const user = getAuthenticatedUser(req);
    
    try {
      const agent = await storage.getAgent(agentId, user.id);
      if (!agent) {
        return res.status(404).json({ message: "Agente não encontrado" });
      }
      
      const updatedAgent = await storage.updateAgent(agentId, user.id, req.body);
      if (!updatedAgent) {
        return res.status(404).json({ message: "Agente não encontrado" });
      }
      
      res.json(updatedAgent);
    } catch (error: any) {
      console.error("Erro ao atualizar agente:", error);
      res.status(500).json({ message: "Falha ao atualizar agente" });
    }
  });

  app.delete("/api/agents/:id", requireAuth, async (req, res) => {
    const agentId = parseInt(req.params.id);
    const user = getAuthenticatedUser(req);
    
    try {
      const agent = await storage.getAgent(agentId, user.id);
      if (!agent) {
        return res.status(404).json({ message: "Agente não encontrado" });
      }
      
      const deleted = await storage.deleteAgent(agentId, user.id);
      if (!deleted) {
        return res.status(404).json({ message: "Agente não encontrado" });
      }
      
      res.status(204).send();
    } catch (error: any) {
      console.error("Erro ao deletar agente:", error);
      res.status(500).json({ message: "Falha ao deletar agente" });
    }
  });

  // Teste de agente
  app.post("/api/agents/:id/test", requireAuth, async (req, res) => {
    const agentId = parseInt(req.params.id);
    const { message } = req.body;
    const user = getAuthenticatedUser(req);
    
    try {
      const agent = await storage.getAgent(agentId, user.id);
      if (!agent) {
        return res.status(404).json({ message: "Agente não encontrado" });
      }
      
      const response = await agentService.testAgent(agent, message);
      res.json({ response });
    } catch (error: any) {
      console.error("Erro no teste do agente:", error);
      res.status(500).json({ message: error.message || "Falha ao testar agente" });
    }
  });

  // Código do webchat
  app.get("/api/agents/:id/webchat-code", requireAuth, async (req, res) => {
    const agentId = parseInt(req.params.id);
    const user = getAuthenticatedUser(req);
    
    try {
      const agent = await storage.getAgent(agentId, user.id);
      if (!agent) {
        return res.status(404).json({ message: "Agente não encontrado" });
      }
      
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const webchatCode = generateWebchatCode(agent, baseUrl);
      
      res.json({ 
        code: webchatCode,
        instructions: "Copie e cole este código em seu website para integrar o agente de IA"
      });
    } catch (error: any) {
      console.error("Erro ao gerar código do webchat:", error);
      res.status(500).json({ message: "Falha ao gerar código do webchat" });
    }
  });

  // Public webchat endpoint - no authentication required
  app.post("/api/webchat/:agentId/chat", async (req, res) => {
    try {
      const { agentId } = req.params;
      const { message } = req.body;

      console.log(`🤖 Webchat: recebida mensagem para agente ${agentId}: "${message}"`);
      console.log(`🌐 Origin: ${req.headers.origin || 'não especificado'}`);
      console.log(`🔍 User-Agent: ${req.headers['user-agent'] || 'não especificado'}`);

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ message: "Mensagem é obrigatória" });
      }

      // Get all agents from all owners to find the requested agent
      let agent = null;
      try {
        // Try to get from admin user first
        const adminAgents = await storage.getAgentsByOwner(1);
        agent = adminAgents.find(a => a.id === parseInt(agentId));
        
        // If not found, try other users (for testing)
        if (!agent) {
          console.log(`🔍 Agente ${agentId} não encontrado no admin, buscando em outros usuários...`);
          for (let userId = 2; userId <= 10; userId++) {
            try {
              const userAgents = await storage.getAgentsByOwner(userId);
              agent = userAgents.find(a => a.id === parseInt(agentId));
              if (agent) {
                console.log(`✅ Agente ${agentId} encontrado no usuário ${userId}`);
                break;
              }
            } catch (err) {
              // Continue searching
            }
          }
        }
      } catch (error) {
        console.error("Erro ao buscar agentes:", error);
      }
      
      if (!agent) {
        console.log(`❌ Agente ${agentId} não encontrado em nenhum usuário`);
        return res.status(404).json({ message: "Agente não encontrado" });
      }

      console.log(`🤖 Webchat: processando mensagem para agente "${agent.name}"`);
      const response = await agentService.testAgent(agent, message);
      console.log(`✅ Resposta gerada: "${response.substring(0, 100)}..."`);
      
      res.json({ response });
    } catch (error: any) {
      console.error("❌ Erro no webchat:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Rotas das instâncias Evolution
  app.get("/api/evolution-instances", requireAuth, async (req, res) => {
    const user = getAuthenticatedUser(req);
    
    try {
      const instances = await storage.getEvolutionInstancesByOwner(user.id);
      res.json(instances);
    } catch (error: any) {
      console.error("Erro ao buscar instâncias Evolution:", error);
      res.status(500).json({ message: "Falha ao buscar instâncias Evolution" });
    }
  });

  app.post("/api/evolution-instances", requireAuth, async (req, res) => {
    const user = getAuthenticatedUser(req);
    
    try {
      const instance = await storage.createEvolutionInstance({
        ...req.body,
        ownerId: user.id,
      });
      res.status(201).json(instance);
    } catch (error: any) {
      console.error("Erro ao criar instância Evolution:", error);
      res.status(500).json({ message: "Falha ao criar instância Evolution" });
    }
  });

  app.delete("/api/evolution-instances/:id", requireAuth, async (req, res) => {
    const instanceId = parseInt(req.params.id);
    const user = getAuthenticatedUser(req);
    
    try {
      const instance = await storage.getEvolutionInstance(instanceId, user.id);
      if (!instance) {
        return res.status(404).json({ message: "Instância Evolution não encontrada" });
      }
      
      const deleted = await storage.deleteEvolutionInstance(instanceId, user.id);
      if (!deleted) {
        return res.status(404).json({ message: "Instância Evolution não encontrada" });
      }
      
      res.status(204).send();
    } catch (error: any) {
      console.error("Erro ao deletar instância Evolution:", error);
      res.status(500).json({ message: "Falha ao deletar instância Evolution" });
    }
  });

  // Endpoint para processar documentos
  app.post("/api/process-document", requireAuth, upload.single('document'), async (req: MulterRequest, res) => {
    try {
      console.log('📁 Requisição de upload recebida');
      
      if (!req.file) {
        console.log('❌ Nenhum arquivo na requisição');
        return res.status(400).json({ message: "Nenhum arquivo enviado" });
      }

      console.log('📁 Arquivo recebido:', {
        name: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype
      });

      const processedDoc = await documentProcessor.processFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      console.log('✅ Documento processado com sucesso:', processedDoc.processingStatus);
      
      // Retornar apenas os dados básicos (sem embeddings) para o frontend
      const responseDoc = {
        filename: processedDoc.filename,
        originalName: processedDoc.originalName,
        content: processedDoc.content,
        fileSize: processedDoc.fileSize,
        mimeType: processedDoc.mimeType,
        processingStatus: processedDoc.processingStatus,
        error: processedDoc.error
      };
      
      res.json(responseDoc);
    } catch (error: any) {
      console.error("❌ Erro ao processar documento:", error);
      res.status(500).json({ message: "Falha ao processar documento", error: error.message });
    }
  });

  // Endpoint para processar e salvar documento na base de conhecimento do agente
  app.post("/api/agents/:agentId/upload-document", requireAuth, upload.single('document'), async (req: MulterRequest, res) => {
    try {
      const { agentId } = req.params;
      const user = getAuthenticatedUser(req);
      
      if (!req.file) {
        return res.status(400).json({ message: "Nenhum arquivo enviado" });
      }

      // Verificar se o agente pertence ao usuário
      const agent = await storage.getAgent(parseInt(agentId), user.id);
      if (!agent) {
        return res.status(404).json({ message: "Agente não encontrado" });
      }

      console.log('📁 Processando e salvando documento para agente:', agentId);

      // Processar o documento com embeddings
      const processedDoc = await documentProcessor.processFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      // Verificar se o documento foi processado corretamente
      if (!processedDoc.content || processedDoc.content.length < 50) {
        console.log('❌ Documento sem conteúdo válido');
        return res.status(400).json({ message: "Documento não contém texto válido" });
      }

      console.log(`📄 Salvando documento com ${processedDoc.content.length} caracteres`);
      console.log(`🔮 Embeddings: ${processedDoc.embedding ? 'presentes' : 'ausentes'}`);

      // Salvar diretamente na tabela RAG
      const ragDoc = await storage.createRagDocument({
        agentId: parseInt(agentId),
        filename: processedDoc.filename,
        originalName: processedDoc.originalName,
        content: processedDoc.content,
        embedding: processedDoc.embedding || null,
        fileSize: processedDoc.fileSize,
        mimeType: processedDoc.mimeType,
        uploadedBy: user.id
      });

      console.log('📄 Documento salvo na base de conhecimento:', ragDoc.originalName);

      // Retornar documento sem embeddings para o frontend
      const responseDoc = {
        id: ragDoc.id,
        filename: ragDoc.filename,
        originalName: ragDoc.originalName,
        content: ragDoc.content,
        fileSize: ragDoc.fileSize,
        mimeType: ragDoc.mimeType,
        processingStatus: processedDoc.processingStatus,
        uploadedAt: ragDoc.uploadedAt
      };

      res.json(responseDoc);
    } catch (error: any) {
      console.error("❌ Erro ao processar e salvar documento:", error);
      res.status(500).json({ message: "Falha ao processar documento", error: error.message });
    }
  });

  // Endpoint para listar documentos da base de conhecimento do agente
  app.get("/api/agents/:agentId/documents", requireAuth, async (req, res) => {
    try {
      const { agentId } = req.params;
      const user = getAuthenticatedUser(req);

      // Verificar se o agente pertence ao usuário
      const agent = await storage.getAgent(parseInt(agentId), user.id);
      if (!agent) {
        return res.status(404).json({ message: "Agente não encontrado" });
      }

      const documents = await storage.getRagDocumentsByAgent(parseInt(agentId));
      
      // Retornar documentos sem embeddings para o frontend
      const responseDocuments = documents.map(doc => ({
        id: doc.id,
        filename: doc.filename,
        originalName: doc.originalName,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        uploadedAt: doc.uploadedAt,
        content: doc.content ? doc.content.substring(0, 200) + '...' : ''
      }));

      res.json(responseDocuments);
    } catch (error: any) {
      console.error("❌ Erro ao listar documentos:", error);
      res.status(500).json({ message: "Falha ao listar documentos", error: error.message });
    }
  });

  // Endpoint para excluir documento da base de conhecimento do agente
  app.delete("/api/agents/:agentId/documents/:documentId", requireAuth, async (req, res) => {
    try {
      const { agentId, documentId } = req.params;
      const user = getAuthenticatedUser(req);

      // Verificar se o agente pertence ao usuário
      const agent = await storage.getAgent(parseInt(agentId), user.id);
      if (!agent) {
        return res.status(404).json({ message: "Agente não encontrado" });
      }

      console.log(`🗑️ Excluindo documento ${documentId} do agente ${agentId}`);

      // Excluir documento e todos os embeddings associados
      const deleted = await storage.deleteRagDocument(parseInt(documentId), user.id);
      
      if (deleted) {
        console.log(`✅ Documento ${documentId} excluído com sucesso`);
        res.json({ message: "Documento excluído com sucesso" });
      } else {
        res.status(404).json({ message: "Documento não encontrado" });
      }
    } catch (error: any) {
      console.error("❌ Erro ao excluir documento:", error);
      res.status(500).json({ message: "Falha ao excluir documento", error: error.message });
    }
  });

  // Debug endpoint to check CORS headers
  app.options("/api/webchat/:agentId/chat", (req, res) => {
    console.log(`🔍 CORS preflight para agente ${req.params.agentId}`);
    console.log(`🌐 Origin: ${req.headers.origin || 'não especificado'}`);
    console.log(`🔧 Method: ${req.headers['access-control-request-method'] || 'não especificado'}`);
    console.log(`📋 Headers: ${req.headers['access-control-request-headers'] || 'não especificado'}`);
    
    res.status(200).end();
  });

  // WhatsApp Integration Routes
  
  // Get WhatsApp instance for agent
  app.get("/api/agents/:agentId/whatsapp", requireAuth, async (req, res) => {
    try {
      const { agentId } = req.params;
      const user = getAuthenticatedUser(req);
      
      // Verify agent ownership
      const agent = await storage.getAgent(parseInt(agentId), user.id);
      if (!agent) {
        return res.status(404).json({ message: "Agente não encontrado" });
      }
      
      const whatsappInstance = await storage.getWhatsappInstance(parseInt(agentId));
      
      if (!whatsappInstance) {
        return res.status(404).json({ 
          message: "Instância WhatsApp não encontrada",
          agentId: parseInt(agentId),
          hasInstance: false
        });
      }
      
      res.json(whatsappInstance);
    } catch (error: any) {
      console.error("❌ Erro ao buscar instância WhatsApp:", error);
      res.status(500).json({ message: "Falha ao buscar instância WhatsApp", error: error.message });
    }
  });

  // Create WhatsApp instance for agent
  app.post("/api/agents/:agentId/whatsapp/create", requireAuth, agentOwnershipMiddleware, async (req, res) => {
    try {
      const { agentId } = req.params;
      const user = getAuthenticatedUser(req);
      
      // Verify agent ownership
      const agent = await storage.getAgent(parseInt(agentId), user.id);
      if (!agent) {
        return res.status(404).json({ message: "Agente não encontrado" });
      }
      
      // Check if instance already exists
      const existingInstance = await storage.getWhatsappInstance(parseInt(agentId));
      if (existingInstance) {
        return res.status(400).json({ message: "Instância WhatsApp já existe para este agente" });
      }
      
      // Generate unique instance name
      const instanceName = whatsappGatewayService.generateInstanceName(parseInt(agentId), user.id);
      
      // Create instance via gateway
      const gatewayResponse = await whatsappGatewayService.createInstance(instanceName);
      
      // Save to database
      const whatsappInstance = await storage.createWhatsappInstance({
        instanceName,
        status: gatewayResponse.instance.status,
        qrCode: gatewayResponse.qrcode?.base64 || null,
        agentId: parseInt(agentId)
      });
      
      console.log(`✅ Instância WhatsApp criada para agente ${agentId}: ${instanceName}`);
      res.status(201).json(whatsappInstance);
      
    } catch (error: any) {
      console.error("❌ Erro ao criar instância WhatsApp:", error);
      res.status(500).json({ message: "Falha ao criar instância WhatsApp", error: error.message });
    }
  });

  // Connect WhatsApp instance (generate new QR code)
  app.post("/api/agents/:agentId/whatsapp/connect", requireAuth, async (req, res) => {
    try {
      const { agentId } = req.params;
      const user = getAuthenticatedUser(req);
      
      // Verify agent ownership
      const agent = await storage.getAgent(parseInt(agentId), user.id);
      if (!agent) {
        return res.status(404).json({ message: "Agente não encontrado" });
      }
      
      const whatsappInstance = await storage.getWhatsappInstance(parseInt(agentId));
      if (!whatsappInstance) {
        return res.status(404).json({ message: "Instância WhatsApp não encontrada" });
      }
      
      // Connect via gateway
      const gatewayResponse = await whatsappGatewayService.connectInstance(whatsappInstance.instanceName);
      
      // Update database with new status and QR code
      const updatedInstance = await storage.updateWhatsappInstance(parseInt(agentId), {
        status: gatewayResponse.instance.status,
        qrCode: gatewayResponse.qrcode?.base64 || null
      });
      
      console.log(`🔌 Conectando instância WhatsApp ${whatsappInstance.instanceName}`);
      res.json(updatedInstance);
      
    } catch (error: any) {
      console.error("❌ Erro ao conectar instância WhatsApp:", error);
      res.status(500).json({ message: "Falha ao conectar instância WhatsApp", error: error.message });
    }
  });

  // Check WhatsApp instance status
  app.get("/api/agents/:agentId/whatsapp/status", requireAuth, async (req, res) => {
    try {
      const { agentId } = req.params;
      const user = getAuthenticatedUser(req);
      
      // Verify agent ownership
      const agent = await storage.getAgent(parseInt(agentId), user.id);
      if (!agent) {
        return res.status(404).json({ message: "Agente não encontrado" });
      }
      
      const whatsappInstance = await storage.getWhatsappInstance(parseInt(agentId));
      if (!whatsappInstance) {
        return res.status(404).json({ message: "Instância WhatsApp não encontrada" });
      }
      
      // Check status via gateway
      const gatewayResponse = await whatsappGatewayService.fetchInstance(whatsappInstance.instanceName);
      
      // If status is close/disconnected, generate new QR code
      let qrCode = whatsappInstance.qrCode;
      if (gatewayResponse.instance.status === 'close') {
        const connectResponse = await whatsappGatewayService.connectInstance(whatsappInstance.instanceName);
        qrCode = connectResponse.qrcode?.base64 || null;
      }
      
      // Update database with current status
      const updatedInstance = await storage.updateWhatsappInstance(parseInt(agentId), {
        status: gatewayResponse.instance.status,
        qrCode: qrCode
      });
      
      console.log(`📊 Status verificado para ${whatsappInstance.instanceName}: ${gatewayResponse.instance.status}`);
      res.json(updatedInstance);
      
    } catch (error: any) {
      console.error("❌ Erro ao verificar status da instância WhatsApp:", error);
      res.status(500).json({ message: "Falha ao verificar status", error: error.message });
    }
  });

  // Delete WhatsApp instance
  app.delete("/api/agents/:agentId/whatsapp", requireAuth, agentOwnershipMiddleware, async (req, res) => {
    try {
      const { agentId } = req.params;
      const user = getAuthenticatedUser(req);
      
      // Verify agent ownership
      const agent = await storage.getAgent(parseInt(agentId), user.id);
      if (!agent) {
        return res.status(404).json({ message: "Agente não encontrado" });
      }
      
      const whatsappInstance = await storage.getWhatsappInstance(parseInt(agentId));
      if (!whatsappInstance) {
        return res.status(404).json({ message: "Instância WhatsApp não encontrada" });
      }
      
      // Delete from gateway (silently fail if already deleted)
      try {
        await whatsappGatewayService.deleteInstance(whatsappInstance.instanceName);
      } catch (gatewayError) {
        console.warn(`⚠️ Erro ao deletar do gateway (pode já estar deletada): ${gatewayError.message}`);
      }
      
      // Delete from database
      const deleted = await storage.deleteWhatsappInstance(parseInt(agentId));
      
      if (deleted) {
        console.log(`🗑️ Instância WhatsApp removida: ${whatsappInstance.instanceName}`);
        res.status(200).json({ 
          message: "Instância removida com sucesso",
          instanceName: whatsappInstance.instanceName
        });
      } else {
        res.status(500).json({ message: "Falha ao remover instância do banco de dados" });
      }
      
    } catch (error: any) {
      console.error("❌ Erro ao remover instância WhatsApp:", error);
      res.status(500).json({ message: "Falha ao remover instância WhatsApp", error: error.message });
    }
  });

  // Webhook endpoint to receive messages from Evolution API Gateway
  app.post("/api/whatsapp/webhook", webhookRateLimiter, validateWebhookData, async (req, res) => {
    try {
      console.log('📨 Webhook recebido do gateway WhatsApp');
      console.log(`📋 Event: ${req.body.event}, Instance: ${req.body.instance}`);
      
      const { event, data, instance } = req.body;
      
      // SECURITY: Validate webhook data structure
      if (!event || !instance || typeof instance !== 'string') {
        console.warn('⚠️ Webhook malformado recebido:', req.body);
        return res.status(400).json({ 
          status: 'invalid_webhook',
          message: 'Missing required fields'
        });
      }
      
      // SECURITY: Validate instance name format
      if (!whatsappGatewayService.validateInstanceName(instance)) {
        console.warn(`⚠️ Nome de instância inválido recebido: ${instance}`);
        return res.status(400).json({ 
          status: 'invalid_instance_name',
          message: 'Instance name does not match expected format'
        });
      }
      
      // Processar apenas mensagens recebidas
      if (event === 'messages.upsert') {
        const message = data.message;
        const key = data.key;
        
        // Ignorar mensagens do próprio bot
        if (key.fromMe) {
          console.log('📤 Ignorando mensagem própria');
          return res.status(200).json({ status: 'ignored' });
        }
        
        // Extrair texto da mensagem
        const messageText = message.conversation || 
                           message.extendedTextMessage?.text || 
                           'Mensagem não suportada';
        
        const remoteJid = key.remoteJid;
        
        console.log(`💬 Mensagem recebida na instância ${instance}: ${messageText} de ${remoteJid}`);
        
        // SECURITY: Secure agent lookup by instance name
        // Only trust the instance name from the webhook - this is the primary security boundary
        console.log(`🔍 Procurando agente para instância: ${instance}`);
        
        let targetAgent = null;
        let targetAgentOwner = null;
        
        // Search through all users (this is safe because we only trust the instance name)
        // The instance name format agent-{userId}-{agentId}-whatsapp ensures proper isolation
        for (let userId = 1; userId <= 100; userId++) {
          try {
            const userAgents = await storage.getAgentsByOwner(userId);
            for (const agent of userAgents) {
              const whatsappInstance = await storage.getWhatsappInstance(agent.id);
              if (whatsappInstance && whatsappInstance.instanceName === instance) {
                targetAgent = agent;
                targetAgentOwner = userId;
                console.log(`✅ Agente encontrado: ${agent.name} (ID: ${agent.id}, Dono: ${userId})`);
                break;
              }
            }
            if (targetAgent) break;
          } catch (error) {
            // Continue searching - user might not exist
          }
        }
        
        if (!targetAgent) {
          console.warn(`❌ Agente não encontrado para a instância: ${instance} - possível tentativa de ataque`);
          return res.status(200).json({ 
            status: 'agent_not_found',
            message: 'Instance not found'
          });
        }
        
        console.log(`🤖 Processando mensagem para agente: ${targetAgent.name} (Dono: ${targetAgentOwner})`);
        
        // Generate response using the correct agent's configuration
        const responseText = await agentService.testAgent(targetAgent, messageText);
        
        // Validate response before sending
        if (!responseText || responseText.trim().length === 0) {
          console.warn(`⚠️ Resposta vazia gerada para agente ${targetAgent.id}`);
          return res.status(200).json({ 
            status: 'empty_response',
            message: 'No response generated'
          });
        }
        
        // Format phone number and send response
        const phoneNumber = whatsappGatewayService.formatPhoneNumber(remoteJid);
        
        try {
          await whatsappGatewayService.sendMessage(instance, phoneNumber, responseText);
          console.log(`✅ Resposta enviada para ${remoteJid}: ${responseText.substring(0, 100)}...`);
          
          return res.status(200).json({ 
            status: 'processed',
            agentId: targetAgent.id,
            responseLength: responseText.length
          });
        } catch (sendError) {
          console.error(`❌ Erro ao enviar mensagem via WhatsApp:`, sendError);
          return res.status(200).json({ 
            status: 'send_failed',
            error: sendError.message
          });
        }
      }
      
      // Outros tipos de eventos
      console.log(`📋 Evento não processado: ${event}`);
      res.status(200).json({ status: 'received' });
      
    } catch (error: any) {
      console.error('❌ Erro ao processar webhook WhatsApp:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Serve test page for webchat debugging
  app.get("/test-webchat", (req, res) => {
    const testHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Teste Webchat</title>
</head>
<body>
    <h1>Página de Teste do Webchat</h1>
    <p>Esta página simula um site externo com o webchat incorporado.</p>
    <p>Abra o console do navegador (F12) para ver os logs detalhados.</p>
    
    <!-- Código do webchat -->
    <script 
        src="/js/webchat-loader.js"
        data-agent-id="2"
        data-agent-name="teste 900"
        data-primary-color="#022b44"
        data-accent-color="#b8ec00">
    </script>
</body>
</html>`;
    res.send(testHtml);
  });

  // Serve debug page for external domain testing
  app.get("/debug-cors", (req, res) => {
    res.sendFile('debug_cors.html', { root: process.cwd() });
  });

  // Serve webhook test page
  app.get("/test-webhook", (req, res) => {
    res.sendFile('test-webhook.html', { root: process.cwd() });
  });

  // Serve WhatsApp dashboard
  app.get("/whatsapp-dashboard", (req, res) => {
    res.sendFile('client/public/dashboard.html', { root: process.cwd() });
  });

  // Serve WhatsApp management page
  app.get("/whatsapp.html", (req, res) => {
    res.sendFile('client/public/whatsapp.html', { root: process.cwd() });
  });

  // Serve test dashboard
  app.get("/test-dashboard", (req, res) => {
    res.sendFile('test-whatsapp-dashboard.html', { root: process.cwd() });
  });

  // Serve test interface
  app.get("/test-interface", (req, res) => {
    res.sendFile('test-whatsapp-interface.html', { root: process.cwd() });
  });

  // Serve demo page
  app.get("/demo", (req, res) => {
    res.sendFile('demo-whatsapp.html', { root: process.cwd() });
  });

  // Serve navigation test
  app.get("/test-nav", (req, res) => {
    res.sendFile('test-navigation.html', { root: process.cwd() });
  });

  // Serve menu test
  app.get("/menu-test", (req, res) => {
    res.sendFile('public/menu-test.html', { root: process.cwd() });
  });

  // Serve debug page
  app.get("/debug-menu", (req, res) => {
    res.sendFile('debug-menu.html', { root: process.cwd() });
  });

  // Serve cleanup test
  app.get("/cleanup-test", (req, res) => {
    res.sendFile('cleanup-test.html', { root: process.cwd() });
  });

  const httpServer = createServer(app);

  return httpServer;
}