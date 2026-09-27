import "server-only";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";
import type { AstroConfirmationResultPayload } from "@/features/astro/lib/astro-confirmation";
import { getProposalExecutor } from "./types";

/**
 * Executar e cancelar proposta pendente em código (spec 0032, RF-10 e D-4).
 *
 * O clique no cartão manda "confirmar <id>", que é inequívoco. Mandar isso ao
 * orquestrador custava ~45 mil tokens (~46 Stars) por clique e ainda podia
 * errar: numa medição, o classificador releu a conversa e voltou a perguntar o
 * nome do cliente em vez de gravar.
 *
 * As tools `confirm_action`/`cancel_action` continuam existindo para o "sim"
 * em texto livre, e chamam estas mesmas funções — a regra mora num lugar só.
 */

export type ConfirmOutcome =
  | { ok: true; payload: AstroConfirmationResultPayload }
  | { ok: false; error: string };

async function findLatestPending(ctx: AgentContext) {
  return prisma.astroPendingAction.findFirst({
    where: {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      channel: ctx.channel ?? "CHAT",
      status: "PENDING",
      confirmedAt: null,
      expiresAt: { gt: new Date() },
      ...(ctx.sessionId ? { sessionId: ctx.sessionId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

const BARE_CONFIRM = new Set(["confirmar", "confirmo", "confirma", "confirmado", "sim", "pode", "pode confirmar", "pode sim", "ok", "isso"]);
const BARE_CANCEL = new Set(["cancelar", "cancela", "cancele", "nao", "não", "nao quero", "esquece", "deixa pra la"]);

/**
 * "cancelar" ou "sim" digitados com um cartão aberto decidem o cartão, em
 * código. Sem isto, "cancelar" virava pedido novo — e casava com o verbo de
 * cancelar compromisso (F6-02).
 */
export async function decideLatestCardByText(params: {
  ctx: AgentContext;
  text: string;
}): Promise<ConfirmOutcome | { ok: true; cancelledSummary: string } | null> {
  const normalized = params.text.trim().toLowerCase().replace(/[.!]+$/, "");
  const decision = BARE_CONFIRM.has(normalized) ? "confirm" : BARE_CANCEL.has(normalized) ? "cancel" : null;
  if (!decision) return null;
  const pending = await findLatestPending(params.ctx);
  if (!pending) return null;
  if (decision === "confirm") return confirmPendingAction({ ctx: params.ctx, proposalId: pending.id });
  const outcome = await cancelPendingAction({ ctx: params.ctx, proposalId: pending.id });
  return "error" in outcome ? { ok: false, error: outcome.error } : { ok: true, cancelledSummary: outcome.summary };
}

async function loadPending(ctx: AgentContext, proposalId?: string) {
  return proposalId
    ? prisma.astroPendingAction.findUnique({ where: { id: proposalId } })
    : findLatestPending(ctx);
}

export async function confirmPendingAction(params: {
  ctx: AgentContext;
  proposalId?: string;
}): Promise<ConfirmOutcome> {
  const { ctx } = params;
  const pending = await loadPending(ctx, params.proposalId);

  if (!pending) {
    return { ok: false, error: "Não achei nenhuma proposta pendente pra confirmar. Refaça o pedido." };
  }
  if (pending.organizationId !== ctx.organizationId || pending.userId !== ctx.userId) {
    return { ok: false, error: "Essa proposta não é sua ou é de outra organização." };
  }
  if (pending.status === "CONFIRMED") {
    return {
      ok: true,
      payload: {
        kind: "astro_confirmation_result",
        proposalId: pending.id,
        actionType: pending.actionType,
        ok: true,
        title: "Já executada",
        summary: "Essa proposta já tinha sido confirmada e executada — nada foi duplicado.",
      },
    };
  }
  if (pending.status !== "PENDING") {
    return {
      ok: false,
      error: `Essa proposta está ${pending.status.toLowerCase()} e não pode ser executada. Refaça o pedido.`,
    };
  }
  if (pending.expiresAt.getTime() < Date.now()) {
    await prisma.astroPendingAction.update({
      where: { id: pending.id },
      data: { status: "EXPIRED" },
    });
    return { ok: false, error: "Essa proposta expirou. Quer que eu refaça?" };
  }

  const executor = getProposalExecutor(pending.actionType);
  if (!executor) {
    return { ok: false, error: `Não sei executar "${pending.actionType}".` };
  }

  // Duplo clique ou página recarregada: só uma confirmação passa daqui (F6-04).
  const claimed = await prisma.astroPendingAction.updateMany({
    where: { id: pending.id, status: "PENDING", confirmedAt: null },
    data: { confirmedAt: new Date() },
  });
  if (claimed.count === 0) {
    return {
      ok: true,
      payload: {
        kind: "astro_confirmation_result",
        proposalId: pending.id,
        actionType: pending.actionType,
        ok: true,
        title: "Já recebida",
        summary: "Essa confirmação já tinha sido recebida — nada foi duplicado.",
      },
    };
  }

  try {
    const result = await executor({
      ctx,
      proposalId: pending.id,
      payload: pending.payload as Record<string, unknown>,
    });
    await prisma.astroPendingAction.update({
      where: { id: pending.id },
      data: {
        status: result.ok ? "CONFIRMED" : "FAILED",
        confirmedAt: new Date(),
        result: (result.data ?? { summary: result.summary }) as object,
        errorMessage: result.ok ? null : result.summary,
      },
    });
    return {
      ok: true,
      payload: {
        kind: "astro_confirmation_result",
        proposalId: pending.id,
        actionType: pending.actionType,
        ok: result.ok,
        title: result.ok ? "Feito" : "Não deu certo",
        summary: result.summary,
        lines: result.lines,
        links: result.links,
        followUp: result.followUp,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao executar";
    console.error("[astro/confirm] executor failed", error);
    await prisma.astroPendingAction.update({
      where: { id: pending.id },
      data: { status: "FAILED", confirmedAt: new Date(), errorMessage: message },
    });
    return { ok: false, error: `Falhou ao executar: ${message}` };
  }
}

export async function cancelPendingAction(params: {
  ctx: AgentContext;
  proposalId?: string;
}): Promise<{ summary: string } | { error: string }> {
  const { ctx } = params;
  const pending = await loadPending(ctx, params.proposalId);
  if (
    !pending ||
    pending.organizationId !== ctx.organizationId ||
    pending.userId !== ctx.userId
  ) {
    return { error: "Não achei essa proposta." };
  }
  if (pending.status !== "PENDING" || pending.confirmedAt) {
    return { summary: `Proposta já estava ${pending.confirmedAt ? "em execução" : pending.status.toLowerCase()}.` };
  }
  await prisma.astroPendingAction.update({
    where: { id: pending.id },
    data: { status: "CANCELLED" },
  });
  return { summary: "Proposta cancelada. Nada foi gravado." };
}
