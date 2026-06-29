/**
 * Inspeciona as instâncias WhatsApp de um tracking pra debugar problemas de
 * envio (status no DB, modo In-Chat, apiKey, baseUrl).
 *
 * Uso: pnpm tsx scripts/check-whatsapp-instance.ts <trackingId>
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
const envLocal = "/Users/weydsonlima/nasaex-wey/.env.local";
if (existsSync(envLocal)) config({ path: envLocal });
config();

import prisma from "../src/lib/prisma";

async function main() {
  const trackingId = process.argv[2];
  if (!trackingId) {
    console.error("Uso: pnpm tsx scripts/check-whatsapp-instance.ts <trackingId>");
    process.exit(1);
  }

  const instances = await prisma.whatsAppInstance.findMany({
    where: { trackingId },
    select: {
      id: true,
      instanceName: true,
      instanceId: true,
      phoneNumber: true,
      profileName: true,
      apiKey: true,
      webhookUrl: true,
      isActive: true,
      inChatModeActive: true,
      inChatActivatedAt: true,
      inChatFailureCount: true,
      lastSyncAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  console.log(`\nTracking ${trackingId} tem ${instances.length} instância(s):\n`);

  for (const inst of instances) {
    console.log(`──────────────────────────────────────────`);
    console.log(`Nome:      ${inst.instanceName ?? "(sem nome)"}`);
    console.log(`ID local:  ${inst.id}`);
    console.log(`uazapi ID: ${inst.instanceId}`);
    console.log(`Número:    ${inst.phoneNumber ?? "(não vinculado)"}`);
    console.log(`Profile:   ${inst.profileName ?? "-"}`);
    console.log(`apiKey:    ${inst.apiKey?.slice(0, 12)}...${inst.apiKey?.slice(-6)} (len ${inst.apiKey?.length ?? 0})`);
    console.log(`webhook:   ${inst.webhookUrl ?? "-"}`);
    console.log(`isActive:  ${inst.isActive}`);
    console.log(`In-Chat:   active=${inst.inChatModeActive} failures=${inst.inChatFailureCount} ativado_em=${inst.inChatActivatedAt}`);
    console.log(`lastSync:  ${inst.lastSyncAt}`);
    console.log(`Criada:    ${inst.createdAt}`);
    console.log(`Atualizada:${inst.updatedAt}`);

    // Testa apiKey contra uazapi — env var ou inferida do código
    const baseUrl =
      process.env.NEXT_PUBLIC_UAZAPI_BASE_URL ??
      process.env.UAZAPI_BASE_URL ??
      "https://nasa.uazapi.com";
    if (inst.apiKey) {
      try {
        const res = await fetch(`${baseUrl}/instance/status`, {
          method: "GET",
          headers: { token: inst.apiKey, "Content-Type": "application/json" },
        });
        const body = await res.text();
        console.log(`uazapi status (${baseUrl}): HTTP ${res.status}`);
        console.log(`  body: ${body.slice(0, 400)}`);
      } catch (err) {
        console.log(`uazapi check: erro - ${(err as Error).message}`);
      }
    }
  }
  console.log(`──────────────────────────────────────────\n`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
