import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function getDatabaseUrl(): string | null {
  const raw = process.env.DATABASE_URL;
  if (!raw) return null;
  const normalized = raw.trim();
  if (normalized.startsWith("postgresql://") || normalized.startsWith("postgres://")) {
    return normalized;
  }
  return null;
}

function createMissingDatabaseProxy(): PrismaClient {
  return new Proxy({} as PrismaClient, {
    get() {
      throw new Error(
        "DATABASE_URL no configurada (o no es PostgreSQL). Configura una URL postgres:// o postgresql:// antes de usar auth/BBDD.",
      );
    },
  });
}

function createPrismaClient(): PrismaClient {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    return createMissingDatabaseProxy();
  }

  return new PrismaClient({
    datasources: {
      db: { url: databaseUrl },
    },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
