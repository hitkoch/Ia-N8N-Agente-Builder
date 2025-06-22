import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { registerRoutes } from "./routes";
import { setupWebhookRoutes } from "./webhook";
import { keepAliveService } from "./keep-alive";
import { webhookOptimizer } from "./webhook-optimizer";
import { whatsappMonitor } from "./services/whatsapp-monitor";
import { seedDatabase } from "./seed";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware configuration
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.set('trust proxy', true);

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const requestPath = req.path;

  const originalResJson = res.json;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (requestPath.startsWith("/api")) {
      let logLine = `${req.method} ${requestPath} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }
      console.log(`${new Date().toLocaleTimeString("en-US", { hour12: true })} [express] ${logLine}`);
    }
  });

  next();
});

async function startServer() {
  const { createServer } = await import('http');
  const server = createServer(app);

  // Setup webhook routes with priority
  setupWebhookRoutes(app);
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });
  
  // Register API routes
  await registerRoutes(app);

  // Frontend serving logic
  if (process.env.NODE_ENV === "production") {
    // In production, serve static files from dist/public
    const staticPath = path.resolve(__dirname, "..", "dist", "public");
    app.use(express.static(staticPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(staticPath, 'index.html'));
    });
    console.log("📦 Serving static files for production");
  } else {
    // In development, serve static files from client directory
    const clientPath = path.resolve(__dirname, "..", "client");
    app.use(express.static(clientPath));
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api') || req.path === '/health') {
        return;
      }
      res.sendFile(path.join(clientPath, 'index.html'));
    });
    console.log("📁 Serving static files from client directory");
  }

  // Error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err.status || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    console.error("❌ Server error:", err);
  });

  const port = 5000;
  server.listen(port, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${port} in ${process.env.NODE_ENV} mode`);
    
    // Initialize database
    setTimeout(() => seedDatabase(), 1000);
    
    // Start production services
    if (process.env.NODE_ENV === 'production') {
      keepAliveService.start();
    }
    
    // Start optimization services
    setTimeout(async () => {
      try {
        await webhookOptimizer.preWarmCaches();
        webhookOptimizer.startPeriodicWarmup();
        whatsappMonitor.start();
      } catch (error) {
        console.log('Optimization services will retry later');
      }
    }, 3000);
  });
}

startServer().catch(err => {
  console.error("❌ Failed to start server:", err);
  process.exit(1);
});