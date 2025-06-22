// Conteúdo completo e final para server/index.ts

import express from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupWebhookRoutes } from "./webhook";
import { keepAliveService } from "./keep-alive";
import { webhookOptimizer } from "./webhook-optimizer";
import { whatsappMonitor } from "./services/whatsapp-monitor";
import { seedDatabase } from "./seed";
// serveStatic será importado dinamicamente apenas quando necessário

const app = express();

// --- Configuração dos Middlewares ---
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.set('trust proxy', true);

// --- Função Principal de Inicialização ---
async function startServer() {
  const { createServer } = await import('http');
  const server = createServer(app);

  setupWebhookRoutes(app);
  
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });
  
  await registerRoutes(app);

  // --- LÓGICA DE AMBIENTE CORRIGIDA E SEGURA ---
  if (process.env.NODE_ENV === "production") {
    // Em produção, importa dinamicamente apenas a função serveStatic
    const { serveStatic } = await import("./vite");
    serveStatic(app);
    console.log("📦 Servindo arquivos estáticos para produção.");
  } else {
    // Em desenvolvimento, importa e configura o Vite dinamicamente.
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
    console.log("🌱 Servidor Vite configurado para desenvolvimento.");
  }

  const port = 5000;
  server.listen(port, "0.0.0.0", () => {
    console.log(`🚀 Servidor rodando na porta ${port} em modo ${process.env.NODE_ENV}`);
    
    // Seed database after server start
    setTimeout(() => seedDatabase(), 1000);
    
    if (process.env.NODE_ENV === 'production') {
      keepAliveService.start();
    }
    
    setTimeout(async () => {
      try {
        await webhookOptimizer.preWarmCaches();
        webhookOptimizer.startPeriodicWarmup();
        whatsappMonitor.start();
      } catch (error) {
        console.log('Cache warmup will run later.');
      }
    }, 3000);
  });
}

startServer().catch(err => {
  console.error("❌ Falha ao iniciar o servidor:", err);
  process.exit(1);
});