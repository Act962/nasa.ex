// Cifra as chaves de IA (OpenAI, Anthropic, Gemini) já salvas em texto puro nos Satélites (spec 0053, RNF-1).
// Idempotente: chave já cifrada é pulada. Sem --apply, só lista o que mudaria.
//
//   pnpm tsx --conditions=react-server scripts/encrypt-platform-integration-keys.ts          # simulação
//   pnpm tsx --conditions=react-server scripts/encrypt-platform-integration-keys.ts --apply  # grava

import { config as loadEnv } from "dotenv";

// Mesma ordem do Next: .env.local vence .env (é lá que mora o AI_SECRETS_KEY).
loadEnv({ path: ".env.local" });
loadEnv();

async function main() {
  const shouldApply = process.argv.includes("--apply");
  const { default: prisma } = await import("../src/lib/prisma");
  const { AI_KEY_PLATFORMS, sealIntegrationConfig } = await import(
    "../src/features/integrations/lib/integration-api-key"
  );

  const integrations = await prisma.platformIntegration.findMany({
    where: { platform: { in: [...AI_KEY_PLATFORMS] } },
    select: { id: true, platform: true, organizationId: true, config: true },
  });

  let plainKeyCount = 0;
  for (const integration of integrations) {
    const config = (integration.config ?? {}) as Record<string, string>;
    const storedKey = config.apiKey ?? "";
    const isAlreadyEncrypted = /^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/.test(storedKey);
    if (!storedKey || isAlreadyEncrypted) continue;

    plainKeyCount++;
    console.log(`${shouldApply ? "cifrando" : "cifraria"} ${integration.platform} da org ${integration.organizationId}`);
    if (!shouldApply) continue;

    await prisma.platformIntegration.update({
      where: { id: integration.id },
      data: { config: sealIntegrationConfig(integration.platform, config, config) },
    });
  }

  console.log(`${plainKeyCount} chave(s) em texto puro${shouldApply ? " cifrada(s)" : " encontrada(s) — rode com --apply para gravar"}.`);
  await prisma.$disconnect();
}

main().catch((scriptError) => {
  console.error(scriptError);
  process.exit(1);
});
