import "./load-env";
import { loadQaOrg } from "./qa-org";
import { AstroQaSession } from "./astro-session";

// Conversa manual com o ASTRO na org de QA: cada argumento é uma mensagem.
async function main() {
  const qaOrg = await loadQaOrg();
  const session = await AstroQaSession.open(qaOrg, process.env.QA_PERSONA === "vendedor" ? qaOrg.sellerUserId : qaOrg.ownerUserId);
  for (const message of process.argv.slice(2)) {
    const reply = await session.send(message);
    console.log(`\n> ${message}\n[${reply.layer} ${reply.key ?? ""}] ${reply.text}\n  card=${reply.pendingActionId ?? "-"} result=${JSON.stringify(reply.actionResult ?? null).slice(0, 300)}`);
  }
  process.exit(0);
}
main();
