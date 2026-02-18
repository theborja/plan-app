import bcrypt from "bcryptjs";
import prismaPkg from "@prisma/client";

const { PrismaClient } = prismaPkg;

const databaseUrl = process.env.DATABASE_URL ?? "";
const normalizedUrl = databaseUrl.trim();

if (!normalizedUrl || (!normalizedUrl.startsWith("postgres://") && !normalizedUrl.startsWith("postgresql://"))) {
  console.error("DATABASE_URL debe apuntar a PostgreSQL para ejecutar el seed.");
  process.exit(1);
}

const prisma = new PrismaClient();

async function upsertUser(email, password, role) {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.upsert({
    where: { email },
    update: { passwordHash, role, name: email },
    create: {
      email,
      passwordHash,
      name: email,
      role,
    },
  });
}

async function main() {
  await upsertUser("admin", "admin", "ADMIN");
  await upsertUser("user", "user", "USER");
  await upsertUser("mock", "mock", "USER");
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Seed completado.");
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
