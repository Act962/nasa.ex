import "server-only";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";
import type {
  AstroConfirmationLine,
  AstroConfirmationPayload,
} from "@/features/astro/lib/astro-confirmation";
import { buildConfirmMessage } from "@/features/astro/lib/astro-confirmation";

// Grava uma proposta pendente e devolve o payload que vira card/mensagem.
// TTL curto no chat (o usuário está olhando) e mais longo no WhatsApp (o
// "sim" pode demorar).

const CHAT_TTL_MINUTES = 30;
const WHATSAPP_TTL_MINUTES = 120;

export async function createPendingAction(params: {
  ctx: AgentContext;
  actionType: string;
  payload: Record<string, unknown>;
  title: string;
  lines: AstroConfirmationLine[];
  warnings?: string[];
}): Promise<AstroConfirmationPayload> {
  const channel = params.ctx.channel ?? "CHAT";
  const ttlMinutes = channel === "WHATSAPP" ? WHATSAPP_TTL_MINUTES : CHAT_TTL_MINUTES;
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  const summary = [params.title, ...params.lines.map((line) => `${line.label}: ${line.value}`)]
    .join(" · ")
    .slice(0, 500);

  const pending = await prisma.astroPendingAction.create({
    data: {
      organizationId: params.ctx.organizationId,
      userId: params.ctx.userId,
      channel,
      sessionId: params.ctx.sessionId ?? null,
      actionType: params.actionType,
      payload: params.payload as object,
      summary,
      expiresAt,
    },
    select: { id: true },
  });

  return {
    kind: "astro_confirmation",
    proposalId: pending.id,
    actionType: params.actionType,
    title: params.title,
    lines: params.lines,
    warnings: params.warnings ?? [],
    expiresAt: expiresAt.toISOString(),
    confirmHint: buildConfirmMessage(pending.id),
  };
}
