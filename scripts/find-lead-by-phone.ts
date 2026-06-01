import { config } from "dotenv";
import { existsSync } from "node:fs";
const e = "/Users/weydsonlima/nasaex-wey/.env.local";
if (existsSync(e)) config({ path: e });
config();
import prisma from "../src/lib/prisma";
async function main() {
  const phone = process.argv[2];
  const trackingId = process.argv[3];
  const l = await prisma.lead.findFirst({
    where: { phone, trackingId },
    select: { id: true, name: true },
  });
  console.log(l);
}
main().catch(console.error).finally(() => prisma.$disconnect());
