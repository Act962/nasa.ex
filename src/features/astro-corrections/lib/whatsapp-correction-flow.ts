import "server-only";
import prisma from "@/lib/prisma";
import { clearGuidedSlot } from "@/features/astro/actions/guided-slots";
import { parseCorrectionMessage, type CorrectionTurn } from "./parse-correction";

/**
 * "Errou" pelo WhatsApp (spec 0073): registra a resposta apontada, pergunta o
 * que era o certo e guarda tudo para a equipe. Não corrige nada sozinho — o
 * que muda o comportamento do ASTRO é o ajuste feito a partir do painel.
 */

const ASK_WINDOW_MINUTES = 10;
const TRANSCRIPT_WINDOW_MINUTES = 30;
const TRANSCRIPT_MAX_TURNS = 6;
const QUOTE_MAX_CHARS = 160;
/** Turnos que são resposta de verdade — limite, descanso e o próprio "errou" ficam de fora. */
const ANSWERED_STATUSES = ["ok", "empty_reply", "error_orchestrator"];

interface CorrectionBinding {
  id: string;
  userId: string;
  organizationId: string;
}

function quote(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > QUOTE_MAX_CHARS ? `${flat.slice(0, QUOTE_MAX_CHARS)}…` : flat;
}

async function findCorrectionAwaitingExpected(binding: CorrectionBinding) {
  return prisma.astroCorrection.findFirst({
    where: {
      userId: binding.userId,
      organizationId: binding.organizationId,
      channel: "WHATSAPP",
      status: "OPEN",
      expected: null,
      createdAt: { gte: new Date(Date.now() - ASK_WINDOW_MINUTES * 60_000) },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
}

async function loadRecentTurns(bindingId: string) {
  const commands = await prisma.whatsappBotCommand.findMany({
    where: {
      bindingId,
      status: { in: ANSWERED_STATUSES },
      receivedAt: { gte: new Date(Date.now() - TRANSCRIPT_WINDOW_MINUTES * 60_000) },
    },
    orderBy: { receivedAt: "desc" },
    take: TRANSCRIPT_MAX_TURNS,
    select: { messageText: true, responseSummary: true, toolsCalled: true, receivedAt: true },
  });
  return commands.reverse();
}

/** Resposta ao usuário, ou `null` quando a mensagem não é sobre correção. */
export async function tryWhatsappCorrection(params: {
  binding: CorrectionBinding;
  text: string;
}): Promise<string | null> {
  const { binding } = params;
  const message = parseCorrectionMessage(params.text);

  try {
    const awaiting = await findCorrectionAwaitingExpected(binding);

    if (message.kind !== "report") {
      if (!awaiting) return null;
      if (message.kind === "skip") {
        await prisma.astroCorrection.update({ where: { id: awaiting.id }, data: { expected: "" } });
        return "Tudo bem. O erro ficou registrado para a equipe revisar.";
      }
      // Acabamos de perguntar "o que era o certo?": a próxima mensagem é a
      // resposta, mesmo começando com verbo ("criar com o título inteiro").
      const expected = params.text.trim();
      await prisma.astroCorrection.update({ where: { id: awaiting.id }, data: { expected } });
      return `Registrado: “${quote(expected)}”.\nObrigado — a equipe vai usar isso para me corrigir. Se era um pedido novo, é só mandar de novo.`;
    }

    if (awaiting && !message.expected) {
      return "Já anotei esse erro. O que era o certo? Responda numa mensagem, ou *pular*.";
    }
    if (awaiting && message.expected) {
      await prisma.astroCorrection.update({ where: { id: awaiting.id }, data: { expected: message.expected } });
      return "Registrado, obrigado. A equipe vai usar isso para me corrigir.";
    }

    const turns = await loadRecentTurns(binding.id);
    const lastTurn = turns.at(-1);
    if (!lastTurn && !message.expected) {
      return "Não achei uma resposta minha recente para marcar. Conte numa mensagem só, começando com *errou:* — o que você pediu e o que eu fiz de errado.";
    }

    const transcript: CorrectionTurn[] = turns.map((turn) => ({
      user: turn.messageText,
      astro: turn.responseSummary ?? "",
      at: turn.receivedAt.toISOString(),
    }));
    await prisma.astroCorrection.create({
      data: {
        organizationId: binding.organizationId,
        userId: binding.userId,
        channel: "WHATSAPP",
        userMessage: lastTurn?.messageText ?? "",
        astroReply: lastTurn?.responseSummary ?? "",
        route: lastTurn?.toolsCalled[0] ?? null,
        toolsCalled: lastTurn?.toolsCalled ?? [],
        transcript: transcript as unknown as object,
        expected: message.expected,
      },
    });
    // A pergunta que estava no ar pertencia à resposta errada.
    clearGuidedSlot(`whatsapp:${binding.id}`);

    if (message.expected) {
      return "Registrado, obrigado. Anotei o erro e o que era o certo para a equipe me corrigir.";
    }
    return (
      `Anotei que errei nesta resposta:\n“${quote(lastTurn?.responseSummary ?? "")}”\n\n` +
      "O que era o certo? Responda numa mensagem, ou *pular*."
    );
  } catch (error) {
    // Registrar erro não pode derrubar o bot (ex.: tabela ainda não migrada).
    console.warn("[astro-corrections] fluxo do 'errou' falhou", error);
    return null;
  }
}
