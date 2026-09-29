import prisma from "../../../src/lib/prisma";
import { HttpAstroSession } from "../channels/http-astro";
import { SiteVisitor, ensureQaSite, removeSiteVisitorsSince } from "../channels/site-visitor";
import { removeCreatedSince } from "./qa-helpers";
import { expectThat, type QaCase, type QaCaseContext } from "./types";

// Custo e Stars (docs/astro-bateria-de-testes.md, F10). Passa pela rota HTTP
// real, onde a cobrança acontece, autenticado como o Vendedor QA.

const TEST_BALANCE = 1000;
const METERING_WAIT_MS = 30_000;

type StarsState = { starsBalance: number; starsBonusBalance: number };
const starsBackup = new WeakMap<QaCaseContext, StarsState>();

async function fundQaOrg(context: QaCaseContext, state: StarsState = { starsBalance: TEST_BALANCE, starsBonusBalance: 0 }) {
  const organizationId = context.qaOrg.organizationId;
  if (!starsBackup.has(context)) {
    starsBackup.set(
      context,
      await prisma.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { starsBalance: true, starsBonusBalance: true },
      }),
    );
  }
  await prisma.organization.update({ where: { id: organizationId }, data: state });
}

async function restoreStars(context: QaCaseContext): Promise<void> {
  const original = starsBackup.get(context);
  if (original) await prisma.organization.update({ where: { id: context.qaOrg.organizationId }, data: original });
  await prisma.reminder.deleteMany({ where: { createdByUserId: context.qaOrg.sellerUserId, createdAt: { gte: context.startedAt } } });
}

function starTransactionsSince(context: QaCaseContext, since: Date) {
  return prisma.starTransaction.findMany({
    where: { organizationId: context.qaOrg.organizationId, createdAt: { gte: since } },
    select: { action: true, appSlug: true, amount: true },
  });
}

async function waitFor<T>(read: () => Promise<T>, isDone: (value: T) => boolean): Promise<T> {
  const deadline = Date.now() + METERING_WAIT_MS;
  let value = await read();
  while (!isDone(value) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    value = await read();
  }
  return value;
}

async function withHttpSession(context: QaCaseContext, work: (session: HttpAstroSession) => Promise<void>) {
  const session = await HttpAstroSession.open(context.qaOrg);
  try {
    await work(session);
  } finally {
    await session.close();
  }
}

