import "server-only";

import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import {
  mintLiveKitToken,
  isLiveKitConfigured,
} from "@/lib/livekit/server";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import { sendText } from "@/http/uazapi/send-text";
import { v4 as uuidv4 } from "uuid";
import { WhatsAppInstanceStatus, MessageStatus } from "@/generated/prisma/enums";
import { logActivity } from "@/features/admin/lib/activity-logger";

/**
 * Cria uma sala LiveKit pra chamada **audio/video 1:1 entre consultor e
 * lead**, no contexto de uma conversa do `/tracking-chat`.
 *
 * Fluxo:
 *  1. Valida que o consultor tem acesso à conversa (org + tracking).
 *  2. Cobra 2★ (action `livekit_lead_call`) — fail-fast antes de chamar LiveKit.
 *  3. Cria room name único: `lead-call:<conversationId>:<timestamp>`.
 *  4. Mint 2 tokens:
 *     - **Consultor**: speaker, identity = `user.id`, name = user.name.
 *     - **Lead**: speaker, identity sintética `lead:<leadId>`, name = lead.name.
 *  5. Retorna `roomName`, `consultorToken` + `leadJoinUrl` (URL pública
 *     `/call/[room]?t=<token>&n=<encodedName>` que o lead clica).
 *
 * O caller (UI do chat header) é responsável por:
 *  - Enviar o `leadJoinUrl` como mensagem WhatsApp pro lead via
 *    `nasaPlanner.messages.create` ou similar.
 *  - Abrir nova aba `/call/[room]?t=<consultorToken>` pro consultor entrar.
 *
 * Não inicia gravação (Sprint 2 cobre via LiveKit Egress + AssemblyAI).
 */

