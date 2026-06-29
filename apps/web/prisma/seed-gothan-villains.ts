/**
 * Cria os 4 vilões da GOTHAN CITY com credenciais email/senha.
 *
 * Idempotente — re-execução atualiza dados sem duplicar.
 *
 * Roda com:  npx tsx prisma/seed-gothan-villains.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter } as any);

const ORG_ID = "GHqaKGx2iD4Za5tnO8WzKbC8xUVBkPg0";

const VILLAINS = [
  { name: "Coringa", email: "coringaforevernasa@gmail.com", password: "coringa1", role: "moderador" },
  { name: "Duas-Caras", email: "duascarasnasa@gmail.com", password: "duascaras1", role: "owner" },
  { name: "Mulher-Gato", email: "mulhergatonasa@gmail.com", password: "mulhergato1", role: "admin" },
  { name: "Pinguim", email: "pinguimnasa@gmail.com", password: "pinguim1", role: "owner" },
] as const;

async function main() {
  console.log("🦇 Seed dos vilões de GOTHAN CITY...\n");

  const org = await prisma.organization.findUnique({ where: { id: ORG_ID } });
  if (!org) throw new Error(`Organização ${ORG_ID} não encontrada — rode o seed-gothan-city.ts primeiro.`);

  for (const v of VILLAINS) {
    const userId = await upsertUser(v);
    await upsertCredentialAccount(userId, v.password);
    await upsertMember(userId, v.role);
    console.log(`   ✔ ${v.name.padEnd(12)} ${v.email.padEnd(35)} role=${v.role}`);
  }

  console.log("\n✨ Pronto. Logue com:");
  for (const v of VILLAINS) console.log(`   ${v.email} / ${v.password}`);
}

async function upsertUser(v: typeof VILLAINS[number]): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { email: v.email } });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: v.name,
        emailVerified: true,
        onboardingCompletedAt: existing.onboardingCompletedAt ?? new Date(),
      },
    });
    return existing.id;
  }
  const created = await prisma.user.create({
    data: {
      id: randomUUID(),
      name: v.name,
      email: v.email,
      emailVerified: true,
      onboardingCompletedAt: new Date(),
    },
  });
  return created.id;
}

async function upsertCredentialAccount(userId: string, password: string) {
  const hash = await hashPassword(password);
  const existing = await prisma.account.findFirst({
    where: { userId, providerId: "credential" },
  });
  if (existing) {
    await prisma.account.update({
      where: { id: existing.id },
      data: { password: hash, updatedAt: new Date() },
    });
    return;
  }
  await prisma.account.create({
    data: {
      id: randomUUID(),
      userId,
      accountId: userId,
      providerId: "credential",
      password: hash,
      updatedAt: new Date(),
    },
  });
}

async function upsertMember(userId: string, role: string) {
  await prisma.member.upsert({
    where: { userId_organizationId: { userId, organizationId: ORG_ID } },
    create: { id: randomUUID(), userId, organizationId: ORG_ID, role, createdAt: new Date() },
    update: { role },
  });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Falha no seed:", err);
    process.exit(1);
  });
