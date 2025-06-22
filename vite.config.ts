import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url"; // Importa a função necessária
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// --- A CORREÇÃO PRINCIPAL ESTÁ AQUI ---
// Esta é a maneira padrão e segura de obter o diretório do arquivo atual em módulos ES.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(async () => ({ // Transforma em uma função assíncrona para o import dinâmico
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          // Mantém a importação dinâmica que já estava aqui
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      // Todas as resoluções de caminho agora usam a variável __dirname, que é segura
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  // A linha 'root' que estava causando o erro agora está correta
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
}));