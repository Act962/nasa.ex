import { config } from "dotenv";
import { existsSync } from "node:fs";
const envLocal = "/Users/weydsonlima/nasaex-wey/.env.local";
if (existsSync(envLocal)) config({ path: envLocal });
config();

import prisma from "../src/lib/prisma";

async function main() {
  const wfs = await prisma.workflow.findMany({
    where: { trackingId: "cmoswhccb000bdaxb9y0pupsm" },
    select: {
      id: true,
      name: true,
      isActive: true,
      agentMode: true,
      folderId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  console.log(JSON.stringify(wfs, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
