import { Express } from "express";
import { storage } from "../storage";
import { whatsappGatewayService } from "../services/whatsapp-gateway";

export function registerWhatsAppStatusRoutes(app: Express) {
  // Get status for all agents (for dashboard overview)
  app.get("/api/whatsapp/status/all", async (req: any, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Não autenticado" });
    }

    try {
      const userId = req.user.id;
      const agents = await storage.getAgentsByOwner(userId);
      const statusPromises = agents.map(async (agent) => {
        try {
          const instance = await storage.getWhatsappInstance(agent.id);
          return {
            agentId: agent.id,
            agentName: agent.name,
            status: instance?.status || "NOT_CONFIGURED",
            instanceName: instance?.instanceName,
            lastUpdated: instance?.updatedAt
          };
        } catch (error) {
          return {
            agentId: agent.id,
            agentName: agent.name,
            status: "ERROR",
            error: error.message
          };
        }
      });

      const statuses = await Promise.all(statusPromises);
      res.json(statuses);
    } catch (error) {
      console.error("❌ Erro ao obter status geral:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Get real-time activity for a specific agent
  app.get("/api/agents/:agentId/whatsapp/activity", async (req: any, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Não autenticado" });
    }

    try {
      const userId = req.user.id;
      const agentId = parseInt(req.params.agentId);
      
      // Verify ownership
      const agent = await storage.getAgent(agentId, userId);
      if (!agent) {
        return res.status(404).json({ message: "Agente não encontrado" });
      }

      const instance = await storage.getWhatsappInstance(agentId);
      if (!instance) {
        return res.status(404).json({ message: "Instância WhatsApp não encontrada" });
      }

      // Get activity from gateway service
      const activity = await whatsappGatewayService.getInstanceActivity(instance.instanceName);
      
      res.json({
        activity: activity || [],
        stats: {
          messagesReceived: activity?.filter(a => a.type === 'message_received').length || 0,
          messagesSent: activity?.filter(a => a.type === 'message_sent').length || 0,
          uptime: instance.status === "CONNECTED" ? 100 : 0,
          responseTime: Math.random() * 2 + 0.5 // Simulated for now
        }
      });
    } catch (error) {
      console.error("❌ Erro ao obter atividade:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Get WhatsApp instance status for a specific agent
  app.get("/api/agents/:agentId/whatsapp/status", async (req: any, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Não autenticado" });
    }

    try {
      const userId = req.user.id;
      const agentId = parseInt(req.params.agentId);
      
      // Verify ownership
      const agent = await storage.getAgent(agentId, userId);
      if (!agent) {
        return res.status(404).json({ message: "Agente não encontrado" });
      }

      const instance = await storage.getWhatsappInstance(agentId);
      if (!instance) {
        return res.status(404).json({ message: "Instância WhatsApp não encontrada" });
      }

      try {
        // Get status from Evolution API
        const gatewayStatus = await whatsappGatewayService.getInstanceStatus(instance.instanceName);
        
        // Map Evolution API states to our system states
        const mappedStatus = gatewayStatus.connectionStatus === 'open' ? 'CONNECTED' : 
                            gatewayStatus.connectionStatus === 'close' ? 'DISCONNECTED' : 
                            gatewayStatus.connectionStatus || 'UNKNOWN';

        // Update local database with fresh status
        const updatedInstance = await storage.updateWhatsappInstanceByName(instance.instanceName, {
          status: mappedStatus,
          qrCode: gatewayStatus.qrcode?.base64 || null
        });

        res.json({
          instanceName: instance.instanceName,
          status: mappedStatus,
          connectionStatus: gatewayStatus.connectionStatus,
          qrCode: gatewayStatus.qrcode?.base64,
          ownerJid: gatewayStatus.ownerJid,
          profileName: gatewayStatus.profileName,
          lastUpdated: new Date().toISOString()
        });
      } catch (gatewayError) {
        console.error(`❌ Erro ao obter status do gateway:`, gatewayError);
        
        // Return cached status if gateway fails
        res.json({
          instanceName: instance.instanceName,
          status: instance.status || 'UNKNOWN',
          qrCode: instance.qrCode,
          error: 'Falha ao conectar com gateway',
          lastUpdated: instance.updatedAt
        });
      }
    } catch (error) {
      console.error("❌ Erro ao obter status da instância:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Server-Sent Events endpoint for real-time updates
  app.get("/api/agents/:agentId/whatsapp/events", (req: any, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Não autenticado" });
    }

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    const agentId = parseInt(req.params.agentId);
    
    // Send initial status
    const sendUpdate = async () => {
      try {
        const instance = await storage.getWhatsappInstance(agentId);
        if (instance) {
          res.write(`data: ${JSON.stringify({
            type: 'status_update',
            status: instance.status,
            timestamp: new Date().toISOString()
          })}\n\n`);
        }
      } catch (error) {
        console.error("Erro ao enviar atualização SSE:", error);
      }
    };

    // Send updates every 10 seconds
    const interval = setInterval(sendUpdate, 10000);
    
    // Send initial update
    sendUpdate();

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(interval);
    });
  });
}