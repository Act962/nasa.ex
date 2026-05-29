import { config } from "dotenv";
import { existsSync } from "node:fs";
const e = "/Users/weydsonlima/nasaex-wey/.env.local";
if (existsSync(e)) config({ path: e });
config();
import prisma from "../src/lib/prisma";
async function main() {
  const namePart = process.argv[2];
  const trackingId = process.argv[3] || undefined;
  const leads = await prisma.lead.findMany({
    where: {
      name: { contains: namePart, mode: "insensitive" },
      ...(trackingId ? { trackingId } : {}),
    },
    select: { id: true, name: true, phone: true, isActive: true, isArchived: true, statusFlow: true, trackingId: true },
    take: 5,
  });
  for (const l of leads) console.log(l);
}
main().catch(console.error).finally(() => prisma.$disconnect());
