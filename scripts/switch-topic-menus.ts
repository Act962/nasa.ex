// Liga ou desliga os menus de perguntas por assunto de um funil (spec 0096). Ligar troca o passo de
// abertura de cada fluxo de assunto pelo menu salvo e ativa os menus; desligar desfaz. Rodar só depois
// de revisar os menus:
//   pnpm tsx --conditions=react-server scripts/switch-topic-menus.ts <organizationId> <trackingId> ligar|desligar
import "./astro-qa/load-env";

const [organizationId, trackingId, command] = process.argv.slice(2);

async function main() {
  if (command !== "ligar" && command !== "desligar") throw new Error('Diga "ligar" ou "desligar".');
  const { switchTopicMenus } = await import("../src/features/tracking-chat-ai/lib/attendance-setup/build-topic-menus");
  const result = await switchTopicMenus({ trackingId, organizationId, shouldTurnOn: command === "ligar" });
  console.log(`${command}: ${result.changedFlows.length} fluxo(s) alterado(s)`);
  for (const flowName of result.changedFlows) console.log("  ✓", flowName);
  for (const flowName of result.skippedFlows) console.log("  pulado (sem o passo de abertura esperado):", flowName);
}

main().then(() => process.exit(0)).catch((scriptError) => { console.error(String(scriptError).slice(0, 600)); process.exit(1); });
