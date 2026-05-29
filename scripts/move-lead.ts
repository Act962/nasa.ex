import { config } from "dotenv";
import { existsSync } from "node:fs";
const e = "/Users/weydsonlima/nasaex-wey/.env.local";
if (existsSync(e)) config({ path: e });
config();
import prisma from "../src/lib/prisma";
async function main() {
  const leadId = process.argv[2];
  const newTrackingId = process.argv[3];
  if (!leadId || !newTrackingId) {
    console.error("Uso: pnpm tsx scripts/move-lead.ts <leadId> <newTrackingId>");
    process.exit(1);
  }
  const t = await prisma.tracking.findUnique({
    where: { id: newTrackingId },
    select: { status: { orderBy: { order: "asc" }, take: 1, select: { id: true } } },
  });
  const updated = await prisma.lead.update({
    where: { id: leadId },
    data: {
      trackingId: newTrackingId,
      statusId: t?.status[0]?.id,
      isActive: true,
      isArchived: false,
      archivedAt: null,
      statusFlow: "ACTIVE",
    },
    select: { id: true, name: true, trackingId: true, isActive: true, statusFlow: true },
  });
  console.log("✓", updated);
}
main().catch(console.error).finally(() => prisma.$disconnect());
