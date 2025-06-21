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

  const httpServer = createServer(app);

  return httpServer;
}