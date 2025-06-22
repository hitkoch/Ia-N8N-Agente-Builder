import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { seedDatabase } from "./seed";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupWebhookRoutes } from "./webhook";

const app = express();

// CORS configuration - must be BEFORE all routes
// Maximum openness for testing and webchat external integration
app.use(cors({ 
  origin: '*',  // Allow ALL origins
  credentials: false,  // Must be false when using origin: '*'
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  allowedHeaders: ['*'],  // Allow all headers
  preflightContinue: false,
  optionsSuccessStatus: 200  // Some legacy browsers choke on 204
}));

// Ensure webhooks work externally - explicit route handling
app.use('/api/whatsapp/webhook', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, apikey, x-api-key, authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  next();
});

// Handle preflight requests for webhook
app.options('/api/whatsapp/webhook', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, apikey, x-api-key, authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.status(200).end();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

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
  
  // Register API routes with absolute priority
  const server = await registerRoutes(app);

  // Setup Vite/static serving AFTER API routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
    setTimeout(() => seedDatabase(), 1000);
  } else {
    serveStatic(app);
    setTimeout(() => seedDatabase(), 1000);
  }

  // Error handler for API routes
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
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
    log(`serving on port ${port}`);
  });
})();
