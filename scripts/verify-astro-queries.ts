import "dotenv/config";
import { ASTRO_QUERIES, runAstroQuery } from "@/features/astro/queries/registry";
import prisma from "@/lib/prisma";

/**
 * Cada consulta em código roda contra o banco real e precisa: casar a frase
 * que a motivou, devolver texto, e não estourar. Consulta que quebra num
 * campo renomeado só aparece aqui — no chat ela vira "não tenho acesso".
 */
const FRASES: Record<string, string> = {
  "tracking.leads_count": "quantos leads temos?",
  "tracking.leads_created": "quantos leads foram criados hoje?",
  "tracking.leads_list": "me manda a lista dos leads",
  "tracking.list": "quais trackings temos?",
  "tracking.leads_by_status": "quantos leads em cada etapa?",
  "tracking.leads_unassigned": "quantos leads sem responsável?",
  "tracking.tags_list": "quais tags temos?",
  "agenda.list": "quais agendas temos?",
  "agenda.appointments_today": "quais compromissos tenho essa semana?",
  "agenda.reminders_active": "quais lembretes tenho?",
  "chat.unread": "quantas mensagens não lidas?",
  "chat.messages_today": "quantas mensagens hoje?",
  "forge.proposals": "quantas propostas temos?",
  "form.list": "quais formulários temos?",
  "workspace.list": "quais workspaces temos?",
  "workspace.actions_pending": "quantas tarefas pendentes?",
  "payment.summary": "quanto tenho a receber?",
  "payment.paid_month": "quanto recebi esse mês?",
  "pages.list": "quais páginas temos?",
};

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name} — ${detail}`);
  if (!ok) failures += 1;
}

async function main() {
  const organization = await prisma.organization.findFirst({
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  if (!organization) {
    console.error("Nenhuma organização no banco.");
    process.exit(1);
  }
  const user = await prisma.member.findFirst({
    where: { organizationId: organization.id },
    select: { userId: true },
  });
  console.log(`Organização: ${organization.name}\n`);
  const ctx = {
    userId: user?.userId ?? "verify",
    organizationId: organization.id,
  } as never;

  const semFrase = ASTRO_QUERIES.filter((query) => !FRASES[query.key]);
  check(
    "toda consulta tem frase de teste",
    semFrase.length === 0,
    semFrase.length === 0
      ? `${ASTRO_QUERIES.length} consultas cobertas`
      : `sem frase: ${semFrase.map((q) => q.key).join(", ")}`,
  );

  for (const [key, frase] of Object.entries(FRASES)) {
    try {
      const hit = await runAstroQuery({ ctx, text: frase });
      check(
        key,
        hit?.key === key && typeof hit.result.text === "string" && hit.result.text.length > 0,
        hit ? `"${frase}" → ${hit.key}: ${hit.result.text.slice(0, 80)}` : `"${frase}" não casou com ninguém`,
      );
    } catch (error) {
      check(key, false, `"${frase}" estourou: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Referência ao turno anterior: "a lista deles" só resolve com histórico.
  const comHistorico = await runAstroQuery({
    ctx,
    text: "me mande a lista deles",
    history: ["Usuário: quantos leads foram criados hoje?", "Astro: 2 leads criados hoje."],
  });
  check(
    "lista deles herda o assunto",
    comHistorico?.key === "tracking.leads_list",
    comHistorico ? `→ ${comHistorico.key}: ${comHistorico.result.text.slice(0, 60)}` : "não casou",
  );

  const semHistorico = await runAstroQuery({ ctx, text: "me mande a lista deles" });
  check(
    "lista deles sem histórico não inventa",
    semHistorico === null,
    semHistorico ? `casou com ${semHistorico.key}` : "segue para o orquestrador",
  );

  // Ordem pedido→ação não pode ser sequestrada pela camada de leitura.
  for (const ordem of [
    "crie um lead chamado Ana",
    "cria um workspace chamado Operação",
    "apaga o lead duplicado do João",
    "marca uma reunião com o Kauê sexta às 15h",
  ]) {
    const hit = await runAstroQuery({ ctx, text: ordem });
    check("ordem não vira consulta", hit === null, `"${ordem}" → ${hit?.key ?? "segue para ação"}`);
  }

  console.log(`\n${failures} falha(s).`);
  await prisma.$disconnect();
  process.exit(failures > 0 ? 1 : 0);
}

main();
