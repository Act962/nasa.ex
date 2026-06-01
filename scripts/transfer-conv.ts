import { config } from "dotenv";
import { existsSync } from "node:fs";
const e = "/Users/weydsonlima/nasaex-wey/.env.local";
if (existsSync(e)) config({ path: e });
config();
import prisma from "../src/lib/prisma";
async function main() {
  const convId = process.argv[2];
  const newLeadId = process.argv[3];
  const updated = await prisma.conversation.update({
    where: { id: convId },
    data: { leadId: newLeadId },
    select: { id: true, leadId: true, trackingId: true },
  });
  console.log("✓ Conv transferida:", updated);
}
main().catch(console.error).finally(() => prisma.$disconnect());
