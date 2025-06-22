// Substitua todo o conteúdo de server/db.ts por este código

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../shared/schema';

// Pega a string de conexão do ambiente.
const connectionString = process.env.DATABASE_URL;

// Validação para garantir que a variável de ambiente existe.
if (!connectionString) {
  throw new Error("A variável de ambiente DATABASE_URL não está definida.");
}

// Cria o cliente de conexão usando o pacote padrão 'postgres'.
const client = postgres(connectionString);

// Exporta a instância do Drizzle pronta para uso, com o schema e o novo cliente.
export const db = drizzle(client, { schema });

console.log("🐘 Conexão com o banco de dados Drizzle configurada com sucesso usando o driver 'postgres-js'.");