export const createLeadMeeting = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    path: "/livekit/create-lead-meeting",
    summary: "Cria sala LiveKit pra chamada áudio/vídeo com o lead",
    tags: ["LiveKit", "Tracking Chat"],
  })
  .input(
    z.object({
      conversationId: z.string().min(1),
      mode: z.enum(["video", "audio"]).default("video"),
      /**
       * Se `true` (default), o backend envia o `leadJoinUrl` como
       * mensagem WhatsApp automática pro lead via uazapi. Se `false`,
       * só retorna a URL e o caller é responsável por enviar.
       */
      notifyLead: z.boolean().default(true),
      /**
       * URL absoluta da app (origin) pra montar o link enviado ao lead.
       * Vem do client porque o backend não tem acesso a `window.origin`.
       * Ex: `https://orbita.nasaex.com`. Fallback: env `BETTER_AUTH_URL`.
       */
      appOrigin: z.string().url().optional(),
    }),
  )
  .output(
    z.object({
      roomName: z.string(),
      consultorToken: z.string(),
      leadJoinUrl: z.string(),
      livekitUrl: z.string(),
      notifiedViaWhatsApp: z.boolean(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    if (!isLiveKitConfigured()) {
      // INTERNAL_SERVER_ERROR é o erro genérico disponível no mapa de
      // erros padrão; "precondition failed" não está exposto.
      throw errors.INTERNAL_SERVER_ERROR({
        message:
          "LiveKit não configurado — defina LIVEKIT_API_KEY/SECRET no .env.local.",
      });
    }

    // 1) Carrega conversa + lead + tracking + instância WA pra enviar link.
    // Lead NÃO tem `organizationId` direto (só `trackingId`); a auth da
    // org vem via `tracking.organizationId`.
    const conversation = await prisma.conversation.findUnique({
      where: { id: input.conversationId },
      include: {
        lead: {
          select: { id: true, name: true, phone: true },
        },
        tracking: {
          select: {
            organizationId: true,
            whatsappInstance: {
              select: { apiKey: true, baseUrl: true, status: true },
            },
          },
        },
      },
    });
    if (!conversation || !conversation.lead) {
      throw errors.NOT_FOUND({ message: "Conversa não encontrada" });
    }

    const orgId = conversation.tracking?.organizationId;
    if (orgId !== context.org.id) {
      throw errors.FORBIDDEN({
        message: "Sem permissão pra essa conversa",
      });
    }

    // 2) Cobrança upfront (2★). Falha se saldo insuficiente.
    const charge = await chargeStarsByAction(context.org.id, "livekit_lead_call", {
      userId: context.user.id,
      appSlug: "livekit_lead_call",
      description: "Chamada de vídeo/áudio com lead (LiveKit)",
    });
    if (!charge.success) {
      throw errors.BAD_REQUEST({
        message: "Saldo de STARs insuficiente pra iniciar chamada (2★).",
        data: { code: "INSUFFICIENT_STARS" },
      });
    }

    // 3) Nome único da sala — `lead-call:<conversationId>:<timestamp>`.
    // Timestamp evita conflito caso o consultor inicie outra chamada
    // depois (token antigo expira em 6h por default).
    const roomName = `lead-call:${conversation.id}:${Date.now()}`;

    // 4) Mint tokens.
    const consultorToken = await mintLiveKitToken({
      roomName,
      identity: context.user.id,
      name: context.user.name,
      role: "speaker",
      metadata: {
        role: "consultor",
        conversationId: conversation.id,
        leadId: conversation.lead.id,
      },
    });

    const leadIdentity = `lead:${conversation.lead.id}`;
    const leadToken = await mintLiveKitToken({
      roomName,
      identity: leadIdentity,
      name: conversation.lead.name,
      role: "speaker",
      metadata: {
        role: "lead",
        conversationId: conversation.id,
        leadId: conversation.lead.id,
      },
    });

    // 5) Path do link público (relativo). Componho a URL absoluta logo
    // abaixo usando `appOrigin` (vindo do client com `window.location.origin`)
    // ou `BETTER_AUTH_URL` como fallback de produção.
    const leadJoinPath = `/call/${encodeURIComponent(roomName)}?t=${encodeURIComponent(leadToken)}&n=${encodeURIComponent(conversation.lead.name ?? "Lead")}&mode=${input.mode}`;
    const originBase =
      input.appOrigin ??
      process.env.BETTER_AUTH_URL ??
      process.env.NEXT_PUBLIC_BASE_URL ??
      "https://orbita.nasaex.com";
    const leadJoinUrl = `${originBase.replace(/\/$/, "")}${leadJoinPath}`;

    const livekitUrl =
      process.env.NEXT_PUBLIC_LIVEKIT_URL ?? process.env.LIVEKIT_WS_URL ?? "";

    // 6) Notifica o lead via WhatsApp (se solicitado + instância OK).
    // Falha silenciosa — ligação ainda funciona se a mensagem não passar.
    let notifiedViaWhatsApp = false;
    const instance = conversation.tracking?.whatsappInstance;
    if (
      input.notifyLead &&
      instance?.apiKey &&
      instance.status === WhatsAppInstanceStatus.CONNECTED &&
      conversation.lead.phone
    ) {
      try {
        const callType = input.mode === "video" ? "vídeo" : "áudio";
        const messageText = [
          `📞 Chamada de ${callType} iniciada por ${context.user.name}.`,
          `Clique pra entrar: ${leadJoinUrl}`,
        ].join("\n\n");

        await sendText(
          instance.apiKey,
          {
            number: conversation.lead.phone,
            text: messageText,
            readchat: true,
            readmessages: true,
          },
          instance.baseUrl ?? undefined,
        );
        notifiedViaWhatsApp = true;

        // Persiste no histórico da conversa pra o lead achar o link
        // depois se fechar a mensagem.
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            messageId: `livekit-link-${uuidv4()}`,
            body: messageText,
            fromMe: true,
            status: MessageStatus.SENT,
            senderName: context.user.name,
          },
        });

        // Cria também uma "Call Message" estilo WhatsApp — card visual
        // de chamada no topo da timeline. Atualizada depois quando a
        // chamada termina (via `conversation.endCall`) pra preencher
        // `durationSec` + mudar status pra "completed" ou "missed".
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            messageId: `livekit-call-${roomName}`,
            // `body` em JSON — UI parsea via `parseCallPayload`
            body: JSON.stringify({
              type: input.mode === "video" ? "video" : "voice",
              status: "started",
              durationSec: null,
              roomName,
            }),
            mediaType: input.mode === "video" ? "video_call" : "voice_call",
            fromMe: true,
            status: MessageStatus.SENT,
            senderName: context.user.name,
          },
        });
      } catch (err) {
        console.warn(
          "[livekit.createLeadMeeting] falha ao enviar link via WhatsApp",
          err,
        );
      }
    }

    // 7) Audit log — registra a ação no histórico do lead/org pra que
    // owners vejam em Insights/Atividades quem iniciou chamada com quem.
    // Fire-and-forget — falha não impacta o retorno da chamada.
    logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image ?? null,
      appSlug: "chat",
      action: "livekit.call.started",
      actionLabel: `Iniciou chamada de ${input.mode === "video" ? "vídeo" : "áudio"} com ${conversation.lead.name}`,
      resource: "lead",
      resourceId: conversation.lead.id,
      subAppSlug: "tracking-chat",
      featureKey: `chat.livekit.${input.mode}_call_started`,
      metadata: {
        conversationId: conversation.id,
        leadId: conversation.lead.id,
        leadName: conversation.lead.name,
        mode: input.mode,
        roomName,
        notifiedViaWhatsApp,
      },
    }).catch(() => {});

    return {
      roomName,
      consultorToken,
      leadJoinUrl,
      livekitUrl,
      notifiedViaWhatsApp,
    };
  });
