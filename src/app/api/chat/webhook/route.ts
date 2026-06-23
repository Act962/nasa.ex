import { type NextRequest, NextResponse } from "next/server";
import { pusherServer } from "@/lib/pusher";
import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { WhatsAppInstanceStatus } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { MessageStatus } from "@/features/tracking-chat/types";
import { WA_COLORS } from "@/utils/whatsapp-utils";
import {
  callsEventSchema,
  chatLabelsEventSchema,
  messagesEventSchema,
  webhookBaseSchema,
} from "@/http/uazapi/webhook-schema";
import { getCachedTrackingContext } from "@/features/tracking-chat/lib/get-cached-tracking-context";
import {
  createProvider,
  invalidateOutboundProvider,
} from "@/features/tracking-chat/lib/providers";
import { persistCanonicalInbound } from "@/features/tracking-chat/lib/inbound/persist-canonical-inbound";
import {
  buildUazapiDownloadInboundMedia,
  buildUazapiFetchProfilePicture,
} from "@/features/tracking-chat/lib/inbound/uazapi-strategies";

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const trackingId = searchParams.get("trackingId");

  if (!trackingId) {
    return NextResponse.json(
      { error: "trackingId is required" },
      { status: 400 },
    );
  }

  try {
    const json = await request.json();
    console.log(json);
    const base = webhookBaseSchema.safeParse(json);
    if (!base.success) {
      console.warn("[webhook:chat] invalid_base", {
        trackingId,
        issues: base.error.issues,
      });
      return NextResponse.json(
        { ok: false, reason: "invalid_payload" },
        { status: 400 },
      );
    }

    if (base.data.EventType === "messages") {
      const messagesParsed = messagesEventSchema.safeParse(json);
      if (!messagesParsed.success) {
        console.warn("[webhook:chat] invalid_messages", {
          trackingId,
          issues: messagesParsed.error.issues,
        });
        return NextResponse.json(
          { ok: false, reason: "invalid_messages_payload" },
          { status: 200 },
        );
      }

      const fromMe = json.message.fromMe;
      const phone = json.message.chatid.split("@")[0];

      const tracking = await getCachedTrackingContext(trackingId);
      if (!tracking) {
        return NextResponse.json(
          { error: "Tracking context not found" },
          { status: 400 },
        );
      }

      // ── Astro Bot via WhatsApp ─────────────────────────────────
      // Se o remetente (não-fromMe) é um membro com UserWhatsappBinding
      // ativo NA ORG DESTE TRACKING, intercepta e roteia pro orchestrator
      // IA em vez do fluxo de atendimento. Mensagem do membro = comando
      // pro bot, não lead novo. Texto puro só — mídia ainda cai no fluxo
      // normal. Roda ANTES da normalização canônica pra escopar o binding
      // por org e evitar criar Lead/Message indevidos.
      const bodyForBot = (json.message.text ?? "").trim();
      if (!fromMe && bodyForBot && json.message.messageType === "TextMessage") {
        try {
          const { maybeHandleBotMessage } = await import(
            "@/features/astro-bot/lib/webhook-handler"
          );
          const botResult = await maybeHandleBotMessage({
            fromPhone: phone,
            messageText: bodyForBot,
            receivingInstanceToken: json.token,
            deviceId: json.deviceId ?? undefined,
            trackingOrganizationId: tracking.organizationId,
          });
          if (botResult.handled) {
            return NextResponse.json(
              {
                ok: true,
                handledBy: "astro-bot",
                bindingId: botResult.bindingId,
                status: botResult.status,
              },
              { status: 200 },
            );
          }
        } catch (err) {
          console.error(
            "[webhook:chat] astro-bot handler failed — fallback to atendimento normal",
            err,
          );
        }
      }

      // ── Pipeline canônica ─────────────────────────────────────────────
      // Fase 3: o webhook não mais persiste mensagens diretamente. Ele
      // normaliza o payload via `UazapiProvider.normalizeInbound` e delega
      // pra `persistCanonicalInbound`, que é o único caminho de
      // persistência inbound — Uazapi hoje, Meta na Fase 5.
      //
      // Strategies provider-specific (avatar + download de mídia) são
      // injetadas; CTWA é resolvido passando `[json.message, json]` como
      // sources de referral (paridade com `resolveReferralForOrg` antigo).
      const uazapiToken = json.token ?? "";
      const provider = createProvider("uazapi", {
        token: uazapiToken,
        baseUrl: process.env.NEXT_PUBLIC_UAZAPI_BASE_URL,
      });

      const normalized = provider.normalizeInbound(json);
      if (!normalized) {
        return NextResponse.json(
          { ok: false, reason: "normalize_failed" },
          { status: 200 },
        );
      }

      if (normalized.messages.length === 0) {
        // Tipos sem persistência (ex.: ProtocolMessage não-revoke,
        // contato sem nome/telefone) — Uazapi continua retornando 200/201.
        return NextResponse.json(
          { success: true, ignored: "no_canonical_messages" },
          { status: 200 },
        );
      }

      const fetchProfilePicture = buildUazapiFetchProfilePicture(uazapiToken);
      const downloadInboundMedia = buildUazapiDownloadInboundMedia(uazapiToken);

      const results = [];
      for (const canonical of normalized.messages) {
        const result = await persistCanonicalInbound(canonical, {
          trackingId,
          providerId: "uazapi",
          fetchProfilePicture,
          downloadInboundMedia,
          ctwaSources: [json.message, json],
          channel: "WHATSAPP",
        });
        results.push(result);
      }

      // Falhas estruturais (status do funil ausente, conversa não
      // criada) devem virar 400/500 — paridade com o route antigo, que
      // retornava 400 "Status context not found" quando o tracking não
      // tinha funil configurado. Sem isso, o webhook esconde a falha de
      // configuração e devolve sucesso falso pro provider.
      const firstFailure = results.find((r) => !r.ok);
      if (firstFailure && !firstFailure.ok) {
        if (firstFailure.reason === "tracking_not_found") {
          return NextResponse.json(
            { error: "Tracking context not found" },
            { status: 400 },
          );
        }
        if (firstFailure.reason === "lead_creation_failed") {
          // Mais provável: funil sem Status (`status_not_configured`).
          // Paridade direta com o 400 do route antigo.
          return NextResponse.json(
            { error: "Status context not found" },
            { status: 400 },
          );
        }
        return NextResponse.json(
          { error: firstFailure.reason },
          { status: 500 },
        );
      }

      // ── Tag automática por clique em botão ─────────────────────────────
      // Quando o lead responde um menu de botões enviado pela automação
      // (send-message inline com tagId por botão), aplica a tag ao lead e
      // dispara automações LEAD_TAGGED. A mensagem original carrega
      // metadata.buttonTagMap com o mapa buttonId→tagId.
      // 3 estratégias para localizar a mensagem original: o uazapi não
      // garante json.message.quoted em respostas de botão.
      const messageType = json.message.messageType as string | undefined;
      console.log("[btn-tag] messageType:", messageType, "fromMe:", fromMe);
      if (
        !fromMe &&
        normalized.messages.length > 0 &&
        (messageType === "ButtonsResponseMessage" ||
          messageType === "TemplateButtonReplyMessage" ||
          messageType === "ListResponseMessage" ||
          messageType === "InteractiveResponseMessage")
      ) {
        const buttonTagLead = await prisma.lead.findUnique({
          where: { phone_trackingId: { phone, trackingId } },
          select: { id: true, conversation: { select: { id: true } } },
        });

        if (buttonTagLead?.id) {
          const interactiveContent =
            typeof json.message.content === "object" && json.message.content
              ? (json.message.content as Record<string, any>)
              : {};

          console.log("[btn-tag] interactiveContent:", JSON.stringify(interactiveContent));
          console.log("[btn-tag] quoted:", json.message.quoted);
          console.log("[btn-tag] conversation:", buttonTagLead.conversation?.id);

          const clickedButtonId: string | undefined =
            interactiveContent.selectedButtonId ||
            interactiveContent.selectedID ||
            interactiveContent.selectedRowId ||
            interactiveContent.singleSelectReply?.selectedRowId ||
            interactiveContent.buttonReply?.id ||
            undefined;

          console.log("[btn-tag] clickedButtonId:", clickedButtonId);

          if (clickedButtonId) {
            try {
              // Estratégia 1: quotedMessageData (quando json.message.quoted foi populado)
              let originalMeta: unknown = null;
              const quotedMsgId = (json.message.quoted as any)?.messageId;
              if (quotedMsgId) {
                const quotedMsg = await prisma.message.findUnique({
                  where: { messageId: String(quotedMsgId) },
                  select: { metadata: true },
                });
                originalMeta = quotedMsg?.metadata ?? null;
              }
              console.log("[btn-tag] strategy1 originalMeta:", originalMeta);

              // Estratégia 2: contextInfo.stanzaId (formato alternativo do uazapi)
              if (!originalMeta) {
                const contextStanzaId =
                  interactiveContent.contextInfo?.stanzaId ||
                  interactiveContent.contextInfo?.quotedMessageKey?.id;
                console.log("[btn-tag] strategy2 contextStanzaId:", contextStanzaId);
                if (contextStanzaId) {
                  const contextMsg = await prisma.message.findUnique({
                    where: { messageId: String(contextStanzaId) },
                    select: { metadata: true },
                  });
                  originalMeta = contextMsg?.metadata ?? null;
                  console.log("[btn-tag] strategy2 result:", originalMeta);
                }
              }

              // Estratégia 3: mensagem outbound mais recente com buttonTagMap
              // nesta conversa (fallback quando quoted não está disponível)
              if (!originalMeta && buttonTagLead.conversation?.id) {
                const lastButtonMsg = await prisma.message.findFirst({
                  where: {
                    conversationId: buttonTagLead.conversation.id,
                    fromMe: true,
                    metadata: { not: Prisma.DbNull },
                  },
                  orderBy: { createdAt: "desc" },
                  select: { metadata: true },
                });
                originalMeta = lastButtonMsg?.metadata ?? null;
                console.log("[btn-tag] strategy3 result:", originalMeta);
              }

              if (
                originalMeta &&
                typeof originalMeta === "object" &&
                "buttonTagMap" in (originalMeta as object)
              ) {
                const buttonTagMap = (
                  originalMeta as { buttonTagMap: Record<string, string> }
                ).buttonTagMap;
                const resolvedTagId = buttonTagMap[clickedButtonId];
                console.log("[btn-tag] buttonTagMap:", buttonTagMap, "resolvedTagId:", resolvedTagId);

                if (resolvedTagId) {
                  const activeTag = await prisma.tag.findFirst({
                    where: { id: resolvedTagId, archivedAt: null },
                    select: { id: true },
                  });
                  console.log("[btn-tag] activeTag:", activeTag);

                  if (activeTag) {
                    const { applyTagsByAi } = await import(
                      "@/features/tracking-chat-ai/lib/apply-tags-by-ai"
                    );
                    await applyTagsByAi({
                      leadId: buttonTagLead.id,
                      tagIds: [resolvedTagId],
                    });
                    await pusherServer.trigger(trackingId, "lead:updated", {
                      leadId: buttonTagLead.id,
                    });
                    console.log("[btn-tag] tag applied successfully:", resolvedTagId);
                  }
                }
              } else {
                console.log("[btn-tag] no buttonTagMap found in originalMeta:", originalMeta);
              }
            } catch (err) {
              console.error("[webhook:chat] button-tag-apply failed", err);
            }
          }
        }
      }

      // Paridade de status com o handler antigo:
      //  - revoke: 200
      //  - "Message type not processed": 201
      //  - mensagem persistida: 201
      const persisted = results.some((r) => r.ok && "messageId" in r);
      return NextResponse.json(
        { success: true, results },
        { status: persisted ? 201 : 200 },
      );
    }

    if (base.data.EventType === "connection") {
      const newStatus = String(json.instance?.status ?? "").toLowerCase();

      if (newStatus === "disconnected") {
        const disconnectedInstance = await prisma.whatsAppInstance.update({
          where: { apiKey: json.token },
          data: {
            status: WhatsAppInstanceStatus.DISCONNECTED,
          },
          select: { id: true, trackingId: true, baseUrl: true },
        });
        // Invalida cache outbound (Fix #4) — instância recém-desconectada,
        // próximos sends devem cair no caminho In-Chat (não no provider
        // direto, que ia falhar). O `shouldSkipUazapiForConversation` é o
        // gate principal, mas invalidar mantém o cache coerente com o
        // novo estado.
        invalidateOutboundProvider(disconnectedInstance.trackingId);
        // Detecção push-based — dispara a confirmação da queda (carência +
        // checagem de status) que ativa o modo In-Chat se a queda for
        // sustentada. Substitui o contador "3 falhas" e o cron de varredura.
        await inngest.send({
          name: "whatsapp/instance.disconnected",
          data: {
            instanceId: disconnectedInstance.id,
            trackingId: disconnectedInstance.trackingId,
            apiKey: json.token,
            baseUrl: disconnectedInstance.baseUrl,
            reason: json.instance?.lastDisconnectReason ?? null,
          },
        });
      } else if (newStatus === "connected") {
        // Reconexão bem-sucedida — zera contador + desativa o modo In-Chat
        // se estava ligado. É o caminho de recuperação instantâneo; a
        // checagem preguiçosa (`checkInChatRecovery`) cobre quando este
        // webhook não chega.
        const { markInstanceConnectionHealthy } = await import(
          "@/features/tracking-chat/lib/in-chat-mode"
        );
        await markInstanceConnectionHealthy({ apiKey: json.token });
      }
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // ── Chamadas (voz/vídeo) recebidas no WhatsApp ───────────────────────
    // O uazapi entrega via EventType: "calls" com payload do tipo
    // { call: { chatid, from, isVideo, status, duration, ... } }.
    // Persistimos como Message com mediaType="voice_call"/"video_call" +
    // body JSON com status/duração. UI já renderiza via `CallMessageBox`.
    if (base.data.EventType === "calls") {
      const callsParsed = callsEventSchema.safeParse(json);
      if (!callsParsed.success) {
        console.warn("[webhook:chat:calls] invalid_payload", {
          trackingId,
          issues: callsParsed.error.issues,
        });
        return NextResponse.json(
          { ok: false, reason: "invalid_calls_payload" },
          { status: 200 },
        );
      }

      const call = callsParsed.data.call ?? ({} as any);
      // Loga o payload inteiro pra ajudar a corrigir o schema se o
      // formato da uazapi variar.
      console.info("[webhook:chat:calls] received", { trackingId, call });

      const callId =
        call.id || call.callid || `uazapi-call-${call.timestamp ?? Date.now()}`;
      const callChatid = call.chatid || call.from;
      if (!callChatid) {
        return NextResponse.json(
          { ok: false, reason: "missing_chatid" },
          { status: 200 },
        );
      }

      const callPhone = String(callChatid).split("@")[0];

      // Acha o Lead/Conversation. Se não existe, ignora (não cria lead
      // só de chamada — espera primeira mensagem texto pra fazer o
      // round-robin, igual o webhook de messages faz).
      const callLead = await prisma.lead.findUnique({
        where: { phone_trackingId: { phone: callPhone, trackingId } },
        select: { id: true, conversation: { select: { id: true } } },
      });

      if (!callLead?.conversation) {
        return NextResponse.json(
          { ok: true, skipped: "lead_or_conversation_not_found" },
          { status: 200 },
        );
      }

      const isVideo = !!call.isVideo;
      const fromMe = !!call.fromMe;
      const rawStatus = String(call.status ?? "").toLowerCase();

      // Mapeia status do uazapi pro nosso enum de UI.
      // - offer/ringing → "started" (em curso ou recém-iniciada)
      // - accept/answered → "completed" (atendida; vai virar definitivamente
      //   completed quando o `terminate` chegar)
      // - reject/decline → "declined"
      // - terminate/hangup com duration 0 → "missed"
      // - terminate/hangup com duration > 0 → "completed"
      // - timeout/missed → "missed"
      let mappedStatus: "started" | "completed" | "missed" | "declined";
      if (rawStatus === "accept" || rawStatus === "answered") {
        mappedStatus = "completed";
      } else if (rawStatus === "reject" || rawStatus === "decline" || rawStatus === "declined") {
        mappedStatus = "declined";
      } else if (
        rawStatus === "missed" ||
        rawStatus === "timeout" ||
        (rawStatus.includes("terminate") && (!call.duration || call.duration === 0))
      ) {
        mappedStatus = "missed";
      } else if (rawStatus.includes("terminate") || rawStatus === "hangup") {
        mappedStatus = call.duration && call.duration > 0 ? "completed" : "missed";
      } else {
        // offer / ringing / desconhecido — assume "started"
        mappedStatus = "started";
      }

      const callMessageId = `wa-call-${callId}`;
      const callMediaType = isVideo ? "video_call" : "voice_call";
      const callBody = JSON.stringify({
        type: isVideo ? "video" : "voice",
        status: mappedStatus,
        durationSec: call.duration ?? null,
        callId,
        rawStatus,
      });

      const callMessage = await prisma.message.upsert({
        where: { messageId: callMessageId },
        update: {
          body: callBody,
          status: MessageStatus.SEEN,
        },
        create: {
          messageId: callMessageId,
          conversationId: callLead.conversation.id,
          body: callBody,
          mediaType: callMediaType,
          fromMe,
          senderName: fromMe ? "Atendente" : null,
          senderId: fromMe ? null : callChatid,
          status: MessageStatus.SEEN,
          createdAt: call.timestamp ? new Date(call.timestamp) : new Date(),
        },
        select: {
          id: true,
          messageId: true,
          body: true,
          mediaType: true,
          createdAt: true,
          fromMe: true,
          status: true,
          conversationId: true,
          senderId: true,
          senderName: true,
        },
      });

      // Pusher pra atualizar UI em tempo real (mesmo evento que outras
      // mensagens — o front já escuta).
      await pusherServer.trigger(
        callMessage.conversationId,
        "message:new",
        {
          ...callMessage,
          conversation: {
            id: callMessage.conversationId,
            lead: { id: callLead.id, name: "" },
          },
        },
      );

      return NextResponse.json({ success: true, status: mappedStatus }, { status: 201 });
    }
    if (base.data.EventType === "labels") {
      const { LabelID, Action } = json.event;

      if (Action) {
        const tracking = await prisma.tracking.findUnique({
          where: { id: trackingId },
          select: { organizationId: true },
        });

        if (!tracking) {
          return NextResponse.json({ success: true }, { status: 200 });
        }

        const whatsappId = `${LabelID}`;

        const colorHex =
          Action.color !== undefined
            ? WA_COLORS[Action.color] || WA_COLORS[0]
            : WA_COLORS[0];

        if (Action.deleted) {
          await prisma.tag.updateMany({
            where: {
              whatsappId: LabelID,
              organizationId: tracking.organizationId,
            },
            data: {
              whatsappId: null,
            },
          });
        } else {
          const existingTag = await prisma.tag.findFirst({
            where: {
              whatsappId,
              organizationId: tracking.organizationId,
            },
          });

          if (existingTag) {
            await prisma.tag.update({
              where: { id: existingTag.id },
              data: {
                name: Action.name,
                color: colorHex,
              },
            });
          } else {
            // Verifica se já existe uma tag com o mesmo nome para evitar violação do unique constraint
            await prisma.tag.upsert({
              where: {
                name_organizationId_trackingId: {
                  name: Action.name,
                  organizationId: tracking.organizationId,
                  trackingId,
                },
              },
              update: {
                whatsappId,
                color: colorHex,
              },
              create: {
                name: Action.name,
                color: colorHex,
                whatsappId,
                organizationId: tracking.organizationId,
                trackingId,
                slug: `${Action.name.toLowerCase().replace(/\s/g, "_")}-${whatsappId}`,
              },
            });
          }
        }
      }
      return NextResponse.json({ success: true }, { status: 200 });
    }
    if (base.data.EventType === "chat_labels") {
      const chatLabelsParsed = chatLabelsEventSchema.safeParse(json);
      if (!chatLabelsParsed.success) {
        console.warn("[webhook:chat] invalid_chat_labels", {
          trackingId,
          issues: chatLabelsParsed.error.issues,
        });
        return NextResponse.json(
          { ok: false, reason: "invalid_chat_labels_payload" },
          { status: 200 },
        );
      }

      const remoteJid = json.message.chatid;
      const labels = (json.chat.wa_label as string[]) || [];

      const conversation = await prisma.conversation.findFirst({
        where: {
          remoteJid,
          trackingId,
        },
        select: {
          leadId: true,
        },
      });

      if (conversation?.leadId) {
        const whatsappLabelIds = labels
          .map((l) => l.split(":").pop())
          .filter(Boolean) as string[];

        const tags = await prisma.tag.findMany({
          where: {
            whatsappId: { in: whatsappLabelIds },
            trackingId,
          },
          select: { id: true },
        });

        const tagIds = tags.map((t) => t.id);

        await prisma.leadTag.deleteMany({
          where: { leadId: conversation.leadId },
        });

        if (tagIds.length > 0) {
          await prisma.leadTag.createMany({
            data: tagIds.map((tagId) => ({
              leadId: conversation.leadId,
              tagId,
            })),
            skipDuplicates: true,
          });
        }

        await pusherServer.trigger(trackingId, "lead:updated", {
          leadId: conversation.leadId,
        });
      }

      return NextResponse.json({ success: true }, { status: 200 });
    }
    return NextResponse.json({ error: "Event not handled" }, { status: 404 });
  } catch (error: any) {
    console.error("[webhook:chat] unhandled", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
