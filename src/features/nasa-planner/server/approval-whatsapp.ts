import "server-only";
import prisma from "@/lib/prisma";
import { getPublicMediaUrl } from "@/lib/r2-url";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { createPendingAction } from "@/features/astro/server/tools/_shared/proposals/create-proposal";
import { cancelPendingAction } from "@/features/astro/server/tools/_shared/proposals/confirm-direct";
import { TrackingProviderBotChannel } from "@/features/astro-bot/lib/tracking-provider-channel";
import { requestChangesWithGroup } from "./publish-group";

/**
 * Aprovação de posts pelo WhatsApp (spec 0064, RF-4/RF-5). O aviso vira uma proposta pendente na
 * sessão do aprovador: o "SIM" dele cai no `confirmPendingAction` de sempre (D-2).
 */

export const PLANNER_APPROVE_ACTION_TYPE = "planner.post.approve";
const APPROVAL_TTL_MINUTES = 24 * 60;
const FORMAT_LABEL: Record<string, string> = { STATIC: "Feed", CAROUSEL: "Carrossel", REEL: "Reel", STORY: "Story" };
const CHANGES_REPLY_PATTERN = /^\s*ajust(?:e|ar)\s*[:\-–]?\s*([\s\S]+)$/i;

function whatsappContext(binding: { id: string; userId: string; organizationId: string }): AgentContext {
  return { userId: binding.userId, organizationId: binding.organizationId, channel: "WHATSAPP", sessionId: `whatsapp:${binding.id}`, route: {} } as AgentContext;
}

function formatWhen(date: Date | null) {
  return date ? date.toLocaleString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : null;
}

export async function notifyApproversOnWhatsapp(postId: string, approverIds: string[]) {
  if (approverIds.length === 0) return { notified: 0 };
  const post = await prisma.nasaPlannerPost.findUniqueOrThrow({
    where: { id: postId },
    select: { id: true, organizationId: true, title: true, type: true, caption: true, thumbnail: true, scheduledAt: true, submittedById: true },
  });
  const organization = await prisma.organization.findUniqueOrThrow({ where: { id: post.organizationId }, select: { name: true } });
  const botConfig = await prisma.organizationBotConfig.findUnique({
    where: { organizationId: post.organizationId },
    select: { isActive: true, enabledTrackings: { select: { trackingId: true }, take: 1 } },
  });
  const senderTrackingId = botConfig?.isActive ? botConfig.enabledTrackings[0]?.trackingId : undefined;
  if (!senderTrackingId) return { notified: 0 };

  const bindings = await prisma.userWhatsappBinding.findMany({
    where: { organizationId: post.organizationId, userId: { in: approverIds }, isActive: true },
    select: { id: true, userId: true, organizationId: true, phoneE164: true },
  });
  if (bindings.length === 0) return { notified: 0 };

  const requester = post.submittedById ? await prisma.user.findUnique({ where: { id: post.submittedById }, select: { name: true } }) : null;
  const title = post.title?.trim() || `Post (${FORMAT_LABEL[post.type] ?? post.type})`;
  const when = formatWhen(post.scheduledAt);
  const imageUrl = post.thumbnail ? await getPublicMediaUrl(post.thumbnail).catch(() => null) : null;
  const channel = new TrackingProviderBotChannel(senderTrackingId);

  let notified = 0;
  for (const binding of bindings) {
    const message = [
      "🔔 *Post esperando sua aprovação*",
      `${organization.name} · ${FORMAT_LABEL[post.type] ?? post.type}${when ? ` · ${when}` : ""}`,
      `*${title}*`,
      post.caption ? `“${post.caption.slice(0, 300)}”` : null,
      requester?.name ? `Pedido por ${requester.name}` : null,
      "",
      "Responda *SIM* para aprovar ou *AJUSTE: o que mudar* para pedir ajuste.",
    ]
      .filter((line) => line !== null)
      .join("\n");
    try {
      if (imageUrl && post.type !== "REEL") await channel.sendMedia(binding.phoneE164, { url: imageUrl, caption: `*${title}*` });
      await channel.sendText(binding.phoneE164, message);
    } catch (error) {
      console.error("[planner/approval-whatsapp] envio falhou", { bindingId: binding.id, error: error instanceof Error ? error.message : String(error) });
      continue;
    }
    // Cartão só depois do envio: aviso que não chegou não pode ficar esperando um SIM.
    await createPendingAction({
      ctx: whatsappContext(binding),
      actionType: PLANNER_APPROVE_ACTION_TYPE,
      payload: { postId: post.id },
      title: `Aprovar "${title}"`,
      lines: [{ label: "Formato", value: FORMAT_LABEL[post.type] ?? post.type }, ...(when ? [{ label: "Quando", value: when }] : [])],
      ttlMinutes: APPROVAL_TTL_MINUTES,
    });
    notified += 1;
  }
  return { notified };
}

