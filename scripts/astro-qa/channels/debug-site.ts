import "../load-env";
import { loadQaOrg } from "../qa-org";
import { SiteVisitor, ensureQaSite } from "./site-visitor";

// Conversa manual com o ASTRO CHAT do site de QA: cada argumento é uma mensagem.
async function main() {
  const qaOrg = await loadQaOrg();
  await ensureQaSite(qaOrg);
  const { visitor, status, error } = await SiteVisitor.open();
  if (!visitor) throw new Error(`Sessão recusada: ${status} ${error}`);
  for (const message of process.argv.slice(2)) {
    const started = Date.now();
    const reply = await visitor.send(message);
    console.log(`\n> ${message}\n[${Math.round((Date.now() - started) / 1000)}s] ${reply}`);
  }
  process.exit(0);
}
main();
