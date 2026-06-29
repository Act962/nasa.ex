/**
 * Backfill — preenche `Action.organizationId` em ações órfãs (criadas antes do
 * fix em `Action.create` que omitia o campo).
 *
 * Estratégia: pra cada Action com organizationId NULL, copia o `organizationId`
 * da Workspace dela. Workspace.organizationId é NOT NULL no schema, então é
 * sempre seguro.
 *
 * Rode com: npx tsx scripts/backfill-action-organization-id.ts
 *
 * Idempotente: ações que já têm organizationId não são tocadas.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const orphans = await prisma.action.count({
    where: { organizationId: null },
  });
  console.log(`Ações órfãs (organizationId IS NULL): ${orphans}`);
  if (orphans === 0) {
    console.log("✅ Nada a fazer.");
    return;
  }

  console.log("\n🔧 Aplicando backfill via SQL (1 query, atômico)...");
  const result = await prisma.$executeRawUnsafe(`
    UPDATE "actions" a
    SET organization_id = w.organization_id
    FROM "workspaces" w
    WHERE a.workspace_id = w.id
      AND a.organization_id IS NULL
  `);
  console.log(`✅ ${result} ações atualizadas.\n`);

  const remaining = await prisma.action.count({
    where: { organizationId: null },
  });
  console.log(`Ações órfãs restantes: ${remaining}`);
  if (remaining > 0) {
    console.log(
      "⚠️  Algumas ações ainda estão sem organizationId — provavelmente o workspace foi deletado. Investigue manualmente.",
    );
  }
}

main()
  .catch((e) => {
    console.error("❌ Falha:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
