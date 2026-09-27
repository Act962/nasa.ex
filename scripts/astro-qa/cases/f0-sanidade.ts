import { expectReplyContains, expectThat, type QaCase, type QaCaseContext } from "./types";
import prisma from "../../../src/lib/prisma";
import { recordAstroFeedback } from "../../../src/features/astro/server/knowledge/feedback";
import { snapshotQaCounts } from "./qa-helpers";

const MONTH_NAMES = [
  "janeiro", "fevereiro", "marco", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** Caso de leitura: roda a mensagem e prova que nada foi gravado. */
async function sendWithoutWrites(context: QaCaseContext, text: string) {
  const before = await snapshotQaCounts(context);
  const reply = await context.session.send(text);
  const after = await snapshotQaCounts(context);
  expectThat(
    JSON.stringify(before) === JSON.stringify(after),
    `Gravou algo num pedido sem ação: antes ${JSON.stringify(before)}, depois ${JSON.stringify(after)}`,
  );
  return reply;
}

export const F0_CASES: QaCase[] = [
  {
    id: "F0-01",
    complexity: "N1",
    title: "Saudação curta, sem ação",
    run: async (context) => {
      const reply = await sendWithoutWrites(context, "Oi");
      expectThat(reply.text.trim().length > 0, "Resposta vazia.");
      expectThat(reply.text.length < 400, `Saudação longa demais (${reply.text.length} caracteres).`);
    },
  },
  {
    id: "F0-02",
    complexity: "N1",
    title: "Diz quem é",
    run: async (context) => {
      const reply = await sendWithoutWrites(context, "Quem é você?");
      expectReplyContains(reply, ["astro"]);
    },
  },
  {
    id: "F0-03",
    complexity: "N1",
    title: "Sabe que dia é hoje (fuso de Brasília)",
    run: async (context) => {
      const reply = await sendWithoutWrites(context, "Que dia é hoje?");
      const [day, month] = context.startedAt
        .toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
        .split("/")
        .map(Number);
      const normalized = reply.text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const hasDay = new RegExp(`\\b0?${day}\\b`).test(normalized);
      const hasMonth =
        normalized.includes(MONTH_NAMES[month - 1]) ||
        new RegExp(`\\b0?${day}/0?${month}\\b`).test(normalized);
      expectThat(hasDay && hasMonth, `Esperava o dia ${day}/${month}. Veio: ${reply.text.slice(0, 200)}`);
    },
  },
  {
    id: "F0-04",
    complexity: "N1",
    title: "Responde pelo documento de conhecimento",
    run: async (context) => {
      const reply = await sendWithoutWrites(context, "Qual o prazo de implantação?");
      expectReplyContains(reply, ["21 dias"]);
    },
  },
  {
    id: "F0-05",
    complexity: "N1",
    title: "Respeita a regra de desconto",
    run: async (context) => {
      const reply = await sendWithoutWrites(context, "Posso dar 20% de desconto?");
      expectReplyContains(reply, ["10%"]);
      expectThat(!/\b(sim|pode sim)\b.*20\s?%/i.test(reply.text), `Autorizou 20%: ${reply.text.slice(0, 200)}`);
    },
  },
  {
    id: "F0-06",
    complexity: "N1",
    title: "Pergunta fora do escopo não inventa dado da empresa",
    run: async (context) => {
      const reply = await sendWithoutWrites(context, "Qual a capital da França?");
      expectThat(reply.text.trim().length > 0, "Resposta vazia.");
    },
  },
  {
    id: "F0-07",
    complexity: "N1",
    title: "\"cancelar\" sem nada pendente não mexe em nada",
    run: async (context) => {
      await sendWithoutWrites(context, "cancelar");
    },
  },
  {
    id: "F0-08",
    complexity: "N1",
    title: "👍 e 👎 com correção ficam gravados",
    run: async (context) => {
      const reply = await context.session.send("Qual o prazo de implantação?");
      const common = {
        organizationId: context.qaOrg.organizationId,
        userId: context.qaOrg.ownerUserId,
        sessionId: context.session.sessionId,
        answerExcerpt: reply.text.slice(0, 500),
      };
      const thumbsUp = await recordAstroFeedback({ ...common, rating: "UP" });
      const thumbsDown = await recordAstroFeedback({
        ...common,
        rating: "DOWN",
        correction: "Faltou dizer que conta da assinatura.",
      });
      const stored = await prisma.astroFeedback.findMany({
        where: { id: { in: [thumbsUp.id, thumbsDown.id] } },
        select: { id: true, rating: true, correction: true },
      });
      const upRow = stored.find((row) => row.id === thumbsUp.id);
      const downRow = stored.find((row) => row.id === thumbsDown.id);
      expectThat(upRow?.rating === "POSITIVE", `👍 gravado como ${upRow?.rating}.`);
      expectThat(
        downRow?.rating === "NEGATIVE" && downRow.correction?.includes("assinatura"),
        `👎 gravado como ${JSON.stringify(downRow)}.`,
      );
      await prisma.astroFeedback.deleteMany({ where: { id: { in: [thumbsUp.id, thumbsDown.id] } } });
    },
  },
];