/**
 * "AJUSTE: motivo" respondendo a um aviso de aprovação pendente (RF-5). Devolve a resposta ao
 * usuário, ou null quando não é o caso (aí segue o fluxo normal do bot).
 */
export async function tryPlannerChangesReply(input: { binding: { id: string; userId: string; organizationId: string }; text: string }): Promise<string | null> {
  const match = input.text.match(CHANGES_REPLY_PATTERN);
  if (!match) return null;
  const ctx = whatsappContext(input.binding);
  const pending = await prisma.astroPendingAction.findFirst({
    where: {
      organizationId: input.binding.organizationId,
      userId: input.binding.userId,
      channel: "WHATSAPP",
      sessionId: ctx.sessionId,
      actionType: PLANNER_APPROVE_ACTION_TYPE,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, payload: true },
  });
  if (!pending) return null;
  const postId = (pending.payload as { postId?: string } | null)?.postId;
  if (!postId) return null;

  const reason = match[1].trim();
  await requestChangesWithGroup({ postId, actorId: input.binding.userId, body: reason });
  await cancelPendingAction({ ctx, proposalId: pending.id });
  return `✍️ Ajuste pedido: “${reason}”. Quem criou o post foi avisado.`;
}

const ADJUST_REQUEST_PATTERN = /^\s*ajust(?:e|ar)\b\s*[:\-–]?\s*([\s\S]*)$/i;

/**
 * "Ajustar: …" com um rascunho do Planner pendente (spec 0064, RF-3): reescreve o pedido para o
 * orquestrador refazer a proposta pela tool, a partir da anterior. Sem isso o modelo respondia em
 * texto e o SIM confirmaria o cartão antigo.
 */
export async function buildPlannerAdjustPrompt(input: { binding: { id: string; userId: string; organizationId: string }; text: string }): Promise<string | null> {
  const match = input.text.match(ADJUST_REQUEST_PATTERN);
  if (!match) return null;
  const pending = await prisma.astroPendingAction.findFirst({
    where: {
      organizationId: input.binding.organizationId,
      userId: input.binding.userId,
      channel: "WHATSAPP",
      sessionId: `whatsapp:${input.binding.id}`,
      actionType: "planner.drafts.create",
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: { payload: true },
  });
  if (!pending) return null;
  const previous = pending.payload as { formats?: string[]; title?: string; script?: string; caption?: string; hashtags?: string[]; intendedAtIso?: string };
  return [
    `Refaça a proposta de rascunho do Planner chamando propose_planner_drafts de novo, aplicando este ajuste: "${match[1].trim() || input.text.trim()}".`,
    "Proposta anterior (mantenha o que o ajuste não muda):",
    JSON.stringify({ formats: previous.formats, title: previous.title, script: previous.script, caption: previous.caption, hashtags: previous.hashtags, intendedAtIso: previous.intendedAtIso }),
  ].join("\n");
}
