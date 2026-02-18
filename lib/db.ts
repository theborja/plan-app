import { PrismaClient } from "@prisma/client";
import path from "node:path";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function getSqliteRuntimeUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw || !raw.startsWith("file:")) return raw;

  const localPath = path.join(process.cwd(), "prisma", "dev.db").replace(/\\/g, "/");
  return `file:${localPath}`;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: getSqliteRuntimeUrl(),
      },
    },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
