/**
 * Lista TODAS as instâncias WhatsApp da org pra identificar quais são
 * dev / prod / teste e evitar tocar nas erradas.
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
const envLocal = "/Users/weydsonlima/nasaex-wey/.env.local";
if (existsSync(envLocal)) config({ path: envLocal });
config();

import prisma from "../src/lib/prisma";

async function main() {
  const instances = await prisma.whatsAppInstance.findMany({
    select: {
      id: true,
      instanceName: true,
      instanceId: true,
      phoneNumber: true,
      profileName: true,
      apiKey: true,
      isActive: true,
      trackingId: true,
      organizationId: true,
      createdAt: true,
      tracking: { select: { name: true } },
      organization: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(`\n${instances.length} instância(s) no DB local:\n`);

  for (const inst of instances) {
    console.log(`──────────────────────────────────────────`);
    console.log(`Nome:        ${inst.instanceName ?? "(sem nome)"}`);
    console.log(`Tracking:    ${inst.tracking?.name ?? inst.trackingId}`);
    console.log(`trackingId:  ${inst.trackingId}`);
    console.log(`Org:         ${inst.organization?.name ?? inst.organizationId}`);
    console.log(`Número:      ${inst.phoneNumber ?? "(não vinculado)"}`);
    console.log(`Profile:     ${inst.profileName ?? "-"}`);
    console.log(`uazapi ID:   ${inst.instanceId}`);
    console.log(`apiKey:      ${inst.apiKey?.slice(0, 8)}...${inst.apiKey?.slice(-4)}`);
    console.log(`Ativa:       ${inst.isActive}`);
    console.log(`Criada:      ${inst.createdAt}`);
  }
  console.log(`──────────────────────────────────────────\n`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
