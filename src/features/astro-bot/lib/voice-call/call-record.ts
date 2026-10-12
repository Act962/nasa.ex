import "server-only";
import prisma from "@/lib/prisma";
import { trackLeadEvent } from "@/lib/lead-journey/track";
import { requestLeadMetricsRecompute } from "@/features/leads/lib/metrics/request-recompute";
import { ensureLeadConversation } from "@/features/tracking-executions/lib/send-template-to-lead";
import { waIdLookupVariants } from "@/features/tracking-chat/lib/providers/adapters/meta-cloud/normalize-phone";

/**
 * Registro da chamada no que já existe (spec 0087, Parte A): o lead do número que ligou
 * (criado como numa primeira mensagem, se não existir), uma mensagem de ligação na conversa
 * do chat com a transcrição, e um evento na jornada do lead. Sem tabela nem coluna nova.
 */

export interface CallTranscriptLine {
  speaker: "pessoa" | "astro" | "sistema";
  text: string;
  at: number;
}

const JOURNEY_SUMMARY_LIMIT = 400;

export async function findOrCreateCallerLead(params: { trackingId: string; callerPhone: string; callerName: string | null }) {
  const existing = await prisma.lead.findFirst({
    where: { trackingId: params.trackingId, phone: { in: waIdLookupVariants(params.callerPhone) } },
    select: { id: true, phone: true },
  });
  if (existing?.phone) return { id: existing.id, phone: existing.phone, wasCreated: false };

  // Mesmo ponto de entrada do lead que manda a primeira mensagem: primeira etapa do funil, no topo.
  const firstStatus = await prisma.status.findFirst({
    where: { trackingId: params.trackingId },
    select: { id: true },
    orderBy: { order: "asc" },
  });
  if (!firstStatus) return null;
  const topLead = await prisma.lead.findFirst({
    where: { statusId: firstStatus.id },
    select: { order: true },
    orderBy: { order: "asc" },
  });
  const created = await prisma.lead.create({
    data: {
      name: params.callerName?.trim() || "Sem nome",
      phone: params.callerPhone,
      trackingId: params.trackingId,
      statusId: firstStatus.id,
      source: "WHATSAPP",
      order: topLead ? Number(topLead.order) - 1 : 0,
      statusFlow: "WAITING",
      lastInboundAt: new Date(),
    },
    select: { id: true, phone: true },
  });
  return { id: created.id, phone: created.phone ?? params.callerPhone, wasCreated: true };
}

/** Grava ou atualiza a ligação na conversa do lead. Chamada a cada minuto e ao fim; a mesma mensagem é reescrita. */
export async function saveCallInLeadChat(params: {
  trackingId: string;
  metaCallId: string;
  callerPhone: string;
  callerName: string | null;
  startedAt: number;
  durationSeconds: number;
  transcript: CallTranscriptLine[];
  isFinal: boolean;
  isInterrupted: boolean;
}): Promise<void> {
  try {
    const lead = await findOrCreateCallerLead(params);
    if (!lead) return;
    const conversationId = await ensureLeadConversation(params.trackingId, { id: lead.id, phone: lead.phone });
    const messageId = `wa-call-${params.metaCallId}`;
    const callBody = JSON.stringify({
      type: "voice",
      status: params.isFinal ? "completed" : "started",
      durationSec: params.isFinal ? params.durationSeconds : null,
    });
    const metadata = {
      callTranscript: params.transcript.map((line) => ({ speaker: line.speaker, text: line.text, at: line.at })),
      callInterrupted: params.isInterrupted,
    };
    await prisma.message.upsert({
      where: { messageId },
      create: {
        conversationId,
        messageId,
        body: callBody,
        mediaType: "voice_call",
        fromMe: false,
        status: "SEEN",
        senderName: params.callerName,
        metadata,
        createdAt: new Date(params.startedAt),
      },
      update: { body: callBody, metadata },
    });
    if (!params.isFinal) return;

    await prisma.lead.update({ where: { id: lead.id }, data: { lastInboundAt: new Date(params.startedAt) } });
    const spokenByCaller = params.transcript
      .filter((line) => line.speaker === "pessoa")
      .map((line) => line.text)
      .join(" | ")
      .slice(0, JOURNEY_SUMMARY_LIMIT);
    await trackLeadEvent({
      leadId: lead.id,
      kind: "voice_call",
      occurredAt: new Date(params.startedAt),
      metadata: {
        durationSec: params.durationSeconds,
        messageId,
        isInterrupted: params.isInterrupted,
        summary: spokenByCaller,
      },
    });
    await requestLeadMetricsRecompute(lead.id);
  } catch (recordError) {
    // O registro no chat é complemento: falha aqui não afeta a chamada nem a cobrança.
    console.warn("[astro-bot/chamada] registro no chat falhou:", recordError instanceof Error ? recordError.message.slice(0, 200) : "erro");
  }
}
