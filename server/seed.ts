import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function seedDatabase() {
  try {
    // Verificar se o usuário admin já existe
    const existingAdmin = await storage.getUserByUsername("admin");
    if (existingAdmin) {
      console.log("👤 Usuário admin já existe");
      return;
    }

    // Criar usuário admin
    const hashedPassword = await hashPassword("admin123");
    await storage.createUser({
      username: "admin",
      name: "Administrador",
      email: "admin@sistema.com",
      password: hashedPassword,
      role: "admin",
    });

    console.log("✅ Usuário admin criado com sucesso");
    console.log("📧 Email: admin@sistema.com");
    console.log("🔑 Usuário: admin");
    console.log("🔒 Senha: admin123");
  } catch (error) {
    console.error("❌ Erro ao criar usuário admin:", error);
  }
}