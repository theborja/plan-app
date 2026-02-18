import bcrypt from "bcryptjs";
import prismaPkg from "@prisma/client";
import path from "node:path";

const { PrismaClient } = prismaPkg;

const sqlitePath = path.join(process.cwd(), "prisma", "dev.db").replace(/\\/g, "/");
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: `file:${sqlitePath}`,
    },
  },
});

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
