# 1. Estágio de Dependências
FROM node:18-alpine AS deps
WORKDIR /app

# Copia os arquivos de dependência
COPY package*.json ./

# Instala TODAS as dependências para que possamos usar 'drizzle-kit'
RUN npm install

# 2. Estágio de Build
FROM node:18-alpine AS builder
WORKDIR /app

# Copia as dependências do estágio anterior
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# (Opcional, mas recomendado) Se você tiver um passo de build TypeScript (tsc), ele viria aqui.
# Por enquanto, vamos assumir que 'tsx' roda o TS diretamente.

# 3. Estágio de Produção
FROM node:18-alpine
WORKDIR /app

# Define o fuso horário para o Brasil (útil para agendamentos, etc.)
ENV TZ=America/Sao_Paulo

# Copia as dependências de produção
COPY --from=deps /app/package*.json ./
RUN npm install --omit=dev

# Copia o código da aplicação do estágio de build
COPY --from=builder /app ./

EXPOSE 5000

# Comando para iniciar a aplicação
CMD ["npx", "tsx", "server/index.ts"]