/**
 * Reconfigura o webhook da uazapi pra apontar pra URL pública (em vez do
 * `localhost:3000` que veio da última conexão). Necessário em dev pra que
 * mensagens INBOUND do lead cheguem no NASA.
 *
 * Uso:
 *   pnpm tsx scripts/reconfigure-uazapi-webhook.ts <trackingId> <publicUrl>
 *
 * Exemplo:
 *   pnpm tsx scripts/reconfigure-uazapi-webhook.ts cmoy4vaua004dbixbmc9ayg7s https://abc123.trycloudflare.com
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
const envLocal = "/Users/weydsonlima/nasaex-wey/.env.local";
if (existsSync(envLocal)) config({ path: envLocal });
config();

import prisma from "../src/lib/prisma";

async function main() {
  const trackingId = process.argv[2];
  const publicUrl = process.argv[3];

  if (!trackingId || !publicUrl) {
    console.error(
      "Uso: pnpm tsx scripts/reconfigure-uazapi-webhook.ts <trackingId> <publicUrl>",
    );
    console.error("  publicUrl: ex. https://abc123.trycloudflare.com");
    process.exit(1);
  }
  if (!publicUrl.startsWith("https://") && !publicUrl.startsWith("http://")) {
    console.error("URL inválida — precisa começar com http:// ou https://");
    process.exit(1);
  }

  const instances = await prisma.whatsAppInstance.findMany({
    where: { trackingId },
    select: { id: true, apiKey: true, instanceName: true, instanceId: true },
  });

  if (instances.length === 0) {
    console.error(`Nenhuma instância encontrada pro tracking ${trackingId}`);
    process.exit(1);
  }

  const uazapiBase =
    process.env.NEXT_PUBLIC_UAZAPI_BASE_URL ?? "https://nasaex.uazapi.com";
  const webhookUrl = `${publicUrl.replace(/\/$/, "")}/api/chat/webhook?trackingId=${trackingId}`;

  console.log(`\nReconfigurando webhook em ${instances.length} instância(s):`);
  console.log(`  uazapi base: ${uazapiBase}`);
  console.log(`  webhook:     ${webhookUrl}\n`);

  for (const inst of instances) {
    console.log(`── ${inst.instanceName ?? inst.id}`);
    if (!inst.apiKey) {
      console.log(`  ⚠ sem apiKey — pulando`);
      continue;
    }
    try {
      const res = await fetch(`${uazapiBase}/webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          token: inst.apiKey,
        },
        body: JSON.stringify({
          url: webhookUrl,
          enabled: true,
          events: ["messages", "connection", "labels", "chat_labels"],
          action: "update",
          excludeMessages: ["wasSentByApi", "isGroupYes"],
        }),
      });
      const body = await res.text();
      if (res.ok) {
        console.log(`  ✓ HTTP ${res.status} — webhook atualizado`);
      } else {
        console.log(`  ✗ HTTP ${res.status} — ${body.slice(0, 200)}`);
      }
    } catch (err) {
      console.log(`  ✗ erro: ${(err as Error).message}`);
    }
  }

  console.log("\nProntinho. Agora teste enviando uma msg do celular pro número da instância.");
  console.log("Logs em tempo real: tail -f /tmp/nasa-dev.log | grep 'chat/webhook'");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
