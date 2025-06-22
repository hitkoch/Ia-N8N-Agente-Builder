# Dockerfile Super Simplificado - Apenas para Build

FROM node:18-alpine

WORKDIR /app

# Copia os arquivos de dependência
COPY package*.json ./

# Instala TODAS as dependências
RUN npm install

# Copia todo o resto do código do projeto
COPY . .

EXPOSE 5000

# Comando para iniciar a aplicação
CMD ["tail", "-f", "/dev/null"]