/**
 * Executors que conectam o agente IA às features NASA + WhatsApp + IA.
 *
 *  - CHECK_PAYMENT  — consulta status de pagamento (Stripe via StarsPayment,
 *                     Asaas via metadata, NasaRouteEnrollment). Devolve
 *                     `paid` / `pending` / `failed` no contexto.
 *
 *  - SEND_VOICE     — gera áudio TTS via OpenAI Audio API e envia via
 *                     uazapi como "ptt" (push-to-talk). Voz natural.
 *
 *  - SEND_MEDIA     — envia imagem/vídeo/áudio/documento WhatsApp via
 *                     uazapi /send/media. Interpolação de texto + URL.
 */
import "server-only";
import OpenAI from "openai";
import { NonRetriableError } from "inngest";
import prisma from "@/lib/prisma";
import { sendMedia } from "@/http/uazapi/send-media";
import { requireUazapiToken } from "@/features/tracking-chat/lib/providers/uazapi-credentials";
import type { MediaType } from "@/http/uazapi/types";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import { AGENT_STARS_ACTIONS } from "../agent-stars-actions";
import { getByPath, interpolate } from "../workflow-context";
import { sendLinkToLead } from "@/features/tracking-executions/lib/send-link-to-lead";
import type { NodeExecutor } from "../run-workflow";

// ─── CHECK_PAYMENT ─────────────────────────────────
// data: {
//   provider: "STRIPE" | "ASAAS",
//   paymentId?: string,    // ID direto (externalId)
//   leadId?: string,       // OU procura último pagamento desse lead
// }
export const checkPaymentExecutor: NodeExecutor = async ({ data, context }) => {
  const provider = String(data.provider ?? "STRIPE").toUpperCase();
  const paymentIdRaw = data.paymentId ? String(data.paymentId) : "";
  const leadIdRaw = data.leadId
    ? String(data.leadId)
    : (context.lead as Record<string, unknown> | undefined)?.id
      ? String((context.lead as Record<string, unknown>).id)
      : "";

  const paymentId = paymentIdRaw.includes("{{")
    ? interpolate(context, paymentIdRaw)
    : paymentIdRaw;
  const leadId = leadIdRaw.includes("{{")
    ? interpolate(context, leadIdRaw)
    : leadIdRaw;

  // Estratégia 1: paymentId direto via StarsPayment.externalId
  if (paymentId) {
    const sp = await prisma.starsPayment.findFirst({
      where: { externalId: paymentId },
      select: {
        status: true,
        amountBrl: true,
        provider: true,
        createdAt: true,
      },
    });
    if (sp) {
      const paid = sp.status === "paid";
      return {
        output: {
          paid,
          status: sp.status,
          amount: sp.amountBrl,
          provider: sp.provider,
          checkedAt: new Date().toISOString(),
          vars: { lastPaymentStatus: sp.status },
        },
        chosenOutput: paid
          ? "paid"
          : sp.status === "pending"
            ? "pending"
            : "failed",
      };
    }
  }

  // Estratégia 2: leadId → último NasaRouteEnrollment com Stripe Intent
  if (leadId && provider === "STRIPE") {
    const enrollment = await prisma.nasaRouteEnrollment.findFirst({
      where: {
        lead: { is: { id: leadId } },
      } as never,
      orderBy: { enrolledAt: "desc" },
      select: {
        status: true,
        paidBrlCents: true,
        stripePaymentIntentId: true,
        enrolledAt: true,
      },
    });
    if (enrollment) {
      const paid = enrollment.status === "PAID";
      return {
        output: {
          paid,
          status: enrollment.status,
          amountCents: enrollment.paidBrlCents,
          intentId: enrollment.stripePaymentIntentId,
          vars: { lastPaymentStatus: enrollment.status },
        },
        chosenOutput: paid ? "paid" : "pending",
      };
    }
  }

  return {
    output: {
      paid: false,
      status: "not_found",
      checkedAt: new Date().toISOString(),
    },
    chosenOutput: "failed",
  };
};

