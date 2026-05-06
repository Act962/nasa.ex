/**
 * Bootstrap idempotente da org GOTHAN CITY e do owner (Batman).
 *
 * Os seeds seed-gothan-city.ts e seed-gothan-villains.ts esperam que esses
 * dois registros já existam — em ambiente recém-resetado eles não existem.
 * Roda antes deles.
 *
 * Uso:  npx tsx prisma/seed-gothan-bootstrap.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter } as any);

const ORG_ID = "GHqaKGx2iD4Za5tnO8WzKbC8xUVBkPg0";
const OWNER_ID = "oWg8TLUUfm8H963mdBllNITnmEvermcI";
const OWNER = {
  name: "Batman",
  email: "batman@wayne-enterprises.com",
  password: "batman1",
};

async function main() {
  console.log("🦇 Bootstrap GOTHAN CITY (org + owner)\n");

  // 1. User (Batman)
  const existingUser = await prisma.user.findUnique({ where: { id: OWNER_ID } });
  if (!existingUser) {
    await prisma.user.create({
      data: {
        id: OWNER_ID,
        name: OWNER.name,
        email: OWNER.email,
        emailVerified: true,
        onboardingCompletedAt: new Date(),
      },
    });
    console.log("   ✔ User criado: Batman");
  } else {
    console.log("   ⏭  User já existia");
  }

  // 2. Credential account (login email/senha)
  const hash = await hashPassword(OWNER.password);
  const existingAcc = await prisma.account.findFirst({
    where: { userId: OWNER_ID, providerId: "credential" },
  });
  if (existingAcc) {
    await prisma.account.update({
      where: { id: existingAcc.id },
      data: { password: hash, updatedAt: new Date() },
    });
    console.log("   ✔ Account credential atualizada");
  } else {
    await prisma.account.create({
      data: {
        id: randomUUID(),
        userId: OWNER_ID,
        accountId: OWNER_ID,
        providerId: "credential",
        password: hash,
        updatedAt: new Date(),
      },
    });
    console.log("   ✔ Account credential criada");
  }

  // 3. Organization
  const existingOrg = await prisma.organization.findUnique({ where: { id: ORG_ID } });
  if (!existingOrg) {
    await prisma.organization.create({
      data: {
        id: ORG_ID,
        name: "GOTHAN CITY",
        slug: "gothan-city",
        createdAt: new Date(),
      },
    });
    console.log("   ✔ Organization criada: GOTHAN CITY");
  } else {
    console.log("   ⏭  Organization já existia");
  }

  // 4. Member (owner)
  await prisma.member.upsert({
    where: { userId_organizationId: { userId: OWNER_ID, organizationId: ORG_ID } },
    create: {
      id: randomUUID(),
      userId: OWNER_ID,
      organizationId: ORG_ID,
      role: "owner",
      createdAt: new Date(),
    },
    update: { role: "owner" },
  });
  console.log("   ✔ Member owner ligado à org\n");

  console.log("✨ Bootstrap pronto. Login do Batman:");
  console.log(`   ${OWNER.email} / ${OWNER.password}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Falha no bootstrap:", err);
    process.exit(1);
  });
