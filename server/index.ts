import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { seedDatabase } from "./seed";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupWebhookRoutes } from "./webhook";
import { keepAliveService } from "./keep-alive";
import { webhookOptimizer } from "./webhook-optimizer";
import { whatsappMonitor } from "./services/whatsapp-monitor";

const app = express();

// 1. CORS deve vir primeiro, para lidar com as permissões de origem
app.use(cors({ origin: '*' }));

// 2. O parser de JSON deve vir em seguida, para que o corpo de todas as requisições POST/PUT seja transformado em um objeto
// A opção 'limit' é aumentada para garantir que payloads grandes (com mídia base64) não sejam rejeitados
app.use(express.json({ limit: '50mb' }));

// 3. O parser de URL encoded também é uma boa prática ter
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Trust proxy for correct IP detection
app.set('trust proxy', true);

// Log webhook requests only
app.use((req, res, next) => {
  if (req.url === '/api/whatsapp/webhook' || req.url === '/webhook') {
    console.log('📨 WEBHOOK REQUEST:', {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      body: req.body
    });
  }
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {


  // Setup webhook routes with ABSOLUTE PRIORITY
  setupWebhookRoutes(app);

  // Health check endpoint for keep-alive
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });
  
  // Register API routes with absolute priority
  const server = await registerRoutes(app);

  // --- LÓGICA DE SERVIDOR DE FRONTEND CORRIGIDA ---
  if (process.env.NODE_ENV === "development") {
    // Importação dinâmica: só carrega o vite em modo de desenvolvimento
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
    console.log("🌱 Servidor Vite configurado para desenvolvimento.");
    setTimeout(() => seedDatabase(), 1000);
  } else {
    // Em produção, apenas sirva os arquivos estáticos já construídos
    const { serveStatic } = await import("./vite");
    serveStatic(app);
    console.log("📦 Servindo arquivos estáticos para produção.");
    setTimeout(() => seedDatabase(), 1000);
  }

  // Error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    console.error("❌ Erro não tratado:", err);
  });

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`🚀 Servidor rodando na porta ${port} em modo ${process.env.NODE_ENV}`);
    
    if (process.env.NODE_ENV === 'production') {
      keepAliveService.start();
    }
    
    setTimeout(async () => {
      try {
        await webhookOptimizer.preWarmCaches();
        webhookOptimizer.startPeriodicWarmup();
        whatsappMonitor.start();
      } catch (error) {
        console.log('Cache warmup irá rodar mais tarde.');
      }
    }, 3000);
  });
})();