// ─── SEND_VOICE ────────────────────────────────────
// data: { text?: string, textPath?: string, voice?: string, organizationId?, leadId?, trackingId? }
export const sendVoiceExecutor: NodeExecutor = async ({
  data,
  context,
  dryRun,
}) => {
  const textRaw = data.text
    ? String(data.text)
    : data.textPath
      ? String(getByPath(context, String(data.textPath)) ?? "")
      : "";
  const voice = String(data.voice ?? "shimmer"); // OpenAI voices: alloy|echo|fable|onyx|nova|shimmer
  const orgId = String(
    data.organizationId ?? context.trigger?.organizationId ?? "",
  );
  const leadId = String(
    data.leadId ??
      (context.lead as Record<string, unknown> | undefined)?.id ??
      "",
  );
  const trackingId = String(
    data.trackingId ??
      (context.lead as Record<string, unknown> | undefined)?.trackingId ??
      "",
  );

  const text = interpolate(context, textRaw).trim();
  if (!text) {
    return {
      output: { error: "Texto vazio pra TTS" },
      status: "FAILED",
      errorMessage: "text obrigatório",
    };
  }
  if (!leadId || !trackingId) {
    return {
      output: { error: "leadId/trackingId obrigatórios" },
      status: "FAILED",
      errorMessage: "lead/tracking ausente",
    };
  }

  if (dryRun) {
    return {
      output: { dryRun: true, preview: text.slice(0, 100), voice },
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    return {
      output: { error: "OPENAI_API_KEY ausente" },
      status: "FAILED",
      errorMessage: "openai_key_missing",
    };
  }

  // 1. Gera áudio via OpenAI Audio API
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const speech = await openai.audio.speech.create({
    model: "tts-1",
    voice: voice as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer",
    input: text,
    response_format: "opus", // melhor pra WhatsApp ptt
  });
  const audioBuf = Buffer.from(await speech.arrayBuffer());

  // 2. Sobe pro R2 (storage existente) pra ter URL pública
  // R2 helper: src/lib/r2-url.ts + src/lib/s3-client.ts (uploadObject pattern)
  // Pra simplificar Fase 2: usa data:URL inline e deixa uazapi resolver.
  // Fase 4 vai integrar com upload R2 + getSignedUrl.
  const base64 = audioBuf.toString("base64");
  const dataUrl = `data:audio/ogg;base64,${base64}`;

  // 3. Lead + instância WhatsApp
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { phone: true, isActive: true },
  });
  if (!lead?.phone) {
    throw new NonRetriableError("Lead sem telefone pra envio de voz");
  }
  const instance = await prisma.whatsAppInstance.findFirst({
    where: { trackingId },
    select: { apiKey: true },
  });
  if (!instance) {
    throw new NonRetriableError("Instância WhatsApp não encontrada");
  }

  // 4. Envia como ptt (push-to-talk = mensagem de voz)
  const result = await sendMedia(requireUazapiToken(instance.apiKey), {
    number: lead.phone,
    type: "ptt",
    file: dataUrl,
    mimetype: "audio/ogg",
    delay: 1200,
  });

  if (orgId) {
    await chargeStarsByAction(orgId, AGENT_STARS_ACTIONS.SEND_VOICE, {
      description: "Voz IA gerada e enviada",
      appSlug: "agent",
    }).catch((err) => console.warn("[send-voice charge]", err));
  }

  return {
    output: {
      sent: true,
      messageId: result?.response?.fileUrl ?? null,
      textPreview: text.slice(0, 100),
    },
    starsSpent: 1,
  };
};

// ─── SEND_MEDIA ────────────────────────────────────
// data: {
//   mediaType: "IMAGE"|"VIDEO"|"AUDIO"|"DOCUMENT",
//   url: string,                  // pode usar {{vars.foo}} ou {{lead.x}}
//   caption?: string,
//   fileName?: string,            // pra DOCUMENT
//   leadId?, trackingId?, organizationId?
// }
const MEDIA_TYPE_MAP: Record<string, MediaType> = {
  IMAGE: "image",
  VIDEO: "video",
  AUDIO: "audio",
  DOCUMENT: "document",
};

