# Dockerfile para Aplicação Node.js com Prisma

# 1. Estágio de Build: Instalar dependências e construir o projeto
FROM node:18-alpine AS builder
WORKDIR /app

# Instala o cliente do Prisma e o gerador
RUN npm install prisma -g

# Copia os arquivos de dependência
COPY package*.json ./

# Instala as dependências de produção
RUN npm install --omit=dev

# Copia o schema do Prisma
COPY prisma ./prisma/

# Gera o cliente do Prisma
RUN prisma generate

# Copia o resto do código da aplicação
COPY . .

# (Opcional) Se você tivesse um passo de build de TypeScript para JavaScript, ele viria aqui.
# Como estamos usando tsx, não é estritamente necessário.

# 2. Estágio de Produção: Imagem final e leve
FROM node:18-alpine
WORKDIR /app

# Copia as dependências de produção do estágio de build
COPY --from=builder /app/node_modules ./node_modules

# Copia os arquivos de build (incluindo o cliente Prisma gerado)
COPY --from=builder /app ./

# Expõe a porta que a aplicação vai usar
EXPOSE 5000

# Comando para iniciar a aplicação
# Usamos tsx para rodar o TypeScript diretamente.
CMD ["npx", "tsx", "server/index.ts"]