import { config } from "dotenv";
import { existsSync } from "node:fs";
const e = "/Users/weydsonlima/nasaex-wey/.env.local";
if (existsSync(e)) config({ path: e });
config();
import prisma from "../src/lib/prisma";
async function main() {
  const leadId = process.argv[2];
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      name: true,
      phone: true,
      leadTags: {
        select: {
          tag: { select: { id: true, name: true, color: true } },
        },
      },
    },
  });
  console.log("Lead:", lead?.name, lead?.phone, lead?.id);
  console.log("Tags:");
  for (const lt of lead?.leadTags ?? []) {
    console.log(`  - ${lt.tag.name} (${lt.tag.id})`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
