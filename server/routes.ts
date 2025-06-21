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
  return `
<!-- Webchat do Agente IA: ${agent.name} -->
<div id="ai-webchat-${agent.id}"></div>
<script>
(function() {
  const agentId = ${agent.id};
  const baseUrl = '${baseUrl}';
  const agentName = '${agent.name}';
  
  // Estilos do webchat
  const styles = \`
    .ai-webchat {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 350px;
      height: 500px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      display: flex;
      flex-direction: column;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .ai-webchat-header {
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      color: white;
      padding: 16px;
      border-radius: 12px 12px 0 0;
      font-weight: 600;
    }
    .ai-webchat-messages {
      flex: 1;
      padding: 16px;
      overflow-y: auto;
      background: #f8fafc;
    }
    .ai-webchat-message {
      margin-bottom: 12px;
      padding: 8px 12px;
      border-radius: 8px;
      max-width: 80%;
    }
    .ai-webchat-user {
      background: #3b82f6;
      color: white;
      margin-left: auto;
    }
    .ai-webchat-agent {
      background: white;
      border: 1px solid #e2e8f0;
    }
    .ai-webchat-input {
      display: flex;
      padding: 16px;
      border-top: 1px solid #e2e8f0;
    }
    .ai-webchat-input input {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      outline: none;
    }
    .ai-webchat-input button {
      margin-left: 8px;
      padding: 8px 16px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
    }
    .ai-webchat-toggle {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 60px;
      height: 60px;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      border-radius: 50%;
      border: none;
      color: white;
      font-size: 24px;
      cursor: pointer;
      z-index: 10001;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    }
    @media (max-width: 768px) {
      .ai-webchat {
        width: 100%;
        height: 100%;
        bottom: 0;
        right: 0;
        border-radius: 0;
      }
    }
  \`;
  
  // Criar elementos
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
  
  const container = document.getElementById('ai-webchat-' + agentId);
  let isOpen = false;
  
  function createWebchat() {
    container.innerHTML = \`
      <button class="ai-webchat-toggle" onclick="toggleWebchat()">💬</button>
      <div class="ai-webchat" style="display: none;">
        <div class="ai-webchat-header">
          \${agentName}
          <button onclick="toggleWebchat()" style="float: right; background: none; border: none; color: white; font-size: 18px; cursor: pointer;">×</button>
        </div>
        <div class="ai-webchat-messages" id="messages-\${agentId}">
          <div class="ai-webchat-message ai-webchat-agent">
            Olá! Sou \${agentName}. Como posso ajudá-lo hoje?
          </div>
        </div>
        <div class="ai-webchat-input">
          <input type="text" id="input-\${agentId}" placeholder="Digite sua mensagem..." onkeypress="handleKeyPress(event)">
          <button onclick="sendMessage()">Enviar</button>
        </div>
      </div>
    \`;
  }
  
  window.toggleWebchat = function() {
    const webchat = container.querySelector('.ai-webchat');
    const toggle = container.querySelector('.ai-webchat-toggle');
    isOpen = !isOpen;
    webchat.style.display = isOpen ? 'flex' : 'none';
    toggle.style.display = isOpen ? 'none' : 'block';
  };
  
  window.handleKeyPress = function(event) {
    if (event.key === 'Enter') {
      sendMessage();
    }
  };
  
  window.sendMessage = function() {
    const input = document.getElementById('input-' + agentId);
    const messages = document.getElementById('messages-' + agentId);
    const message = input.value.trim();
    
    if (!message) return;
    
    // Adicionar mensagem do usuário
    const userMessage = document.createElement('div');
    userMessage.className = 'ai-webchat-message ai-webchat-user';
    userMessage.textContent = message;
    messages.appendChild(userMessage);
    
    input.value = '';
    messages.scrollTop = messages.scrollHeight;
    
    // Mostrar digitando...
    const typingMessage = document.createElement('div');
    typingMessage.className = 'ai-webchat-message ai-webchat-agent';
    typingMessage.textContent = 'Digitando...';
    typingMessage.id = 'typing-' + agentId;
    messages.appendChild(typingMessage);
    messages.scrollTop = messages.scrollHeight;
    
    // Enviar para API
    fetch(baseUrl + '/api/public/agents/' + agentId + '/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: message }),
    })
    .then(response => response.json())
    .then(data => {
      // Remover mensagem de digitando
      const typingEl = document.getElementById('typing-' + agentId);
      if (typingEl) typingEl.remove();
      
      // Adicionar resposta do agente
      const agentMessage = document.createElement('div');
      agentMessage.className = 'ai-webchat-message ai-webchat-agent';
      agentMessage.textContent = data.response || 'Desculpe, não consegui processar sua mensagem.';
      messages.appendChild(agentMessage);
      messages.scrollTop = messages.scrollHeight;
    })
    .catch(error => {
      // Remover mensagem de digitando
      const typingEl = document.getElementById('typing-' + agentId);
      if (typingEl) typingEl.remove();
      
      // Mostrar erro
      const errorMessage = document.createElement('div');
      errorMessage.className = 'ai-webchat-message ai-webchat-agent';
      errorMessage.textContent = 'Desculpe, ocorreu um erro. Tente novamente.';
      messages.appendChild(errorMessage);
      messages.scrollTop = messages.scrollHeight;
    });
  };
  
  // Inicializar
  createWebchat();
})();
</script>
<!-- Fim do Webchat -->`;
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

  // API pública para webchat (sem autenticação)
  app.post("/api/public/agents/:id/chat", async (req, res) => {
    const agentId = parseInt(req.params.id);
    const { message } = req.body;
    
    try {
      // Buscar agente público (apenas agentes ativos)
      const agents = await storage.getAgentsByOwner(1); // Assumindo que admin tem ID 1
      const publicAgent = agents.find(a => a.id === agentId && a.status === 'active');
      
      if (!publicAgent) {
        return res.status(404).json({ message: "Agente não encontrado ou inativo" });
      }
      
      const response = await agentService.testAgent(publicAgent, message);
      res.json({ response });
    } catch (error: any) {
      console.error("Erro no chat público:", error);
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
      if (!req.file) {
        return res.status(400).json({ message: "Nenhum arquivo enviado" });
      }

      const processedDoc = await documentProcessor.processFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      res.json(processedDoc);
    } catch (error: any) {
      console.error("Erro ao processar documento:", error);
      res.status(500).json({ message: "Falha ao processar documento", error: error.message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}