/**
 * Diagnóstico read-only do estado de cross-org sharing pro user-alvo.
 *
 * Uso:
 *   npx tsx scripts/diag-cross-org.ts
 *
 * Variáveis:
 *   SEED_USER_EMAIL  email a checar (default: duascarasnasa@gmail.com)
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const USER_EMAIL = process.env.SEED_USER_EMAIL ?? "duascarasnasa@gmail.com";

// SSL só em produção/remoto. Local Postgres geralmente é sem TLS.
const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "");
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
} as any);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: USER_EMAIL },
    select: { id: true, name: true, email: true },
  });

  if (!user) {
    console.log(`❌ Usuário ${USER_EMAIL} NÃO existe no DB.`);
    return;
  }

  console.log(`👤 ${user.name} (${user.email}) — id=${user.id}\n`);

  const memberships = await prisma.member.findMany({
    where: { userId: user.id },
    select: {
      role: true,
      organization: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { organization: { name: "asc" } },
  });

  console.log(`📋 Memberships (${memberships.length} orgs):`);
  for (const m of memberships) {
    const canShare = ["owner", "admin", "moderador"].includes(m.role)
      ? "✓ pode compartilhar direto"
      : "🔒 só Solicitar acesso";
    console.log(
      `   • ${m.organization.name.padEnd(25)} role=${m.role.padEnd(10)} ${canShare}`,
    );
  }

  // Simula o que listShareableOrgs retornaria pra cada org ativa do user
  console.log(`\n🔎 O que listShareableOrgs retorna pra cada org ativa:`);
  for (const m of memberships) {
    const others = memberships.filter(
      (x) => x.organization.id !== m.organization.id,
    );
    console.log(
      `\n   Quando ${m.organization.name} (role=${m.role}) é a org ativa:`,
    );
    if (others.length === 0) {
      console.log(`      (vazio)`);
    } else {
      for (const o of others) {
        console.log(
          `      • ${o.organization.name} role=${o.role}`,
        );
      }
    }
  }

  // Confere se as orgs do seed existem
  const SEED_NAMES = [
    "Wayne Enterprises",
    "Daily Planet",
    "Arkham Asylum",
    "LexCorp",
  ];
  console.log(`\n🌱 Status das orgs do seed:`);
  for (const name of SEED_NAMES) {
    const org = await prisma.organization.findFirst({
      where: { name },
      select: { id: true },
    });
    if (!org) {
      console.log(`   ❌ ${name}: NÃO existe — seed nunca rodou`);
    } else {
      const userMember = memberships.find((m) => m.organization.id === org.id);
      if (userMember) {
        console.log(`   ✓ ${name}: existe + user vinculado (${userMember.role})`);
      } else {
        console.log(
          `   ⚠️  ${name}: existe mas user NÃO está vinculado`,
        );
      }
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
