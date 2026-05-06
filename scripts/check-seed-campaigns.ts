import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const camps = await prisma.metaAdCampaign.findMany({
    where: { adAccountId: "act_seed-meta-demo" },
    select: { name: true, status: true, metaCampaignId: true },
    take: 10,
  });
  console.log(`Campanhas com adAccountId="act_seed-meta-demo":`, camps.length);
  for (const c of camps) console.log("  -", c.name, "|", c.status, "|", c.metaCampaignId);

  if (camps.length === 0) {
    const all = await prisma.metaAdCampaign.findMany({
      select: { name: true, adAccountId: true },
      take: 10,
    });
    console.log("\nNenhuma com act_seed-meta-demo. Outras campanhas no banco:");
    for (const c of all) console.log("  -", c.name, "|", c.adAccountId);
  }
}

main().finally(() => prisma.$disconnect());
