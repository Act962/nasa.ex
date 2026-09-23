/**
 * Seed do catálogo de preços do Simulador do Forge para uma organização.
 *
 * Rode com:  npx tsx prisma/seed-forge-price-catalog.ts <organizationId>
 *
 * Idempotente — usa upsert na chave única (organizationId, category, code).
 * Se nenhum organizationId for passado, usa a primeira organização do banco.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { seedForgePriceCatalog } from "../src/features/forge/lib/seed-price-catalog";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter } as never);

async function main() {
  const argOrgId = process.argv[2];
  const organizationId =
    argOrgId ?? (await prisma.organization.findFirst({ select: { id: true } }))?.id;

  if (!organizationId) {
    throw new Error("Nenhuma organização encontrada. Informe um organizationId.");
  }

  const count = await seedForgePriceCatalog(prisma, organizationId);
  console.log(`✓ ${count} itens de preço semeados para a org ${organizationId}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
