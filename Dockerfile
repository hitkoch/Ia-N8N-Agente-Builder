# Dockerfile Final para Produção com Migração Embutida

# --- Estágio 1: Instalar TODAS as dependências (incluindo devDependencies) ---
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install

# --- Estágio 2: Construir o código e rodar a migração ---
FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# A linha abaixo é a mais importante. Ela executa a migração.
# O Easypanel irá fornecer a DATABASE_URL como variável de ambiente neste passo.
RUN npm run db:push

# --- Estágio 3: Imagem final de produção ---
FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production

# Copia as dependências de produção do primeiro estágio
COPY --from=deps /app/package*.json ./
RUN npm install --omit=dev

# Copia o código da aplicação já "buildado" e "migrado" do segundo estágio
COPY --from=builder /app ./

EXPOSE 5000

# Comando para iniciar a aplicação
CMD ["npx", "tsx", "server/index.ts"]