export const sendMediaExecutor: NodeExecutor = async ({
  data,
  context,
  dryRun,
}) => {
  const mediaTypeRaw = String(data.mediaType ?? "IMAGE").toUpperCase();
  const uazapiType = MEDIA_TYPE_MAP[mediaTypeRaw];
  if (!uazapiType) {
    return {
      output: { error: `mediaType inválido: ${mediaTypeRaw}` },
      status: "FAILED",
      errorMessage: "invalid_media_type",
    };
  }

  const urlRaw = String(data.url ?? "");
  const captionRaw = String(data.caption ?? "");
  const fileNameRaw = String(data.fileName ?? "");
  const url = interpolate(context, urlRaw);
  const caption = interpolate(context, captionRaw);
  const fileName = interpolate(context, fileNameRaw);
  const orgId = String(
    data.organizationId ?? context.trigger?.organizationId ?? "",
  );
  const leadId = String(
    data.leadId ??
      (context.lead as Record<string, unknown> | undefined)?.id ??
      "",
  );
  const trackingId = String(
    data.trackingId ??
      (context.lead as Record<string, unknown> | undefined)?.trackingId ??
      "",
  );

  if (!url || !leadId || !trackingId) {
    return {
      output: { error: "url, leadId e trackingId são obrigatórios" },
      status: "FAILED",
      errorMessage: "missing_required",
    };
  }
  if (uazapiType === "document" && !fileName) {
    return {
      output: { error: "fileName obrigatório pra documento" },
      status: "FAILED",
      errorMessage: "missing_filename",
    };
  }

  if (dryRun) {
    return {
      output: { dryRun: true, mediaType: uazapiType, url, caption },
    };
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { phone: true, isActive: true },
  });
  if (!lead?.phone) {
    throw new NonRetriableError("Lead sem telefone pra envio de mídia");
  }
  const instance = await prisma.whatsAppInstance.findFirst({
    where: { trackingId },
    select: { apiKey: true },
  });
  if (!instance) {
    throw new NonRetriableError("Instância WhatsApp não encontrada");
  }

  const result = await sendMedia(requireUazapiToken(instance.apiKey), {
    number: lead.phone,
    type: uazapiType,
    file: url,
    text: caption || undefined,
    docName: uazapiType === "document" ? fileName : undefined,
    delay: 1500,
  });

  if (orgId) {
    await chargeStarsByAction(orgId, AGENT_STARS_ACTIONS.SEND_MEDIA, {
      description: `Mídia (${uazapiType}) enviada pelo agente IA`,
      appSlug: "agent",
    }).catch((err) => console.warn("[send-media charge]", err));
  }

  return {
    output: {
      sent: true,
      mediaType: uazapiType,
      url,
      uazapiResult: result?.response?.status ?? "unknown",
    },
    starsSpent: 1,
  };
};

