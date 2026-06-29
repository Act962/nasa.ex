import "server-only";

import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { pusherServer } from "@/lib/pusher";

/**
 * Finaliza uma chamada LiveKit do tracking-chat — atualiza a Message do
 * tipo `voice_call|video_call` (criada por `createLeadMeeting`) com a
 * **duração final** e status `"completed"` (ou `"missed"` se ninguém
 * atendeu).
 *
 * Chamado pelo client `/call/[room]` quando o usuário clica em "Sair" ou
 * fecha a aba. É fire-and-forget — se falhar, a Message fica com status
 * "started" pra sempre (cosmético).
 *
 * **Idempotente**: chamar 2x sobrescreve `durationSec` mas mantém OK.
 */

export const endLeadMeeting = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    path: "/livekit/end-lead-meeting",
    summary: "Finaliza chamada LiveKit + atualiza duração na timeline",
    tags: ["LiveKit", "Tracking Chat"],
  })
  .input(
    z.object({
      /** Nome da room (gerado por createLeadMeeting). */
      roomName: z.string().min(1),
      /** Duração total em segundos. */
      durationSec: z.number().int().min(0).max(60 * 60 * 24),
      /**
       * Status final. `completed` = alguém atendeu, `missed` = ninguém
       * atendeu (lead não entrou na sala), `declined` = lead recusou.
       */
      status: z.enum(["completed", "missed", "declined"]).default("completed"),
    }),
  )
  .output(
    z.object({
      updated: z.boolean(),
    }),
  )
  .handler(async ({ input, context }) => {
    // messageId é deterministicamente derivado do roomName pelo createLeadMeeting
    const messageId = `livekit-call-${input.roomName}`;

    const existing = await prisma.message.findUnique({
      where: { messageId },
      select: {
        id: true,
        body: true,
        mediaType: true,
        conversationId: true,
        conversation: {
          select: { tracking: { select: { organizationId: true } } },
        },
      },
    });
    if (!existing) {
      return { updated: false };
    }
    // Garante que a chamada pertence à org do user (evita usuários de
    // outras orgs marcarem chamadas alheias como missed).
    if (
      existing.conversation.tracking?.organizationId &&
      existing.conversation.tracking.organizationId !== context.org.id
    ) {
      return { updated: false };
    }

    let prevPayload: Record<string, any> = {};
    try {
      prevPayload = existing.body ? JSON.parse(existing.body) : {};
    } catch {}

    const newBody = JSON.stringify({
      ...prevPayload,
      type:
        prevPayload.type ??
        (existing.mediaType === "video_call" ? "video" : "voice"),
      status: input.status,
      durationSec: input.durationSec,
    });

    await prisma.message.update({
      where: { id: existing.id },
      data: { body: newBody },
    });

    // Notifica via Pusher pra atualização instantânea na UI dos atendentes
    // que estão com a conversa aberta.
    pusherServer
      .trigger(existing.conversationId, "messages:updated", {
        messageId: existing.id,
        conversationId: existing.conversationId,
      })
      .catch(() => {});

    return { updated: true };
  });
