// Confere o agrupamento por uso, o início dos períodos, a estimativa na chave própria e o estado do
// selo (spec 0093, RF-10 e RF-11). Puro: não lê banco nem chama IA.
import { AI_RESOURCES } from "../src/features/ia/lib/ai-resources";
import { aiBadgeStateOf } from "../src/features/ia/lib/ai-badge-state";
import { AI_USE_GROUPS, estimateOwnKeyCostBrl, periodStart, aiUseGroupOf } from "../src/features/ia/lib/ai-use-groups";

let failureCount = 0;
function check(name: string, isOk: boolean, detail = "") {
  if (!isOk) failureCount += 1;
  console.log(`${isOk ? "ok  " : "FALHA"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const groupIds = new Set(AI_USE_GROUPS.map((group) => group.id));
check("todo recurso cai num dos quatro usos", AI_RESOURCES.every((resource) => groupIds.has(aiUseGroupOf(resource.id))));
check("atendimento agrupa texto, áudio e transcrição", ["attendance.chat", "attendance.speech", "attendance.transcription"].every((id) => aiUseGroupOf(id) === "attendance"));
check("ligações e Astro têm grupo próprio", aiUseGroupOf("calls.voice") === "calls" && aiUseGroupOf("astro.chat") === "astro" && aiUseGroupOf("workflows.ai-steps") === "other");

// 11/10/2026 01:30 em Brasília = 04:30 UTC.
const now = new Date("2026-10-11T04:30:00Z");
check("hoje começa à meia-noite de Brasília", periodStart("today", now).toISOString() === "2026-10-11T03:00:00.000Z", periodStart("today", now).toISOString());
check("este mês começa no dia 1 de Brasília", periodStart("month", now).toISOString() === "2026-10-01T03:00:00.000Z", periodStart("month", now).toISOString());
// 01/10 01:00 UTC ainda é 30/09 em Brasília: o mês é setembro.
check("virada de mês respeita Brasília", periodStart("month", new Date("2026-10-01T01:00:00Z")).toISOString() === "2026-09-01T03:00:00.000Z");
check("7 dias conta a partir de agora", periodStart("7d", now).toISOString() === "2026-10-04T04:30:00.000Z");

const ownKeyCost = estimateOwnKeyCostBrl("gpt-4o-mini", 1_000_000, 0);
check("chave própria: custo sai dos tokens", ownKeyCost !== null && ownKeyCost > 0, String(ownKeyCost));
check("modelo sem preço não vira custo zero", estimateOwnKeyCostBrl("modelo-que-nao-existe", 1000, 1000) === null);
check("sem tokens não há custo estimado", estimateOwnKeyCostBrl("gpt-4o-mini", 0, 0) === null);

check("selo verde: chave da empresa, do funil ou do Planner", (["company", "funnel", "planner"] as const).every((source) => aiBadgeStateOf(source) === "own"));
check("selo amarelo: plataforma ou serviço gratuito", aiBadgeStateOf("platform") === "platform" && aiBadgeStateOf("free") === "platform");
check("selo cinza: sem chave", aiBadgeStateOf("none") === "off");

console.log(failureCount === 0 ? "\nTudo certo." : `\n${failureCount} falha(s).`);
process.exit(failureCount === 0 ? 0 : 1);