// ─── SEND_MESSAGE ──────────────────────────────────
// Executor agent-mode pro SEND_MESSAGE. O engine antigo já tem um pelo
// `executor-registry.ts`, mas usa Inngest step/publish que não estão
// disponíveis aqui. Reutiliza `sendLinkToLead` (nome herdado — funciona
// pra qualquer texto, não só link).
//
// data: { action: { payload: { type: "TEXT", message: "..." } } }
//   OU: { action: { payload: { type: "BUTTONS", mode: "preset"|"inline",
//          presetId?, bodyText?, footerText?, buttons? } } }
// O texto suporta interpolação {{lead.name}}, {{vars.x}}, etc.
export const sendMessageExecutor: NodeExecutor = async ({
  data,
  context,
  dryRun,
}) => {
  // unwrap padrão dos node-data: action → payload → message
  const action =
    (data.action && typeof data.action === "object"
      ? (data.action as Record<string, unknown>)
      : data) ?? {};
  const payload =
    (action.payload && typeof action.payload === "object"
      ? (action.payload as Record<string, unknown>)
      : action) ?? {};

  const payloadType = String(payload.type ?? "TEXT").toUpperCase();

  const leadId = String(
    (context.lead as Record<string, unknown> | undefined)?.id ?? "",
  );
  const trackingId = String(
    (context.lead as Record<string, unknown> | undefined)?.trackingId ?? "",
  );

  if (!leadId || !trackingId) {
    return {
      output: { error: "context.lead.id / trackingId obrigatórios" },
      status: "FAILED",
      errorMessage: "lead_or_tracking_missing",
    };
  }

  // ─── BUTTONS branch ───────────────────────────────────────────────
  if (payloadType === "BUTTONS") {
    const { sendButtonsToLead } =
      await import("@/features/tracking-executions/lib/send-buttons-to-lead");
    let bodyText = "";
    let footerText: string | undefined;
    let buttons: Array<{ text: string; id: string; tagId?: string }> = [];

    if (payload.mode === "preset" && typeof payload.presetId === "string") {
      const { default: prisma } = await import("@/lib/prisma");
      const preset = await prisma.aiButtonPreset.findUnique({
        where: { id: payload.presetId },
        select: {
          bodyText: true,
          footerText: true,
          buttons: true,
          isActive: true,
        },
      });
      if (!preset || !preset.isActive) {
        return {
          output: { error: "preset_not_found_or_inactive" },
          status: "FAILED",
          errorMessage: "Preset de botões não encontrado ou inativo",
        };
      }
      bodyText = preset.bodyText ?? "";
      footerText = preset.footerText ?? undefined;
      const raw = preset.buttons as unknown;
      buttons = Array.isArray(raw)
        ? raw
            .filter(
              (b): b is Record<string, unknown> =>
                typeof b === "object" && b !== null,
            )
            .map((b) => ({
              text: typeof b.text === "string" ? b.text : "",
              id: typeof b.id === "string" ? b.id : "",
              tagId: typeof b.tagId === "string" ? b.tagId : undefined,
            }))
            .filter((b) => b.text && b.id)
        : [];
    } else {
      bodyText = String(payload.bodyText ?? "");
      footerText = payload.footerText ? String(payload.footerText) : undefined;
      buttons = Array.isArray(payload.buttons)
        ? (payload.buttons as Array<unknown>)
            .filter(
              (b): b is Record<string, unknown> =>
                typeof b === "object" && b !== null,
            )
            .map((b) => ({
              text: typeof b.text === "string" ? b.text : "",
              id: typeof b.id === "string" ? b.id : "",
              tagId: typeof b.tagId === "string" ? b.tagId : undefined,
            }))
            .filter((b) => b.text && b.id)
        : [];
    }

    bodyText = interpolate(context, bodyText).trim();
    if (footerText) footerText = interpolate(context, footerText);

    if (!bodyText) {
      return {
        output: { error: "menu_body_empty" },
        status: "FAILED",
        errorMessage: "Texto principal do menu vazio",
      };
    }
    if (buttons.length === 0) {
      return {
        output: { error: "menu_no_buttons" },
        status: "FAILED",
        errorMessage: "Menu sem botões válidos",
      };
    }

    if (dryRun) {
      return {
        output: {
          dryRun: true,
          type: "BUTTONS",
          preview: bodyText.slice(0, 200),
          buttons: buttons.map((b) => b.text),
        },
      };
    }

    try {
      const result = await sendButtonsToLead({
        leadId,
        trackingId,
        bodyText,
        footerText,
        buttons,
      });
      return {
        output: {
          sent: true,
          type: "BUTTONS",
          messageId: result.messageId,
          viaInChat: result.viaInChat,
          buttonsCount: buttons.length,
        },
      };
    } catch (err) {
      return {
        output: {
          error: err instanceof Error ? err.message : "send_buttons_failed",
        },
        status: "FAILED",
        errorMessage:
          err instanceof Error ? err.message : "send_buttons_failed",
      };
    }
  }

  // ─── TEXT branch (default) ────────────────────────────────────────
  const rawText = String(payload.message ?? payload.text ?? "");
  const text = interpolate(context, rawText).trim();

  if (!text) {
    return {
      output: { error: "Mensagem vazia depois da interpolação" },
      status: "FAILED",
      errorMessage: "empty_message",
    };
  }

  if (dryRun) {
    return {
      output: {
        dryRun: true,
        preview: text.slice(0, 200),
      },
    };
  }

  try {
    const result = await sendLinkToLead({
      leadId,
      trackingId,
      body: text,
    });
    return {
      output: {
        sent: true,
        messageId: result.messageId,
        viaInChat: result.viaInChat,
        textPreview: text.slice(0, 100),
      },
    };
  } catch (err) {
    return {
      output: { error: err instanceof Error ? err.message : "send_failed" },
      status: "FAILED",
      errorMessage: err instanceof Error ? err.message : "send_failed",
    };
  }
};

