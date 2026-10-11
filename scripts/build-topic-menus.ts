// Gera os menus de perguntas por assunto de um funil montado a partir de roteiro (spec 0096) e mostra
// cada um. Com "salvar", grava como menus salvos DESLIGADOS; nenhum fluxo é alterado. A escolha das
// perguntas faz UMA chamada paga ao modelo pequeno (com "sem-ia" não faz nenhuma). Rodar:
//   pnpm tsx --conditions=react-server scripts/build-topic-menus.ts <organizationId> <userId> <trackingId> [salvar] [sem-ia]
import "./astro-qa/load-env";

const [organizationId, userId, trackingId, ...flags] = process.argv.slice(2);

async function main() {
  const prisma = (await import("../src/lib/prisma")).default;
  const { buildTopicMenus, saveTopicMenus } = await import("../src/features/tracking-chat-ai/lib/attendance-setup/build-topic-menus");
  const startedAt = new Date();
  const { menus, skippedTopics } = await buildTopicMenus({ trackingId, organizationId, userId, shouldUseAi: !flags.includes("sem-ia") });
  for (const menu of menus) {
    console.log(`\n══ ${menu.presetName} ${menu.wasPickedByAi ? "(perguntas escolhidas pela IA)" : "(primeiras perguntas do roteiro)"}`);
    console.log(`Mensagem (${menu.bodyText.length} caracteres):\n${menu.bodyText}`);
    menu.buttons.forEach((button, buttonIndex) => console.log(`  ${buttonIndex + 1} – ${button.text}${button.answer ? `\n       ↳ ${button.answer.slice(0, 150)}${button.answer.length > 150 ? "…" : ""}` : "  (ação, sem IA)"}`));
  }
  if (skippedTopics.length > 0) console.log("\nAssuntos sem menu:", skippedTopics.join(", "));
  if (flags.includes("salvar")) console.log("\ngravado (desligado):", JSON.stringify(await saveTopicMenus(trackingId, menus)));
  const usage = await prisma.usageEvent.findMany({ where: { organizationId, createdAt: { gte: startedAt }, feature: "astro.attendance.script_read" }, select: { modelId: true, inputTokens: true, outputTokens: true, providerCostUsd: true } });
  console.log("custo de IA:", usage.map((event) => `${event.modelId} ${event.inputTokens}+${event.outputTokens} tokens · US$ ${Number(event.providerCostUsd ?? 0).toFixed(4)}`).join(" | ") || "nenhuma chamada");
}

main().then(() => process.exit(0)).catch((scriptError) => { console.error(String(scriptError).slice(0, 700)); process.exit(1); });
