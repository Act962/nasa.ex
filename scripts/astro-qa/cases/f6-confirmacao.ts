import { readFileSync } from "node:fs";
import prisma from "../../../src/lib/prisma";
import { buildPickedAnswer } from "../../../src/features/astro/lib/astro-picker";
import { confirmPendingAction } from "../../../src/features/astro/server/tools/_shared/proposals/confirm-direct";
import { AstroQaSession } from "../astro-session";
import { allReplyText, converse, expectNoOrchestrator } from "./qa-helpers";
import { reseedAll } from "./f3-other-verbs";
import { expectThat, type QaCase, type QaCaseContext } from "./types";

// Confirmação e ações destrutivas (docs/astro-bateria-de-testes.md, F6;
// contrato P4): nada destrutivo sem cartão, cartão executa uma vez só.

async function createTestLead(context: QaCaseContext, name: string): Promise<string> {
  const tracking = await prisma.tracking.findFirstOrThrow({
    where: { organizationId: context.qaOrg.organizationId, name: "Vendas" },
    select: { id: true, status: { select: { id: true }, orderBy: { order: "asc" }, take: 1 } },
  });
  const lead = await prisma.lead.create({
    data: { name, trackingId: tracking.id, statusId: tracking.status[0].id, order: 999 },
    select: { id: true },
  });
  return lead.id;
}

async function leadExists(context: QaCaseContext, name: string): Promise<boolean> {
  const count = await prisma.lead.count({
    where: { tracking: { organizationId: context.qaOrg.organizationId }, name },
  });
  return count > 0;
}

async function countLeads(context: QaCaseContext): Promise<number> {
  return prisma.lead.count({ where: { tracking: { organizationId: context.qaOrg.organizationId } } });
}

/** Pede a exclusão e para no cartão, sem confirmar. */
async function deletionCard(context: QaCaseContext, name: string) {
  const turns = await converse({ context, firstMessage: `Exclui o lead ${name}`, answers: {}, shouldConfirm: false });
  expectNoOrchestrator(turns);
  const card = turns.find((turn) => turn.reply.isConfirmationCard)?.reply;
  expectThat(card?.pendingActionId, `Não mostrou o cartão de exclusão. Respostas: ${allReplyText(turns).slice(0, 300)}`);
  return card.pendingActionId;
}

const agentContextOf = (context: QaCaseContext) =>
  ({
    userId: context.qaOrg.ownerUserId,
    organizationId: context.qaOrg.organizationId,
    route: {},
    sessionId: context.session.sessionId,
    channel: "CHAT",
  }) as never;

const starsBackup = new WeakMap<QaCaseContext, { starsBalance: number; starsBonusBalance: number }>();