// ─── TAG ────────────────────────────────────────────
// Aplica/remove tags em massa no lead atual do contexto.
//
// data: {
//   action: { type: "ADD" | "REMOVE", tagsIds: string[] }
// }
// Aceita tanto data.action.tagsIds (formato unwrap) quanto data.tagsIds (flat).
export const tagExecutor: NodeExecutor = async ({ data, context, dryRun }) => {
  const action =
    (data.action && typeof data.action === "object"
      ? (data.action as Record<string, unknown>)
      : data) ?? {};
  const type = String(action.type ?? "ADD").toUpperCase();
  const rawTagsIds = Array.isArray(action.tagsIds)
    ? (action.tagsIds as string[])
    : [];
  // Filtra placeholders de presets agent-mode (`<<TAG_OPCAO_X_ID>>` e
  // afins) e IDs vazios. Sem isso, o `leadTag.create` abaixo viola FK
  // e o workflow inteiro falha — bug reportado em workflows herdados
  // dos presets do sistema (closer-com-followup, proposta-contrato).
  // Defesa em profundidade: o TagDialog tenta evitar que cheguem aqui,
  // mas workflows antigos podem ter placeholders presos no banco.
  const PLACEHOLDER_RX = /^<<.+>>$/;
  const skippedPlaceholders = rawTagsIds.filter(
    (id) => !id || PLACEHOLDER_RX.test(id),
  );
  const tagsIds = rawTagsIds.filter((id) => id && !PLACEHOLDER_RX.test(id));
  const leadId = String(
    (context.lead as Record<string, unknown> | undefined)?.id ?? "",
  );

  if (!leadId) {
    return {
      output: { error: "context.lead.id obrigatório" },
      status: "FAILED",
      errorMessage: "lead_missing",
    };
  }
  // Se TODAS as tags eram placeholders, não falha — só skip com aviso.
  // Workflow continua pra próximo nó. Status SUCCESS pra não tratar
  // como erro fatal no runtime.
  if (tagsIds.length === 0 && skippedPlaceholders.length > 0) {
    console.warn(
      `[tag-executor] skipping node — all ${skippedPlaceholders.length} tagsIds são placeholders não resolvidos:`,
      skippedPlaceholders,
    );
    return {
      output: {
        skipped: true,
        reason: "all_placeholders",
        placeholders: skippedPlaceholders,
        hint: "Edite o nó TAG no canvas e substitua o(s) placeholder(s) por tags reais.",
      },
    };
  }
  if (tagsIds.length === 0) {
    return {
      output: { error: "tagsIds vazio" },
      status: "FAILED",
      errorMessage: "no_tags",
    };
  }

  if (dryRun) {
    return {
      output: {
        dryRun: true,
        action: type,
        tagsIds,
        ...(skippedPlaceholders.length > 0 && {
          skippedPlaceholders,
          placeholderWarning: `${skippedPlaceholders.length} placeholder(s) seriam ignorado(s) no run real.`,
        }),
      },
    };
  }

  try {
    // Track quais tags REALMENTE foram aplicadas/removidas (não-dup) — só
    // grava na jornada o que mudou, pra não inflar timeline com noise.
    const changedTagIds: string[] = [];

    if (type === "REMOVE") {
      const result = await prisma.leadTag.deleteMany({
        where: { leadId, tagId: { in: tagsIds } },
      });
      // deleteMany retorna count, não os IDs. Assume que removeu todos que
      // existiam — se contar > 0, registra na jornada todas as tagsIds
      // pedidas (acurácia "boa o suficiente" pra timeline).
      if (result.count > 0) changedTagIds.push(...tagsIds);
    } else {
      // ADD — upsert por (leadId, tagId) pra evitar dup. Usa loop porque
      // o composite key não suporta createMany direto. Track quais foram
      // NOVAS (upsert retorna o registro existente em ambos casos — então
      // checamos createdAt vs now pra distinguir).
      for (const tagId of tagsIds) {
        const before = await prisma.leadTag.findUnique({
          where: { leadId_tagId: { leadId, tagId } },
          select: { id: true },
        });
        if (!before) {
          await prisma.leadTag.create({ data: { leadId, tagId } });
          changedTagIds.push(tagId);
        }
      }
    }

    // ── Jornada do lead ─────────────────────────────────────────────
    // Grava LeadJourneyEvent(kind: tag_added | tag_removed) pra que tag
    // aplicada por workflow apareça em "Detalhes do lead → Histórico"
    // igual quando atendente adiciona pela UI. Sem isso, tags do agente
    // sumiam silenciosamente da timeline (visíveis só no leadTags).
    // Best-effort — falha não derruba o workflow.
    if (changedTagIds.length > 0) {
      const { trackLeadEvent } = await import("@/lib/lead-journey/track");
      for (const tagId of changedTagIds) {
        await trackLeadEvent({
          leadId,
          kind: type === "REMOVE" ? "tag_removed" : "tag_added",
          actorId: null, // sistema/workflow — não há atendente humano
          metadata: {
            tagId,
            source: "agent_workflow",
            workflowId: String(context.trigger?.workflowId ?? ""),
          },
        });
      }
    }

    // ── Broadcast pro engine de WAIT_FOR_EVENT acordar ──────────────
    // Workflows com WAIT_FOR_EVENT([lead-tagged, ...]) precisam saber
    // quando tag é aplicada — inclusive pela tag-aplicada-por-outro-
    // workflow. Sem o broadcast, race no WAIT só funcionava pra tag
    // via UI (add-tags) ou IA (apply-tags-by-ai). Best-effort.
    if (
      type === "ADD" &&
      changedTagIds.length > 0 &&
      context.lead &&
      typeof context.lead === "object"
    ) {
      const trackingId = String(
        (context.lead as Record<string, unknown>).trackingId ?? "",
      );
      const orgId = String(context.trigger?.organizationId ?? "");
      if (trackingId) {
        try {
          const { broadcastAgentWorkflowEvent } =
            await import("@/inngest/utils");
          await broadcastAgentWorkflowEvent({
            event: "lead-tagged",
            leadId,
            trackingId,
            organizationId: orgId || undefined,
            extra: { tagIds: changedTagIds },
          });
        } catch (err) {
          console.warn("[tag-executor] broadcast lead-tagged failed", err);
        }
      }
    }

    return {
      output: {
        applied: true,
        action: type,
        tagsIds,
        journeyTracked: changedTagIds.length,
        // Reporta placeholders skipados pro timeline aparecer aviso
        // (UI já trata `output.skippedPlaceholders` em outros nós).
        ...(skippedPlaceholders.length > 0 && {
          skippedPlaceholders,
          placeholderWarning: `${skippedPlaceholders.length} placeholder(s) ignorado(s) — edite o nó pra substituir por tags reais.`,
        }),
      },
    };
  } catch (err) {
    return {
      output: { error: err instanceof Error ? err.message : "tag_failed" },
      status: "FAILED",
      errorMessage: err instanceof Error ? err.message : "tag_failed",
    };
  }
};

