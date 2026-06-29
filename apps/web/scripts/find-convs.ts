import { config } from "dotenv";
import { existsSync } from "node:fs";
const e = "/Users/weydsonlima/nasaex-wey/.env.local";
if (existsSync(e)) config({ path: e });
config();
import prisma from "../src/lib/prisma";
async function main() {
  const remoteJid = process.argv[2];
  const cs = await prisma.conversation.findMany({
    where: { remoteJid },
    select: {
      id: true,
      trackingId: true,
      leadId: true,
      tracking: { select: { name: true } },
      lead: { select: { name: true } },
    },
  });
  for (const c of cs) console.log(c);
}
main().catch(console.error).finally(() => prisma.$disconnect());
