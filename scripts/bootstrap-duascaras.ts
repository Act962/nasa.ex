/**
 * Bootstrap idempotente do usuário Duas-Caras + org Metropolis + PaymentAccess.
 * Uso: pnpm dlx tsx scripts/bootstrap-duascaras.ts
 *
 * Cria (ou atualiza sem quebrar) tudo o que o dev precisa pra testar o fluxo
 * do NASA Payment: user + account better-auth + organização + membership
 * como owner + PaymentAccess como OWNER com senha gerada.
 */
import { config } from "dotenv";
const externalDbUrl = process.env.DATABASE_URL;
config({ path: ".env" });
config({ path: ".env.local", override: true });
if (externalDbUrl) process.env.DATABASE_URL = externalDbUrl;

import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any);

const ORG_ID = "BlpVqU3raj0n7KWIoBpH1hCWeUt461hJ";
const OWNER_ID = "9ce0d7aa-c18a-49d3-9dec-7fd7526fb185";
const OWNER = {
  name: "Duas-Caras",
  email: "duascarasnasa@gmail.com",
  loginPassword: "duas1234",
};
const ORG = {
  name: "Metropolis",
  slug: "metropolis",
};

function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function main() {
  console.log("🎭 Bootstrap Duas-Caras (user + org Metropolis + PaymentAccess)\n");

  // 1. User Duas-Caras
  const hashedLogin = await hashPassword(OWNER.loginPassword);
  await prisma.user.upsert({
    where: { id: OWNER_ID },
    create: {
      id: OWNER_ID,
      name: OWNER.name,
      email: OWNER.email,
      emailVerified: true,
    },
    update: { name: OWNER.name, email: OWNER.email },
  });
  console.log(`✔ User ${OWNER.email}`);

  // 2. Account better-auth (email/password)
  const existingAccount = await prisma.account.findFirst({
    where: { userId: OWNER_ID, providerId: "credential" },
  });
  if (existingAccount) {
    await prisma.account.update({
      where: { id: existingAccount.id },
      data: { password: hashedLogin, updatedAt: new Date() },
    });
  } else {
    await prisma.account.create({
      data: {
        id: randomUUID(),
        userId: OWNER_ID,
        // Better-auth espera accountId = userId para credenciais locais
        accountId: OWNER_ID,
        providerId: "credential",
        password: hashedLogin,
        updatedAt: new Date(),
      },
    });
  }
  console.log("✔ Account better-auth (login: email + senha)");

  // 3. Organização Metropolis
  await prisma.organization.upsert({
    where: { id: ORG_ID },
    create: {
      id: ORG_ID,
      name: ORG.name,
      slug: ORG.slug,
      createdAt: new Date(),
    },
    update: { name: ORG.name, slug: ORG.slug },
  });
  console.log(`✔ Org ${ORG.name}`);

  // 4. Member owner
  const memberExists = await prisma.member.findFirst({
    where: { organizationId: ORG_ID, userId: OWNER_ID },
  });
  if (!memberExists) {
    await prisma.member.create({
      data: {
        id: randomUUID(),
        organizationId: ORG_ID,
        userId: OWNER_ID,
        role: "owner",
        createdAt: new Date(),
      },
    });
  }
  console.log("✔ Membership owner");

  // 5. PaymentAccess OWNER
  const pin = generatePin();
  const paymentHash = await bcrypt.hash(pin, 12);
  await prisma.paymentAccess.upsert({
    where: {
      userId_organizationId: { userId: OWNER_ID, organizationId: ORG_ID },
    },
    create: {
      userId: OWNER_ID,
      organizationId: ORG_ID,
      passwordHash: paymentHash,
      isAuthorized: true,
      role: "OWNER",
      authorizedById: OWNER_ID,
    },
    update: {
      passwordHash: paymentHash,
      isAuthorized: true,
      role: "OWNER",
    },
  });
  console.log("✔ PaymentAccess OWNER\n");

  console.log("=".repeat(48));
  console.log(`  Login app:       ${OWNER.email} / ${OWNER.loginPassword}`);
  console.log(`  Senha Payment:   ${pin}`);
  console.log("=".repeat(48));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