// ─── SEND_PROPOSAL (agent-mode wrapper) ───────────────────────────
// Reusa o executor legado de `send-proposal/executor.ts` via fake-step
// adapter — engine agent-mode já roda dentro de step.run do parent,
// então `step.run` aninhado equivale a chamada direta.
//
// IMPORTANTE:
//   1. O legacy executor lê `data.productIds` direto (flat), não
//      `data.action.productIds`. Aqui achatamos pra manter compat.
//   2. O legacy retorna `{...context}` (full Lead com Decimal fields).
//      Prisma JSON field não serializa Decimal → erro
//      "Could not serialize [object Function]". Por isso devolvemos
//      um output enxuto, não a context cheia.
//
// data esperado: { action: { productIds, responsibleId, validityDays?, messageTemplate? } }
export const sendProposalExecutor: NodeExecutor = async ({ data, context }) => {
  const action =
    (data.action && typeof data.action === "object"
      ? (data.action as Record<string, unknown>)
      : data) ?? {};
  try {
    const { sendProposalExecutor: legacy } =
      await import("@/features/tracking-executions/components/send-proposal/executor");
    const fakeStep = {
      run: async <T>(_n: string, fn: () => Promise<T>) => fn(),
    };
    const noopPublish = async () => {};
    await legacy({
      data: action as never, // flat — legacy lê data.productIds direto
      nodeId: "agent",
      context: context as never,
      step: fakeStep as never,
      publish: noopPublish as never,
    });
    return {
      output: {
        sent: true,
        productIds: Array.isArray(action.productIds) ? action.productIds : [],
      },
    };
  } catch (err) {
    return {
      output: {
        error: err instanceof Error ? err.message : "send_proposal_failed",
      },
      status: "FAILED",
      errorMessage: err instanceof Error ? err.message : "send_proposal_failed",
    };
  }
};

