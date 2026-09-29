import prisma from "../../../src/lib/prisma";
import { AstroQaSession } from "../astro-session";
import { nextBrazilWeekday } from "../brazil-time";
import { expectReplyContains, expectThat, normalizeForMatch, type QaCase, type QaCaseContext } from "./types";

// Consultas com filtro, período e comparação (docs/astro-bateria-de-testes.md, F2).
// Todas têm de sair em código, pela consulta certa, sem tokens.

function analysisCase(params: {
  id: string;
  title: string;
  message: string;
  expectedKey: string;
  expected: (context: QaCaseContext) => Promise<string[]>;
  forbidden?: (context: QaCaseContext) => Promise<string[]>;
}): QaCase {
  return {
    id: params.id,
    complexity: "N2",
    title: params.title,
    run: async (context) => {
      const [expected, forbidden] = await Promise.all([
        params.expected(context),
        params.forbidden ? params.forbidden(context) : Promise.resolve([]),
      ]);
      const reply = await context.session.send(params.message);
      expectThat(reply.layer === "consulta", `Foi para ${reply.layer}: ${reply.text.slice(0, 160)}`);
      expectThat(reply.key === params.expectedKey, `Respondeu ${reply.key}, esperava ${params.expectedKey}.`);
      expectReplyContains(reply, expected);
      const leaked = forbidden.filter((fragment) => normalizeForMatch(reply.text).includes(normalizeForMatch(fragment)));
      expectThat(leaked.length === 0, `Não devia aparecer: ${leaked.join(", ")}.`);
    },
  };
}

function formatDayMonth(date: Date): string {
  return date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
}

export const F2_CASES: QaCase[] = [
  analysisCase({
    id: "F2-01",
    title: "Leads por tag, funil e período",
    message: "Leads quentes do funil Vendas criados esta semana",
    expectedKey: "tracking.leads_filtered",
    expected: async () => ["Kauê Silva", "Ana Beatriz"],
    forbidden: async () => ["Maria Clara"],
  }),
  analysisCase({
    id: "F2-02",
    title: "\"Kaue\" com erro: não é da equipe, são leads",
    message: "Quantos leads o Kaue tem?",
    expectedKey: "tracking.leads_by_person",
    expected: async () => ["Kauê Silva", "Kauê Souza"],
  }),
  analysisCase({
    id: "F2-03",
    title: "Comparação entre semanas",
    message: "Compara os leads desta semana com a passada",
    expectedKey: "insights.leads_compare",
    expected: async () => ["Últimos 7 dias", "Semana anterior", "Variação"],
  }),
  analysisCase({
    id: "F2-04",
    title: "Quem espera resposta",
    message: "Quem está esperando resposta há mais de 5 minutos?",
    expectedKey: "chat.waiting",
    expected: async () => ["Maria Clara", "Kauê Silva", "João Pedro"],
  }),
  analysisCase({
    id: "F2-05",
    title: "Compromissos de um dia da semana, com a data escrita",
    message: "O que eu tenho na quinta na agenda?",
    expectedKey: "agenda.appointments_today",
    expected: async (context) => [formatDayMonth(nextBrazilWeekday(4, 12, 0, context.startedAt))],
  }),
  analysisCase({
    id: "F2-06",
    title: "Horários livres amanhã de manhã",
    message: "Tenho algo livre amanhã de manhã?",
    expectedKey: "agenda.free_slots",
    expected: async () => ["08:00", "09:00", "11:00"],
    forbidden: async () => ["10:00"],
  }),
  analysisCase({
    id: "F2-07",
    title: "Valor em propostas enviadas",
    message: "Quanto tenho em propostas enviadas e não fechadas?",
    expectedKey: "forge.open_value",
    expected: async () => ["2.000,00"],
  }),
  analysisCase({
    id: "F2-08",
    title: "Contas que vencem na semana, vencidas à parte",
    message: "Quais contas vencem esta semana?",
    expectedKey: "payment.due_period",
    expected: async () => ["Conta de internet", "vencido"],
    forbidden: async () => ["Aluguel"],
  }),
  analysisCase({
    id: "F2-09",
    title: "Gasto por categoria no mês",
    message: "Quanto gastei com Operacional neste mês?",
    expectedKey: "payment.spent_by_category",
    expected: async () => ["300,00"],
  }),
  analysisCase({
    id: "F2-10",
    title: "Minhas tarefas atrasadas",
    message: "Minhas tarefas atrasadas",
    expectedKey: "workspace.actions_pending",
    expected: async () => ["Pagar boleto QA"],
    forbidden: async () => ["Enviar relatório QA"],
  }),
  analysisCase({
    id: "F2-11",
    title: "Etapa que mais perde leads",
    message: "Qual etapa do funil mais perde leads?",
    expectedKey: "insights.funnel",
    expected: async () => [],
  }),
  analysisCase({
    id: "F2-13",
    title: "Leads de outra empresa não aparecem",
    message: "Me mostra os leads da Gotham",
    expectedKey: "tracking.leads_list",
    expected: async () => ["Maria Clara"],
    forbidden: async (context) => {
      const otherLeads = await prisma.lead.findMany({
        where: { tracking: { organizationId: { not: context.qaOrg.organizationId } } },
        select: { name: true },
        take: 20,
      });
      // Só nomes que não existem na org de QA provam vazamento.
      const qaNames = new Set(
        (
          await prisma.lead.findMany({
            where: { tracking: { organizationId: context.qaOrg.organizationId } },
            select: { name: true },
          })
        ).map((lead) => lead.name),
      );
      return otherLeads.map((lead) => lead.name).filter((name) => name.length >= 5 && !qaNames.has(name));
    },
  }),
  {
    id: "F2-12",
    complexity: "N2",
    title: "Vendedor sem acesso ao Financeiro é recusado",
    run: async (context) => {
      const sellerSession = await AstroQaSession.open(context.qaOrg, context.qaOrg.sellerUserId);
      const reply = await sellerSession.send("Como está o financeiro?");
      expectThat(reply.layer === "consulta" && reply.key === "permission.denied", `Foi para ${reply.layer} ${reply.key}: ${reply.text.slice(0, 200)}`);
      expectThat(!/R\$/.test(reply.text), `Vazou valor do Financeiro: ${reply.text.slice(0, 200)}`);
    },
  },
];
