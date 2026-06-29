import { config } from "dotenv";
import { existsSync } from "node:fs";
const e = "/Users/weydsonlima/nasaex-wey/.env.local";
if (existsSync(e)) config({ path: e });
config();

import prisma from "../src/lib/prisma";

async function main() {
  const trackingId = "cmpqztlub007vdxxb27ubal43";

  const t = await prisma.tracking.findUnique({
    where: { id: trackingId },
    select: { id: true, name: true, organizationId: true, organization: { select: { name: true, slug: true } } },
  });
  console.log("Tracking:", t);

  const agendas = await prisma.agenda.findMany({
    where: { organizationId: t?.organizationId },
    select: { id: true, name: true, slug: true, isActive: true },
  });
  console.log("\nAgendas da org:");
  for (const a of agendas) console.log(`  - ${a.name} slug=${a.slug} id=${a.id} ativa=${a.isActive}`);

  const tags = await prisma.tag.findMany({
    where: {
      organizationId: t?.organizationId,
      name: { in: ["Quer agendar", "AGENDA", "Follow-up 15", "Desistiu 90"] },
    },
    select: { id: true, name: true, slug: true, trackingId: true, archivedAt: true },
  });
  console.log("\nTags existentes:");
  for (const tag of tags) console.log(`  - "${tag.name}" id=${tag.id} trackingId=${tag.trackingId} arquivada=${!!tag.archivedAt}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