// ─── SEND_CONTRACT (agent-mode wrapper) ───────────────────────────
// data esperado: { action: { templateContractId, messageTemplate? } }
// Legacy lê flat (data.templateContractId), por isso achatamos.
export const sendContractExecutor: NodeExecutor = async ({ data, context }) => {
  const action =
    (data.action && typeof data.action === "object"
      ? (data.action as Record<string, unknown>)
      : data) ?? {};
  try {
    const { sendContractExecutor: legacy } =
      await import("@/features/tracking-executions/components/send-contract/executor");
    const fakeStep = {
      run: async <T>(_n: string, fn: () => Promise<T>) => fn(),
    };
    const noopPublish = async () => {};
    await legacy({
      data: action as never,
      nodeId: "agent",
      context: context as never,
      step: fakeStep as never,
      publish: noopPublish as never,
    });
    return {
      output: {
        sent: true,
        templateContractId: action.templateContractId ?? null,
      },
    };
  } catch (err) {
    return {
      output: {
        error: err instanceof Error ? err.message : "send_contract_failed",
      },
      status: "FAILED",
      errorMessage: err instanceof Error ? err.message : "send_contract_failed",
    };
  }
};

// ─── MOVE_LEAD (agent-mode wrapper) ───────────────────────────────
// data esperado: { action: { statusId, trackingId? } }
// Legacy move-lead lê data.action.X (já espera wrap), então passamos
// data como-está, sem achatar.
export const moveLeadExecutor: NodeExecutor = async ({ data, context }) => {
  try {
    const { moveLeadExecutor: legacy } =
      await import("@/features/tracking-executions/components/move-lead/executor");
    const fakeStep = {
      run: async <T>(_n: string, fn: () => Promise<T>) => fn(),
    };
    const noopPublish = async () => {};
    await legacy({
      data: data as never,
      nodeId: "agent",
      context: context as never,
      step: fakeStep as never,
      publish: noopPublish as never,
    });
    const action =
      (data.action && typeof data.action === "object"
        ? (data.action as Record<string, unknown>)
        : data) ?? {};
    return {
      output: { moved: true, statusId: action.statusId ?? null },
    };
  } catch (err) {
    return {
      output: {
        error: err instanceof Error ? err.message : "move_lead_failed",
      },
      status: "FAILED",
      errorMessage: err instanceof Error ? err.message : "move_lead_failed",
    };
  }
};
