# Dockerfile para Aplicação Node.js com Prisma (Versão Corrigida)

# 1. Estágio de Build
FROM node:18-alpine AS builder
WORKDIR /app

# Copia os arquivos de dependência
COPY package*.json ./

# Instala TODAS as dependências (incluindo as de desenvolvimento como 'prisma')
RUN npm install

# Copia o schema do Prisma
COPY prisma ./prisma/

# Gera o cliente do Prisma (agora usando a versão local)
RUN npx prisma generate

# Copia o resto do código da aplicação
COPY . .

# 2. Estágio de Produção
FROM node:18-alpine
WORKDIR /app

# Copia as dependências de produção do estágio de build
# O --omit=dev no segundo npm install cuida de remover as devDependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
RUN npm install --omit=dev

# Copia os arquivos de build (incluindo o cliente Prisma gerado e o código)
COPY --from=builder /app ./

EXPOSE 5000

CMD ["npx", "tsx", "server/index.ts"]