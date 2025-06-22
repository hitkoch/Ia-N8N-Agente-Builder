# Dockerfile de Produção Final - Alinhado com package.json

# --- Estágio 1: "builder" - Constrói o frontend e o backend ---
# Usamos a imagem Node.js completa para ter todas as ferramentas de build
FROM node:18 AS builder
WORKDIR /app

# Copia os arquivos de manifesto para otimizar o cache de layers
COPY package*.json ./

# Instala TODAS as dependências (incluindo devDependencies como vite, esbuild, typescript)
RUN npm install

# Copia todo o código fonte para o contêiner de build
COPY . .

# --- O PASSO DE BUILD CRUCIAL ---
# Executa o script 'build' exato do seu package.json
RUN npm run build

# --- Estágio 2: "production" - A imagem final, otimizada e limpa ---
FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production

# Copia o package.json para instalar apenas as dependências de produção
COPY package*.json ./
RUN npm install --omit=dev

# --- COPIA OS ARQUIVOS JÁ COMPILADOS ---
# Copia o backend e o frontend já 'buildados' do estágio anterior
COPY --from=builder /app/dist ./dist

EXPOSE 5000

# --- O COMANDO DE START CORRETO ---
# Roda o arquivo JavaScript compilado pelo esbuild, como definido no seu package.json
CMD ["node", "dist/index.js"]