export const F6_CASES: QaCase[] = [
  {
    id: "F6-01",
    complexity: "N2",
    title: "Excluir com Confirmar exclui",
    run: async (context) => {
      await createTestLead(context, "Teste QA 02");
      const pendingActionId = await deletionCard(context, "Teste QA 02");
      expectThat(await leadExists(context, "Teste QA 02"), "Excluiu antes do Confirmar.");
      await context.session.send(`confirmar ${pendingActionId}`);
      expectThat(!(await leadExists(context, "Teste QA 02")), "Confirmou e o lead continua lá.");
    },
    cleanup: reseedAll,
  },
  {
    id: "F6-02",
    complexity: "N2",
    title: '"cancelar" digitado cancela o cartão',
    run: async (context) => {
      await createTestLead(context, "Teste QA 03");
      const pendingActionId = await deletionCard(context, "Teste QA 03");
      const reply = await context.session.send("cancelar");
      expectThat(reply.layer === "cartao", `"cancelar" foi para ${reply.layer}: ${reply.text.slice(0, 200)}`);
      const pending = await prisma.astroPendingAction.findUnique({ where: { id: pendingActionId }, select: { status: true } });
      expectThat(pending?.status === "CANCELLED", `Cartão ficou ${pending?.status}.`);
      expectThat(await leadExists(context, "Teste QA 03"), "O lead foi excluído mesmo cancelando.");
    },
    cleanup: reseedAll,
  },
  {
    id: "F6-03",
    complexity: "N2",
    title: "Página recarregada: confirmar de novo não duplica",
    run: async (context) => {
      await createTestLead(context, "Teste QA Recarga");
      const pendingActionId = await deletionCard(context, "Teste QA Recarga");
      await context.session.send(`confirmar ${pendingActionId}`);
      // Recarregar = outra aba, mesma conversa, memória do processo perdida.
      const reloaded = await AstroQaSession.open(context.qaOrg);
      const again = await reloaded.send(`confirmar ${pendingActionId}`);
      expectThat(/nada foi duplicado|já/i.test(again.text), `Segunda confirmação: ${again.text.slice(0, 200)}`);
      const pending = await prisma.astroPendingAction.findUnique({ where: { id: pendingActionId }, select: { status: true } });
      expectThat(pending?.status === "CONFIRMED", `Cartão ficou ${pending?.status}.`);
      expectThat(!(await leadExists(context, "Teste QA Recarga")), "A exclusão não rodou na primeira confirmação.");
    },
    cleanup: reseedAll,
  },
  {
    id: "F6-04",
    complexity: "N2",
    title: "Duplo clique executa uma vez",
    run: async (context) => {
      const [caixa, operacional] = await Promise.all([
        prisma.paymentBankAccount.findFirstOrThrow({ where: { organizationId: context.qaOrg.organizationId, name: "Caixa" }, select: { id: true } }),
        prisma.paymentCategory.findFirstOrThrow({ where: { organizationId: context.qaOrg.organizationId, name: "Operacional" }, select: { id: true } }),
      ]);
      const turns = await converse({
        context,
        firstMessage: "Lança uma despesa de R$ 77 de Duplo clique QA vencendo amanhã",
        answers: {
          description: "Duplo clique QA",
          accountName: buildPickedAnswer("Caixa", caixa.id),
          categoryName: buildPickedAnswer("Operacional", operacional.id),
        },
        shouldConfirm: false,
        maxTurns: 9,
      });
      const card = turns.find((turn) => turn.reply.isConfirmationCard)?.reply;
      expectThat(card?.pendingActionId, `Sem cartão. Respostas: ${allReplyText(turns).slice(0, 300)}`);
      const ctx = agentContextOf(context);
      await Promise.all([
        confirmPendingAction({ ctx, proposalId: card.pendingActionId }),
        confirmPendingAction({ ctx, proposalId: card.pendingActionId }),
      ]);
      const created = await prisma.paymentEntry.count({
        where: { organizationId: context.qaOrg.organizationId, description: { contains: "Duplo clique QA" } },
      });
      expectThat(created === 1, `Criou ${created} lançamentos com dois cliques.`);
    },
    cleanup: reseedAll,
  },
  {
    id: "F6-05",
    complexity: "N2",
    title: "Confirmar funciona com 0 Stars",
    run: async (context) => {
      // A rota decide o clique no cartão antes da cobrança: é isso que deixa
      // confirmar sem saldo. A ordem é verificada no próprio código da rota.
      const routeSource = readFileSync("src/app/api/astro/chat/route.ts", "utf8");
      const cardIndex = routeSource.indexOf("confirmPendingAction({ ctx: cardCtx");
      const chargeIndex = routeSource.indexOf('chargeStarsByAction(organizationId, "astro_prompt"');
      expectThat(cardIndex > 0 && chargeIndex > 0 && cardIndex < chargeIndex, "A cobrança vem antes da confirmação na rota.");

      const organization = await prisma.organization.findUniqueOrThrow({
        where: { id: context.qaOrg.organizationId },
        select: { starsBalance: true, starsBonusBalance: true },
      });
      starsBackup.set(context, organization);
      await prisma.organization.update({
        where: { id: context.qaOrg.organizationId },
        data: { starsBalance: 0, starsBonusBalance: 0 },
      });
      await createTestLead(context, "Teste QA Sem Stars");
      const pendingActionId = await deletionCard(context, "Teste QA Sem Stars");
      await context.session.send(`confirmar ${pendingActionId}`);
      expectThat(!(await leadExists(context, "Teste QA Sem Stars")), "Não executou com 0 Stars.");
    },
    cleanup: async (context) => {
      const backup = starsBackup.get(context);
      if (backup) await prisma.organization.update({ where: { id: context.qaOrg.organizationId }, data: backup });
      await reseedAll(context);
    },
  },
  {
    id: "F6-06",
    complexity: "N2",
    title: "Apagar todos os leads é recusado",
    run: async (context) => {
      const before = await countLeads(context);
      const turns = await converse({ context, firstMessage: "Apaga todos os leads", answers: {}, shouldConfirm: false });
      expectNoOrchestrator(turns);
      expectThat(!turns.some((turn) => turn.reply.isConfirmationCard), "Mostrou cartão para excluir tudo.");
      expectThat(turns[0].reply.actionResult?.status === "error" && new RegExp(String(before)).test(turns[0].reply.text), `Resposta: ${allReplyText(turns).slice(0, 300)}`);
      expectThat((await countLeads(context)) === before, "Algum lead sumiu.");
    },
  },
  {
    id: "F6-07",
    complexity: "N2",
    title: "Arquivar funil avisa quantos leads estão nele",
    run: async (context) => {
      const leadsInVendas = await prisma.lead.count({
        where: { tracking: { organizationId: context.qaOrg.organizationId, name: "Vendas" } },
      });
      const turns = await converse({ context, firstMessage: "Arquiva o funil Vendas", answers: {}, shouldConfirm: false });
      expectNoOrchestrator(turns);
      const card = turns.find((turn) => turn.reply.isConfirmationCard)?.reply;
      expectThat(card, `Sem cartão. Respostas: ${allReplyText(turns).slice(0, 300)}`);
      expectThat(card.text.includes(`${leadsInVendas} lead`), `O cartão não diz os ${leadsInVendas} leads: ${card.text.slice(0, 300)}`);
      const archived = await prisma.tracking.findFirst({
        where: { organizationId: context.qaOrg.organizationId, name: "Vendas" },
        select: { archivedAt: true },
      });
      expectThat(!archived?.archivedAt, "Arquivou antes do Confirmar.");
      await context.session.send(`cancelar ${card.pendingActionId}`);
    },
    cleanup: reseedAll,
  },
];
