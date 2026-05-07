/**
 * Seed para testar a feature de **Visibilidade de Workspace** (cross-org sharing).
 *
 * Cria/garante orgs adicionais e vincula um usuário-alvo com roles variadas,
 * cobrindo os 3 cenários do multi-select "Compartilhar com empresas":
 *   • owner/admin/moderador → cópia direta (canShareDirectly: true)
 *   • member               → "Solicitar acesso" (canShareDirectly: false, PENDING)
 *
 * Cada org criada já vem com 1 workspace + 4 colunas padrão pra cópia direta
 * funcionar sem degradar pra PENDING.
 *
 * Idempotente: roda quantas vezes quiser.
 *
 * Uso:
 *   npx tsx scripts/seed-cross-org-test.ts
 *
 * Variáveis opcionais:
 *   SEED_USER_EMAIL  email do user a vincular (default: duascarasnasa@gmail.com)
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const USER_EMAIL = process.env.SEED_USER_EMAIL ?? "duascarasnasa@gmail.com";

const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "");
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
} as any);
const prisma = new PrismaClient({ adapter } as any);

// ─── Cenários ──────────────────────────────────────────────────────────────
// Cada item define (orgName, slug, roleParaOUser).
// Roles owner/admin/moderador → cópia direta.
// Role member → flow PENDING / Solicitar acesso.

const SCENARIOS = [
  { name: "Wayne Enterprises", slug: "wayne-enterprises", role: "admin" },
  { name: "Daily Planet",      slug: "daily-planet",      role: "moderador" },
  { name: "Arkham Asylum",     slug: "arkham-asylum",     role: "owner" },
  { name: "LexCorp",           slug: "lexcorp",           role: "member" }, // PENDING flow
] as const;

const DEFAULT_COLUMNS = [
  { name: "Para fazer", order: 0 },
  { name: "Em progresso", order: 1 },
  { name: "Em revisão", order: 2 },
  { name: "Concluído", order: 3 },
];

function generateId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 8)}`;
}

async function ensureOrg(name: string, slug: string) {
  const existing = await prisma.organization.findFirst({
    where: { name },
    select: { id: true, slug: true },
  });
  if (existing) return existing.id;

  // Garantir slug único — se conflitar, sufixa.
  const slugConflict = await prisma.organization.findFirst({
    where: { slug },
    select: { id: true },
  });
  const finalSlug = slugConflict ? `${slug}-${Date.now().toString(36)}` : slug;

  const created = await prisma.organization.create({
    data: {
      name,
      slug: finalSlug,
      createdAt: new Date(),
    },
    select: { id: true },
  });
  return created.id;
}

async function ensureMember(
  organizationId: string,
  userId: string,
  role: string,
) {
  const existing = await prisma.member.findFirst({
    where: { organizationId, userId },
    select: { id: true, role: true },
  });
  if (existing) {
    if (existing.role !== role) {
      await prisma.member.update({
        where: { id: existing.id },
        data: { role },
      });
      return { created: false, updated: true };
    }
    return { created: false, updated: false };
  }

  await prisma.member.create({
    data: {
      id: generateId("mem"),
      organizationId,
      userId,
      role,
      createdAt: new Date(),
    },
  });
  return { created: true, updated: false };
}

async function ensureWorkspace(
  organizationId: string,
  userId: string,
  orgName: string,
) {
  // Procura primeiro workspace não-arquivado da org.
  const existing = await prisma.workspace.findFirst({
    where: { organizationId, isArchived: false },
    select: { id: true },
  });
  if (existing) return existing.id;

  const ws = await prisma.workspace.create({
    data: {
      name: `${orgName} — Workspace`,
      organizationId,
      createdBy: userId,
      members: {
        create: { userId, role: "OWNER" },
      },
      columns: {
        createMany: { data: DEFAULT_COLUMNS },
      },
    },
    select: { id: true },
  });
  return ws.id;
}

async function main() {
  console.log("🦇 Cross-org sharing test seed\n");

  const user = await prisma.user.findUnique({
    where: { email: USER_EMAIL },
    select: { id: true, name: true },
  });
  if (!user) {
    console.error(`❌ Usuário ${USER_EMAIL} não encontrado.`);
    console.error("   Crie a conta no NASA primeiro (signup) e rode novamente.");
    process.exit(1);
  }
  console.log(`👤 User: ${user.name} (${user.id})\n`);

  for (const scenario of SCENARIOS) {
    const orgId = await ensureOrg(scenario.name, scenario.slug);
    const memberRes = await ensureMember(orgId, user.id, scenario.role);
    const wsId = await ensureWorkspace(orgId, user.id, scenario.name);

    const memberLabel = memberRes.created
      ? "vinculado"
      : memberRes.updated
        ? `role atualizado pra ${scenario.role}`
        : "já vinculado";

    console.log(
      `🏢 ${scenario.name.padEnd(25)} role=${scenario.role.padEnd(10)} ${memberLabel} · ws=${wsId}`,
    );
  }

  console.log("\n✅ Pronto! Cenário de teste configurado.");
  console.log("\nFluxo de teste:");
  console.log("   1. Reload o NASA (Cmd+R) na sua sessão como Duas-caras");
  console.log("   2. Crie uma ação em qualquer workspace de Gothan City");
  console.log("   3. Abra o multi-select 'Compartilhar com empresas':");
  console.log("      • Wayne Enterprises  → ✓ admin (cópia direta)");
  console.log("      • Daily Planet       → ✓ moderador (cópia direta)");
  console.log("      • Arkham Asylum      → ✓ owner (cópia direta)");
  console.log("      • LexCorp            → 🔒 member (PENDING)");
  console.log("   4. Selecione todas + Criar");
  console.log("   5. Wayne/Daily/Arkham recebem cópia direta");
  console.log("   6. LexCorp fica PENDING (precisa do owner do LexCorp aprovar)");
  console.log(
    "      → como você é só `member` no LexCorp, NÃO consegue aprovar lá.",
  );
  console.log(
    "      Pra testar aprovação: troca pro owner do LexCorp ou roda esse",
  );
  console.log(
    "      seed mudando o role do LexCorp pra 'owner' temporariamente.\n",
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