export const F10_CASES: QaCase[] = [
  {
    id: "F10-01",
    complexity: "N1",
    title: "Consulta em código custa zero e aparece no relatório",
    run: async (context) => {
      await fundQaOrg(context);
      const runStartedAt = new Date();
      await withHttpSession(context, async (session) => {
        const reply = await session.send("Quantos leads temos?");
        expectThat(reply.status === 200 && /\d+ leads?/.test(reply.text), `Resposta: HTTP ${reply.status} "${reply.text || reply.error}"`);
        const events = await waitFor(
          () => prisma.usageEvent.findMany({ where: { sessionId: session.aiSessionId }, select: { action: true, totalTokens: true, starsCharged: true } }),
          (found) => found.length > 0,
        );
        const queryEvents = events.filter((event) => event.action === "astro_query");
        expectThat(queryEvents.length === 1, `Consulta não registrada no relatório (${events.map((event) => event.action).join(", ") || "nenhum evento"}).`);
        expectThat(events.every((event) => (event.totalTokens ?? 0) === 0), "A consulta em código gastou tokens.");
      });
      const charged = (await starTransactionsSince(context, runStartedAt)).filter((transaction) => transaction.amount < 0);
      expectThat(charged.length === 0, `Consulta debitou Stars: ${charged.map((transaction) => `${transaction.action}:${transaction.amount}`).join(", ")}.`);
    },
    cleanup: restoreStars,
  },
  {
    id: "F10-02",
    complexity: "N2",
    title: "Pedido pelo orquestrador debita tokens uma vez",
    run: async (context) => {
      await fundQaOrg(context);
      const runStartedAt = new Date();
      await withHttpSession(context, async (session) => {
        const reply = await session.send("Escreve um texto curto de follow-up para um cliente que parou de responder");
        expectThat(reply.status === 200 && reply.text.trim().length > 0, `Orquestrador não respondeu: HTTP ${reply.status} "${reply.text || reply.error}"`);
        const tokenCharges = await waitFor(
          async () => (await starTransactionsSince(context, runStartedAt)).filter((transaction) => transaction.action === "astro_tokens"),
          (found) => found.length > 0,
        );
        expectThat(tokenCharges.length === 1, `${tokenCharges.length} débitos de tokens (esperado 1).`);
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const all = await starTransactionsSince(context, runStartedAt);
        const stakes = all.filter((transaction) => transaction.action === "astro_prompt");
        const tokens = all.filter((transaction) => transaction.action === "astro_tokens");
        expectThat(stakes.length <= 1 && tokens.length === 1, `Débitos duplicados: ${all.map((transaction) => transaction.action).join(", ")}.`);
        const balance = await prisma.organization.findUniqueOrThrow({ where: { id: context.qaOrg.organizationId }, select: { starsBalance: true } });
        const debited = -all.reduce((sum, transaction) => sum + Math.min(0, transaction.amount), 0);
        expectThat(balance.starsBalance === TEST_BALANCE - debited, `Saldo ${balance.starsBalance} não bate com ${debited}★ debitados.`);
      });
    },
    cleanup: restoreStars,
  },
  {
    id: "F10-03",
    complexity: "N2",
    title: "Sem Stars: pedido novo recebe 402; o cartão aberto ainda confirma",
    run: async (context) => {
      await fundQaOrg(context);
      await withHttpSession(context, async (session) => {
        // Plano de dois lembretes: abre cartão sem pedir permissão que o Vendedor não tem.
        await session.send("Me lembra amanhã às 9h de ligar para a Maria Clara e me lembra sexta às 10h de revisar a proposta");
        await session.send("uma vez");
        const card = await session.send("uma vez");
        expectThat(card.pendingActionId, `Não abriu o cartão do plano: "${card.text}"`);

        await fundQaOrg(context, { starsBalance: 0, starsBonusBalance: 0 });
        const blocked = await session.send("Quantos leads temos?");
        expectThat(blocked.status === 402, `Sem Stars e respondeu: HTTP ${blocked.status} "${blocked.text}"`);
        expectThat(/recarreg/i.test(blocked.error ?? ""), `402 sem a mensagem de recarga: "${blocked.error}"`);

        const confirmed = await session.send(`confirmar ${card.pendingActionId}`);
        expectThat(confirmed.status === 200, `Confirmar o cartão falhou sem Stars: HTTP ${confirmed.status} ${confirmed.error ?? ""}`);
        const reminders = await prisma.reminder.count({
          where: { createdByUserId: context.qaOrg.sellerUserId, createdAt: { gte: context.startedAt } },
        });
        expectThat(reminders === 2, `Lembretes criados: ${reminders} (esperado 2). Resposta: "${confirmed.text}"`);
      });
    },
    cleanup: restoreStars,
  },
  {
    id: "F10-04",
    complexity: "N2",
    title: "Mensagem no ASTRO CHAT não gera débito além da resposta de IA",
    run: async (context) => {
      await fundQaOrg(context);
      await ensureQaSite(context.qaOrg);
      const runStartedAt = new Date();
      const { visitor, status } = await SiteVisitor.open();
      expectThat(visitor, `Sessão do visitante recusada: HTTP ${status}`);
      const reply = await visitor.send("Qual o prazo de implantação?");
      expectThat(reply.length > 0, "O ASTRO CHAT não respondeu.");
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const charges = (await starTransactionsSince(context, runStartedAt)).filter((transaction) => transaction.amount < 0);
      const aiReplyCharges = charges.filter((transaction) => transaction.action === "astro_chat_ai_message");
      expectThat(charges.length === aiReplyCharges.length, `Débito fora da resposta de IA: ${charges.map((transaction) => transaction.action ?? transaction.appSlug).join(", ")}.`);
      expectThat(aiReplyCharges.length <= 1, `${aiReplyCharges.length} débitos para uma resposta.`);
    },
    cleanup: async (context) => {
      await removeSiteVisitorsSince(context.startedAt);
      await removeCreatedSince(context);
      await restoreStars(context);
    },
  },
];
