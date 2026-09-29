import prisma from "../../../src/lib/prisma";
import { startOfBrazilDay } from "../brazil-time";
import { expectReplyContains, expectThat, type QaCase } from "./types";

function readCase(params: {
  id: string;
  title: string;
  message: string;
  expected: (organizationId: string) => Promise<(string | number)[]>;
  /** Exige a camada de consulta em código (custo zero de tokens, CA-11 da 0033). */
  mustBeInCode?: boolean;
  /** Consulta que tem de responder — prova que foi a certa, não uma vizinha. */
  expectedKey?: string;
}): QaCase {
  return {
    id: params.id,
    complexity: "N1",
    title: params.title,
    run: async (context) => {
      const expectedFragments = await params.expected(context.qaOrg.organizationId);
      const reply = await context.session.send(params.message);
      if (params.mustBeInCode || params.expectedKey) {
        expectThat(
          reply.layer === "consulta",
          `Esperava consulta em código; foi para ${reply.layer}: ${reply.text.slice(0, 160)}`,
        );
      }
      if (params.expectedKey) {
        expectThat(reply.key === params.expectedKey, `Respondeu ${reply.key}, esperava ${params.expectedKey}.`);
      }
      expectReplyContains(reply, expectedFragments);
    },
  };
}

export const F1_CASES: QaCase[] = [
  readCase({
    id: "F1-TRK-01",
    title: "Total de leads",
    message: "Quantos leads eu tenho?",
    mustBeInCode: true,
    expected: async (organizationId) => [
      await prisma.lead.count({ where: { tracking: { organizationId } } }),
    ],
  }),
  readCase({
    id: "F1-TRK-02",
    title: "Leads que entraram hoje",
    message: "Quantos leads entraram hoje?",
    expected: async (organizationId) => [
      await prisma.lead.count({
        where: { tracking: { organizationId }, createdAt: { gte: startOfBrazilDay() } },
      }),
    ],
  }),
  readCase({
    id: "F1-TRK-03",
    title: "Lista de funis",
    message: "Quais funis eu tenho?",
    expected: async () => ["Vendas", "Suporte"],
  }),
  readCase({
    id: "F1-TRK-04",
    title: "Leads por etapa do funil Vendas",
    message: "Quantos leads tem em cada etapa do funil Vendas?",
    expected: async () => ["Novo", "Qualificado", "Proposta", "Ganho", "Perdido"],
  }),
  readCase({
    id: "F1-TRK-05",
    title: "Leads sem responsável",
    message: "Quais leads estão sem responsável?",
    expected: async () => ["João Pedro"],
  }),
  readCase({
    id: "F1-TRK-06",
    title: "Tags da org",
    message: "Quais tags existem?",
    expected: async () => ["Quente", "Frio", "Indicação"],
  }),
  readCase({
    id: "F1-TRK-07",
    title: "Leads do funil Vendas",
    message: "Me mostra os leads do funil Vendas",
    expected: async () => ["Kauê Silva", "Maria Clara"],
  }),
  readCase({
    id: "F1-AGE-01",
    title: "Compromissos de hoje",
    message: "O que eu tenho hoje na agenda?",
    expected: async () => ["Reunião QA de hoje"],
  }),
  readCase({
    id: "F1-AGE-02",
    title: "Lista de agendas",
    message: "Quais agendas eu tenho?",
    expected: async () => ["Agenda Comercial", "Agenda Suporte"],
  }),
  readCase({
    id: "F1-AGE-03",
    title: "Lembretes ativos",
    message: "Quais lembretes estão ativos?",
    expected: async () => ["Revisar o funil QA"],
  }),
  readCase({
    id: "F1-CHT-01",
    title: "Conversas sem resposta",
    message: "Quantas conversas estão sem resposta?",
    expectedKey: "chat.unread",
    expected: async () => [],
  }),
  readCase({
    id: "F1-CHT-02",
    title: "Mensagens de hoje",
    message: "Quantas mensagens chegaram hoje?",
    expectedKey: "chat.messages_today",
    expected: async (organizationId) => [
      await prisma.message.count({
        where: {
          fromMe: false,
          createdAt: { gte: startOfBrazilDay() },
          conversation: { tracking: { organizationId } },
        },
      }),
    ],
  }),
  readCase({
    id: "F1-FRG-01",
    title: "Propostas abertas",
    message: "Quais propostas estão abertas?",
    expectedKey: "forge.proposals",
    expected: async () => ["Maria Clara"],
  }),
  readCase({
    id: "F1-FRG-02",
    title: "Propostas de um cliente",
    message: "Propostas da Maria Clara",
    expectedKey: "forge.proposals_by_client",
    expected: async () => ["Maria Clara"],
  }),
  readCase({
    id: "F1-FRG-03",
    title: "Detalhe da última proposta do cliente",
    message: "Detalhe da última proposta da Maria Clara",
    expectedKey: "forge.proposal_detail",
    expected: async () => ["Setup"],
  }),
  readCase({
    id: "F1-FIN-01",
    title: "Resumo do financeiro",
    message: "Como está o financeiro do mês?",
    expectedKey: "payment.summary",
    expected: async () => [],
  }),
  readCase({
    id: "F1-FIN-02",
    title: "Quanto foi pago no mês",
    message: "Quanto foi pago este mês?",
    expectedKey: "payment.paid_month",
    expected: async () => [],
  }),
  readCase({
    id: "F1-FIN-03",
    title: "Contas bancárias",
    message: "Quais contas bancárias eu tenho?",
    expectedKey: "payment.accounts_list",
    expected: async () => ["Caixa", "Banco"],
  }),
  readCase({
    id: "F1-FRM-01",
    title: "Formulários",
    message: "Quais formulários eu tenho?",
    expectedKey: "form.list",
    expected: async () => ["Contato do site", "Pesquisa NPS"],
  }),
  readCase({
    id: "F1-WKS-01",
    title: "Tarefas pendentes",
    message: "Quais tarefas estão pendentes?",
    expectedKey: "workspace.actions_pending",
    expected: async () => ["Enviar relatório QA"],
  }),
  readCase({
    id: "F1-WKS-02",
    title: "Workspaces",
    message: "Quais workspaces eu tenho?",
    expectedKey: "workspace.list",
    expected: async () => ["Operação", "Marketing"],
  }),
  readCase({
    id: "F1-INS-01",
    title: "Vendas do mês",
    message: "Quanto vendi este mês?",
    expectedKey: "insights.sold_month",
    expected: async () => [],
  }),
  readCase({
    id: "F1-INS-02",
    title: "Ganhos e perdas",
    message: "Qual a taxa de ganhos e perdas?",
    expectedKey: "insights.won_lost",
    expected: async () => [],
  }),
  readCase({
    id: "F1-INS-03",
    title: "Leads por canal",
    message: "Leads por canal",
    expectedKey: "insights.channels",
    expected: async () => [],
  }),
  readCase({
    id: "F1-INS-04",
    title: "Leads por tag",
    message: "Leads por tag",
    expectedKey: "insights.leads_by_tag",
    expected: async () => ["Quente"],
  }),
  readCase({
    id: "F1-INS-05",
    title: "Desempenho dos atendentes",
    message: "Desempenho dos atendentes",
    expectedKey: "insights.attendants",
    expected: async () => [],
  }),
  readCase({
    id: "F1-PGS-01",
    title: "Páginas",
    message: "Quais páginas eu tenho?",
    expectedKey: "pages.list",
    expected: async () => [],
  }),
  readCase({
    id: "F1-STR-01",
    title: "Saldo de Stars",
    message: "Quanto de Stars eu tenho?",
    expectedKey: "stars.balance",
    expected: async (organizationId) => {
      const organization = await prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { starsBalance: true },
      });
      return [organization.starsBalance];
    },
  }),
  readCase({
    id: "F1-OUT-01",
    title: "App sem leitura pelo ASTRO responde com o link, sem inventar",
    message: "Quantos comentários o Instagram recebeu hoje?",
    expectedKey: "apps.not_readable",
    expected: async () => ["/comments"],
  }),
];
