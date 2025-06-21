import { Express } from "express";
import { storage } from "../storage";

function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Autenticação necessária" });
  }
  next();
}

export function registerCleanupRoutes(app: Express) {
  // Clean up phantom WhatsApp instances
  app.post("/api/admin/cleanup/whatsapp", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      console.log(`🧹 Iniciando limpeza de instâncias WhatsApp para usuário ${userId}`);
      
      // Get all agents for the user
      const agents = await storage.getAgentsByOwner(userId);
      const cleanupResults = [];
      
      for (const agent of agents) {
        try {
          const instance = await storage.getWhatsappInstance(agent.id);
          if (instance) {
            // Check if instance actually exists in gateway
            // For now, just log the found instances
            console.log(`📱 Instância encontrada: ${instance.instanceName} (Agente: ${agent.name})`);
            cleanupResults.push({
              agentId: agent.id,
              agentName: agent.name,
              instanceName: instance.instanceName,
              status: instance.status,
              action: "kept"
            });
          } else {
            cleanupResults.push({
              agentId: agent.id,
              agentName: agent.name,
              instanceName: null,
              status: "none",
              action: "no_instance"
            });
          }
        } catch (error) {
          console.error(`❌ Erro ao verificar agente ${agent.id}:`, error);
          cleanupResults.push({
            agentId: agent.id,
            agentName: agent.name,
            error: error.message,
            action: "error"
          });
        }
      }
      
      res.json({
        message: "Limpeza concluída",
        userId: userId,
        totalAgents: agents.length,
        results: cleanupResults
      });
    } catch (error) {
      console.error("❌ Erro na limpeza:", error);
      res.status(500).json({ message: "Erro na limpeza", error: error.message });
    }
  });

  // Force clean all WhatsApp instances for user
  app.delete("/api/admin/cleanup/whatsapp/all", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      console.log(`🗑️ Removendo todas as instâncias WhatsApp para usuário ${userId}`);
      
      const agents = await storage.getAgentsByOwner(userId);
      const deleteResults = [];
      
      for (const agent of agents) {
        try {
          const deleted = await storage.deleteWhatsappInstance(agent.id);
          deleteResults.push({
            agentId: agent.id,
            agentName: agent.name,
            deleted: deleted,
            action: deleted ? "deleted" : "not_found"
          });
        } catch (error) {
          console.error(`❌ Erro ao deletar instância do agente ${agent.id}:`, error);
          deleteResults.push({
            agentId: agent.id,
            agentName: agent.name,
            error: error.message,
            action: "error"
          });
        }
      }
      
      res.json({
        message: "Todas as instâncias removidas",
        userId: userId,
        results: deleteResults
      });
    } catch (error) {
      console.error("❌ Erro na remoção geral:", error);
      res.status(500).json({ message: "Erro na remoção", error: error.message });
    }
  });
}