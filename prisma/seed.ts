import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

function getRequiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`A variável ${name} não foi configurada.`);
  }

  return value;
}

function getAdminPasswordHash(): string {
  const encodedHash =
    process.env.ADMIN_PASSWORD_HASH_B64?.trim() ?? "";

  const rawHash =
    process.env.ADMIN_PASSWORD_HASH
      ?.trim()
      .replace(/\\\$/g, "$") ?? "";

  const passwordHash = encodedHash
    ? Buffer.from(encodedHash, "base64").toString("utf8")
    : rawHash;

  const hasValidPrefix =
    passwordHash.startsWith("$2a$") ||
    passwordHash.startsWith("$2b$") ||
    passwordHash.startsWith("$2y$");

  if (!passwordHash || !hasValidPrefix) {
    throw new Error(
      "Configure ADMIN_PASSWORD_HASH_B64 ou ADMIN_PASSWORD_HASH com um hash bcrypt válido.",
    );
  }

  return passwordHash;
}

async function main(): Promise<void> {
  const connectionString = getRequiredEnvironmentVariable("DIRECT_URL");

  const username = getRequiredEnvironmentVariable(
    "ADMIN_USERNAME",
  ).toLowerCase();

  const name =
    process.env.ADMIN_NAME?.trim() || "Administrador";

  const passwordHash = getAdminPasswordHash();

  if (!/^[a-z0-9._-]{3,50}$/.test(username)) {
    throw new Error(
      "ADMIN_USERNAME deve ter entre 3 e 50 caracteres e usar apenas letras minúsculas, números, ponto, hífen ou underline.",
    );
  }

  const adapter = new PrismaPg({
    connectionString,
  });

  const prisma = new PrismaClient({
    adapter,
  });

  try {
    const administrator = await prisma.user.upsert({
      where: {
        username,
      },
      update: {
        name,
        passwordHash,
        role: "ADMIN",
        active: true,
      },
      create: {
        name,
        username,
        passwordHash,
        role: "ADMIN",
        active: true,
      },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        active: true,
      },
    });

    console.log("Administrador configurado:", administrator);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Não foi possível executar o seed:", error);
  process.exitCode = 1;
});