/**
 * Pipeline canônica de persistência inbound — Fase 3.
 *
 * Esta é a porta de entrada **única** pra qualquer mensagem inbound de
 * WhatsApp na NASA, independente de provider (Uazapi, Meta Cloud, futura
 * terceira API). Os adapters normalizam o payload do webhook pro shape
 * canônico (`CanonicalInboundMessage`) e chamam esta função.
 *
 * O que ela faz (extraído do `route.ts` pré-Fase 3, 1298 linhas):
 *
 *  1. Revoke (mensagem apagada): atualiza Message → DELETED + Pusher.
 *  2. Lead lookup por (phone, trackingId) — cria se não existe, incluindo:
 *     - avatar via strategy provider-specific (`fetchProfilePicture`)
 *     - CTWA (Click-To-WhatsApp Ads) via `resolveReferralForOrg` quando
 *       `ctwaSources` é fornecido
 *     - statusFlow=WAITING + primeiro Status do funil
 *     - assignLeadRoundRobin (best-effort)
 *     - Workflow NEW_LEAD POST `/api/workflows/lead/new`
 *     - logActivity "lead.arrived"
 *  3. Conversation: garante criação se não existe; reativa lead se
 *     `statusFlow=FINISHED` e mensagem é inbound (não-fromMe).
 *  4. Quoted/Edited message lookup por `messageId`.
 *  5. Per-type upsert: `text` | `media` | `location` | `contact` |
 *     `interactive_reply`. (`reaction` / `unsupported` são skip silencioso.)
 *  6. Agent IA dispatch (`dispatchMessageIncoming`) — texto OU mídia.
 *  7. `firePostInboundAutomations` (timestamps, trackLeadEvent, alert
 *     engine, Inngest IA, idle automation, Pusher).
 *
 * Provider-specific I/O é injetado via **strategies** (callbacks):
 *  - `fetchProfilePicture(sender)` — Uazapi usa `/chat/details`; Meta usa
 *    o Cloud Graph API ou pula (Meta entrega o nome no webhook).
 *  - `downloadInboundMedia(media)` — Uazapi usa `/message/download`; Meta
 *    usa `downloadInboundMedia` do `src/http/whats-oficial`.
 *  - `ctwaSources` — qualquer coisa que `resolveReferralForOrg` saiba
 *    examinar pra extrair `referral` (Uazapi: `[json.message, json]`;
 *    Meta: o payload de webhook completo).
 *
 * Princípio: o pipeline NUNCA conhece o provider. Tudo provider-specific
 * é injetado. Isso é o que permite Fase 5 (webhook oficial Meta) e Fase 6
 * (router/message via factory) sem refator deste módulo.
 */
import "server-only";

import { LeadSource } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import {
  captureMetaReferralForNewLead,
  ctwaToLeadData,
  resolveReferralForOrg,
} from "@/lib/lead-journey/ctwa";
import prisma from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { assignLeadRoundRobin } from "@/http/rodizio/create-lead";
import { logActivity } from "@/features/admin/lib/activity-logger";

import { MessageStatus } from "../../types";
import { getCachedTrackingContext } from "../get-cached-tracking-context";
import { firePostInboundAutomations } from "../incoming-message-pipeline";
import type {
  CanonicalInboundContact,
  CanonicalInboundInteractiveReply,
  CanonicalInboundLocation,
  CanonicalInboundMedia,
  CanonicalInboundMessage,
  CanonicalInboundRevoke,
  CanonicalInboundSender,
  CanonicalInboundText,
  ProviderId,
} from "../providers/types";

const FETCH_TIMEOUT_MS = 10_000;

// ────────────────────────────────────────────────────────────────────────────
// Strategy types — injetados pelo caller (provider-specific)
// ────────────────────────────────────────────────────────────────────────────

export interface ProfilePictureUpload {
  /** Key do objeto no S3/R2 (o que vai em `Lead.profile`). */
  readonly key: string;
  readonly mimetype: string;
}

export interface InboundMediaUpload {
  /** Key do objeto no S3/R2 (o que vai em `Message.mediaUrl`). */
  readonly key: string;
  readonly mimetype: string;
  readonly fileName?: string | null;
}

export type FetchProfilePicture = (
  sender: CanonicalInboundSender,
) => Promise<ProfilePictureUpload | null>;

export type DownloadInboundMedia = (
  canonical: CanonicalInboundMedia,
) => Promise<InboundMediaUpload | null>;

export interface PersistCanonicalInboundContext {
  /** Tracking dono do número que recebeu o webhook. */
  readonly trackingId: string;
  /** Identificador do provider — usado pra logs e telemetria. */
  readonly providerId: ProviderId;
  /** Strategy: baixa avatar quando um Lead novo é criado. */
  readonly fetchProfilePicture?: FetchProfilePicture;
  /** Strategy: baixa binário de mídia inbound e sobe pro S3/R2. */
  readonly downloadInboundMedia?: DownloadInboundMedia;
  /**
   * Fontes extras passadas pra `resolveReferralForOrg` na detecção de CTWA
   * (Click-To-WhatsApp Ads). Uazapi: `[json.message, json]`. Meta: o
   * payload de webhook completo. Sem isso, CTWA não é tentado.
   */
  readonly ctwaSources?: ReadonlyArray<unknown>;
  /**
   * Channel pro `firePostInboundAutomations`. Default `"WHATSAPP"` —
   * Uazapi e Meta Cloud caem aqui. In-Chat usa `"IN_CHAT"`.
   */
  readonly channel?: "WHATSAPP" | "IN_CHAT" | "INSTAGRAM" | "FACEBOOK";
}

export type PersistCanonicalInboundResult =
  | { readonly ok: true; readonly messageId: string }
  | { readonly ok: true; readonly skipped: string }
  | { readonly ok: false; readonly reason: string };

// ════════════════════════════════════════════════════════════════════════════
// Entry point
// ════════════════════════════════════════════════════════════════════════════

export async function persistCanonicalInbound(
  canonical: CanonicalInboundMessage,
  ctx: PersistCanonicalInboundContext,
): Promise<PersistCanonicalInboundResult> {
  // ── 0. Tracking context (cached) ────────────────────────────────────────
  const tracking = await getCachedTrackingContext(ctx.trackingId);
  if (!tracking) {
    return { ok: false, reason: "tracking_not_found" };
  }

  // ── 1. Revoke — atualização in-place de mensagem existente ──────────────
  if (canonical.type === "revoke") {
    return persistRevoke(canonical);
  }

  // ── 2. Skip silencioso pra tipos sem persistência hoje ──────────────────
  if (canonical.type === "reaction") {
    return { ok: true, skipped: "reaction" };
  }
  if (canonical.type === "unsupported") {
    return { ok: true, skipped: `unsupported:${canonical.providerType ?? "unknown"}` };
  }

  // ── 3. Lead lookup ou criação ───────────────────────────────────────────
  const phone = canonical.sender.phone;
  let lead = await prisma.lead.findUnique({
    where: { phone_trackingId: { phone, trackingId: ctx.trackingId } },
    include: {
      conversation: true,
      leadTags: { include: { tag: true } },
    },
  });

  const remoteJid = phone.includes("@") ? phone : `${phone}@s.whatsapp.net`;
  const channel = ctx.channel ?? "WHATSAPP";

  if (!lead) {
    lead = await createLeadFromInbound(canonical, ctx, {
      remoteJid,
      organizationId: tracking.organizationId,
    });
    if (!lead) {
      return { ok: false, reason: "lead_creation_failed" };
    }
  } else {
    // Lead existe — garante Conversation + reativa statusFlow se preciso.
    if (!lead.conversation) {
      await prisma.conversation.create({
        data: {
          remoteJid,
          trackingId: ctx.trackingId,
          isActive: true,
          leadId: lead.id,
        },
      });
      // Reload pra ter conversation no `lead.conversation` daqui pra
      // frente — firePostInboundAutomations precisa do id.
      lead = await prisma.lead.findUnique({
        where: { phone_trackingId: { phone, trackingId: ctx.trackingId } },
        include: {
          conversation: true,
          leadTags: { include: { tag: true } },
        },
      });
      if (!lead) {
        return { ok: false, reason: "lead_reload_failed" };
      }
    }

    if (!canonical.sender.fromMe && lead.statusFlow === "FINISHED") {
      lead = await prisma.lead.update({
        where: { id: lead.id },
        data: { statusFlow: "ACTIVE" },
        include: {
          conversation: true,
          leadTags: { include: { tag: true } },
        },
      });
    }
  }

  if (!lead.conversation) {
    return { ok: false, reason: "conversation_missing" };
  }

  // ── 4. Quoted / Edited lookups ──────────────────────────────────────────
  const quotedMessageId = canonical.replyToExternalMessageId;
  const quotedMessageData = quotedMessageId
    ? await prisma.message.findUnique({ where: { messageId: quotedMessageId } })
    : null;

  const editedExternalMessageId = canonical.editedExternalMessageId;
  const editedMessageData = editedExternalMessageId
    ? await prisma.message.findUnique({
        where: { messageId: editedExternalMessageId },
        select: { id: true, body: true, messageId: true },
      })
    : null;

  // ── 5. Persistência por tipo ────────────────────────────────────────────
  const persistParams: PersistMessageParams = {
    canonical,
    ctx,
    lead: {
      id: lead.id,
      conversationId: lead.conversation.id,
    },
    quotedMessageInternalId: quotedMessageData?.id ?? null,
    editedMessageInternalId: editedMessageData?.id ?? null,
    editedTargetMessageId: editedMessageData?.messageId ?? null,
    editedExistingBody: editedMessageData?.body ?? null,
  };

  let messageData:
    | Awaited<ReturnType<typeof persistText>>
    | null = null;

  switch (canonical.type) {
    case "text":
      messageData = await persistText(persistParams, canonical);
      break;
    case "media":
      messageData = await persistMedia(persistParams, canonical);
      break;
    case "location":
      messageData = await persistLocation(persistParams, canonical);
      break;
    case "contact":
      messageData = await persistContact(persistParams, canonical);
      break;
    case "interactive_reply":
      messageData = await persistInteractive(persistParams, canonical);
      break;
  }

  if (!messageData) {
    return { ok: true, skipped: `not_persisted:${canonical.type}` };
  }

  // ── 6. Agent IA dispatch (texto OU mídia) ───────────────────────────────
  await dispatchAgentMessageIncoming({
    canonical,
    ctx,
    lead: { id: lead.id, organizationId: tracking.organizationId },
    messageData,
  });

  // ── 7. firePostInboundAutomations ───────────────────────────────────────
  await firePostInboundAutomations({
    trackingId: ctx.trackingId,
    organizationId: tracking.organizationId,
    globalAiActive: tracking.globalAiActive,
    lead: {
      id: lead.id,
      isActive: lead.isActive,
      firstResponseAt: lead.firstResponseAt,
      lastInboundAt: lead.lastInboundAt,
      conversation: { id: lead.conversation.id },
    },
    messageId: messageData.id,
    externalMessageId: canonical.externalMessageId,
    fromMe: canonical.sender.fromMe,
    channel,
    messagePayload: messageData,
    conversationPayload: { ...lead.conversation, lead },
  });

  return { ok: true, messageId: messageData.id };
}

// ════════════════════════════════════════════════════════════════════════════
// Revoke
// ════════════════════════════════════════════════════════════════════════════

async function persistRevoke(
  canonical: CanonicalInboundRevoke,
): Promise<PersistCanonicalInboundResult> {
  try {
    const updated = await prisma.message.update({
      where: { messageId: canonical.targetExternalMessageId },
      data: {
        status: MessageStatus.DELETED,
        body: null,
        mediaUrl: null,
        mediaType: null,
        mediaCaption: null,
        mimetype: null,
        fileName: null,
      },
      select: { id: true, conversationId: true },
    });
    await pusherServer.trigger(updated.conversationId, "message:updated", {
      messageId: updated.id,
      conversationId: updated.conversationId,
      status: MessageStatus.DELETED,
    });
    return { ok: true, skipped: "revoke" };
  } catch {
    // Mensagem revogada pode não estar no nosso banco (foi enviada antes
    // da conversa ser importada) — não polui o log.
    return { ok: true, skipped: "revoke_target_missing" };
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Lead creation (Uazapi-equivalent fluxo)
// ════════════════════════════════════════════════════════════════════════════

interface CreateLeadEnv {
  readonly remoteJid: string;
  readonly organizationId: string;
}

async function createLeadFromInbound(
  canonical: CanonicalInboundMessage,
  ctx: PersistCanonicalInboundContext,
  env: CreateLeadEnv,
): Promise<Awaited<ReturnType<typeof loadLeadWithIncludes>>> {
  const phone = canonical.sender.phone;
  const leadName = canonical.sender.displayName?.trim() || "Sem nome";

  // ── Avatar via strategy (best-effort) ───────────────────────────────────
  let profileKey: string | null = null;
  if (ctx.fetchProfilePicture) {
    try {
      const upload = await ctx.fetchProfilePicture(canonical.sender);
      profileKey = upload?.key ?? null;
    } catch (err) {
      console.error("[persist-canonical-inbound] fetchProfilePicture_failed", err);
    }
  }

  // ── Primeiro status do funil + ordem do topo ────────────────────────────
  const status = await prisma.status.findFirst({
    where: { trackingId: ctx.trackingId },
    select: { id: true },
    orderBy: { order: "asc" },
  });
  if (!status) return null;

  const firstLead = await prisma.lead.findFirst({
    where: { statusId: status.id },
    select: { order: true },
    orderBy: { order: "asc" },
  });

  // ── CTWA — só quando o caller passa sources de referral ─────────────────
  const ctwa = ctx.ctwaSources
    ? await resolveReferralForOrg(env.organizationId, ...ctx.ctwaSources)
    : null;

  const createdLead = await prisma.lead.create({
    data: {
      name: leadName,
      statusId: status.id,
      phone,
      trackingId: ctx.trackingId,
      source: LeadSource.WHATSAPP,
      profile: profileKey,
      order: firstLead ? Number(firstLead.order) - 1 : 0,
      statusFlow: "WAITING",
      lastInboundAt: new Date(),
      ...(ctwa ? ctwaToLeadData(ctwa.ref, ctwa.resolved) : {}),
      conversation: {
        create: {
          remoteJid: env.remoteJid,
          trackingId: ctx.trackingId,
          isActive: true,
        },
      },
    },
    include: {
      conversation: true,
      leadTags: { include: { tag: true } },
    },
  });

  // ── CTWA timeline event (best-effort) ───────────────────────────────────
  if (ctwa) {
    try {
      await captureMetaReferralForNewLead(
        createdLead.id,
        ctwa.ref,
        ctwa.resolved,
        "WHATSAPP",
      );
    } catch (err) {
      console.error("[persist-canonical-inbound] ctwa_capture_failed", err);
    }
  }

  // ── logActivity "lead.arrived" (best-effort) ────────────────────────────
  // Fetch direto do nome — o cache (`getCachedTrackingContext`) não traz
  // `name` no select por economia. Best-effort: falha aqui não impede o
  // restante do pipeline.
  try {
    const trackingForLog = await prisma.tracking.findUnique({
      where: { id: ctx.trackingId },
      select: { name: true },
    });
    if (trackingForLog) {
      await logActivity({
        organizationId: env.organizationId,
        userId: "system",
        userName: "Sistema",
        userEmail: "sistema@nasa",
        appSlug: "tracking",
        action: "lead.arrived",
        actionLabel: `Um lead chegou no tracking "${trackingForLog.name}" via WhatsApp (${createdLead.name ?? phone})`,
        resource: createdLead.name ?? phone,
        resourceId: createdLead.id,
        metadata: {
          phone,
          trackingName: trackingForLog.name,
          source: "WHATSAPP",
        },
      });
    }
  } catch {}

  // ── Round-robin (best-effort) ───────────────────────────────────────────
  try {
    await prisma.$transaction((tx) => assignLeadRoundRobin(tx, createdLead.id));
  } catch (err) {
    console.error("[persist-canonical-inbound] round_robin_failed", err);
  }

  // ── Workflow NEW_LEAD (best-effort, timeout) ────────────────────────────
  try {
    await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/workflows/lead/new?trackingId=${ctx.trackingId}&leadId=${createdLead.id}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingId: ctx.trackingId }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      },
    );
  } catch (err) {
    console.error("[persist-canonical-inbound] workflow_lead_new_failed", err);
  }

  return createdLead;
}

async function loadLeadWithIncludes(args: { phone: string; trackingId: string }) {
  return prisma.lead.findUnique({
    where: { phone_trackingId: args },
    include: {
      conversation: true,
      leadTags: { include: { tag: true } },
    },
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Persistência por tipo (text / media / location / contact / interactive)
// ════════════════════════════════════════════════════════════════════════════

interface PersistMessageParams {
  readonly canonical: CanonicalInboundMessage;
  readonly ctx: PersistCanonicalInboundContext;
  readonly lead: { readonly id: string; readonly conversationId: string };
  readonly quotedMessageInternalId: string | null;
  readonly editedMessageInternalId: string | null;
  /** `messageId` (externo) da mensagem editada — usado como chave do upsert. */
  readonly editedTargetMessageId: string | null;
  /** Body anterior, pra preservar quando o webhook não envia novo. */
  readonly editedExistingBody: string | null;
}

function baseCreate(params: PersistMessageParams) {
  const { canonical } = params;
  const senderId = canonical.sender.fromMe
    ? (canonical.instance.ownerExternalId ?? null)
    : canonical.sender.phone;
  // Paridade com o route.ts pré-Fase 3: senderName tinha fallback final
  // "Sem nome". UI renderiza diretamente esse valor.
  const senderName = canonical.sender.displayName?.trim() || "Sem nome";
  return {
    fromMe: canonical.sender.fromMe,
    conversationId: params.lead.conversationId,
    senderId,
    senderName,
    messageId: canonical.externalMessageId,
    quotedMessageId: params.quotedMessageInternalId ?? undefined,
    status: MessageStatus.SEEN,
    createdAt: canonical.sentAt,
  } as const;
}

const messageInclude = {
  quotedMessage: true,
  conversation: { include: { lead: true } },
} satisfies Prisma.MessageInclude;

async function persistText(
  params: PersistMessageParams,
  canonical: CanonicalInboundText,
) {
  const upsertKey = params.editedTargetMessageId ?? canonical.externalMessageId;
  const body = canonical.body || params.editedExistingBody || "";
  return prisma.message.upsert({
    where: { messageId: upsertKey },
    update: {
      status: MessageStatus.SEEN,
      body: canonical.body || params.editedExistingBody,
      createdAt: canonical.sentAt,
    },
    create: {
      ...baseCreate(params),
      body,
    },
    include: messageInclude,
  });
}

async function persistInteractive(
  params: PersistMessageParams,
  canonical: CanonicalInboundInteractiveReply,
) {
  const upsertKey = params.editedTargetMessageId ?? canonical.externalMessageId;
  const body = canonical.replyText ?? "";
  return prisma.message.upsert({
    where: { messageId: upsertKey },
    update: {
      status: MessageStatus.SEEN,
      body: body || params.editedExistingBody,
      createdAt: canonical.sentAt,
    },
    create: {
      ...baseCreate(params),
      body,
    },
    include: messageInclude,
  });
}

async function persistMedia(
  params: PersistMessageParams,
  canonical: CanonicalInboundMedia,
) {
  // Baixa o binário (se houver strategy) e sobe pro S3/R2. Ausência da
  // strategy ou falha de download → persiste sem `mediaUrl` (a Message
  // ainda guarda contexto: messageId, mimetype, caption — pra debug).
  // Skip download quando estamos no caminho de edit (já baixamos antes).
  let upload: InboundMediaUpload | null = null;
  if (params.ctx.downloadInboundMedia && !params.editedMessageInternalId) {
    try {
      upload = await params.ctx.downloadInboundMedia(canonical);
    } catch (err) {
      console.error("[persist-canonical-inbound] download_media_failed", err);
    }
  }

  const upsertKey = params.editedTargetMessageId ?? canonical.externalMessageId;
  const body = canonical.caption || params.editedExistingBody || "";

  if (canonical.kind === "sticker") {
    // Pré-Fase 5 era `prisma.message.create` em paridade com o route.ts
    // antigo (Uazapi não retenta webhooks, então duplicata era
    // improvável). Fase 5 ativou Meta no caminho, e a Meta REENTREGA
    // agressivamente em qualquer 5xx — sem upsert, sticker reentregue
    // duplicaria na conversa. Trocamos por `upsert` idempotente (mesmo
    // padrão de áudio: `update: {}` deixa intacto em re-entrega).
    return prisma.message.upsert({
      where: { messageId: upsertKey },
      update: {},
      create: {
        ...baseCreate(params),
        mediaUrl: upload?.key ?? null,
        mimetype: upload?.mimetype ?? canonical.mimetype ?? null,
      },
      include: messageInclude,
    });
  }

  // Áudio era idempotente no route.ts antigo (`update: {}`) — re-entrega
  // do webhook não mexia em `status`/`body`/`createdAt`. Preservamos esse
  // comportamento; pra image/document, o update SEEN+body+createdAt já
  // era o padrão.
  const updateData: Prisma.MessageUpdateInput =
    canonical.kind === "audio"
      ? {}
      : {
          status: MessageStatus.SEEN,
          body: canonical.caption || params.editedExistingBody,
          createdAt: canonical.sentAt,
        };

  return prisma.message.upsert({
    where: { messageId: upsertKey },
    update: updateData,
    create: {
      ...baseCreate(params),
      body,
      mediaUrl: upload?.key ?? null,
      mimetype: upload?.mimetype ?? canonical.mimetype ?? null,
      fileName: upload?.fileName ?? canonical.fileName ?? null,
    },
    include: messageInclude,
  });
}

async function persistLocation(
  params: PersistMessageParams,
  canonical: CanonicalInboundLocation,
) {
  const upsertKey = canonical.externalMessageId;
  const body =
    [canonical.name, canonical.address].filter(Boolean).join(" — ") || null;
  return prisma.message.upsert({
    where: { messageId: upsertKey },
    update: {
      status: MessageStatus.SEEN,
      latitude: canonical.latitude,
      longitude: canonical.longitude,
      createdAt: canonical.sentAt,
    },
    create: {
      ...baseCreate(params),
      body,
      latitude: canonical.latitude,
      longitude: canonical.longitude,
      mediaType: "location",
    },
    include: messageInclude,
  });
}

async function persistContact(
  params: PersistMessageParams,
  canonical: CanonicalInboundContact,
) {
  if (!canonical.contactName && !canonical.contactPhone) return null;
  const upsertKey = canonical.externalMessageId;
  return prisma.message.upsert({
    where: { messageId: upsertKey },
    update: {
      status: MessageStatus.SEEN,
      body: canonical.contactName || null,
      fileName: canonical.contactPhone || null,
      createdAt: canonical.sentAt,
    },
    create: {
      ...baseCreate(params),
      body: canonical.contactName || null,
      fileName: canonical.contactPhone || null,
      mediaType: "contact",
    },
    include: messageInclude,
  });
}

// ════════════════════════════════════════════════════════════════════════════
// Agent IA dispatch (best-effort)
// ════════════════════════════════════════════════════════════════════════════

interface DispatchArgs {
  readonly canonical: CanonicalInboundMessage;
  readonly ctx: PersistCanonicalInboundContext;
  readonly lead: { readonly id: string; readonly organizationId: string };
  readonly messageData: { readonly body: string | null; readonly mediaUrl: string | null; readonly mimetype: string | null; readonly fileName: string | null };
}

async function dispatchAgentMessageIncoming(args: DispatchArgs): Promise<void> {
  if (args.canonical.sender.fromMe) return;

  const mediaUrlKey = args.messageData.mediaUrl;
  const mimetype = args.messageData.mimetype;
  const fileName = args.messageData.fileName;
  const messageBody = args.messageData.body ?? "";

  if (!messageBody && !mediaUrlKey) return;

  let presignedUrl: string | undefined;
  if (mediaUrlKey) {
    try {
      const { getPresignedReadUrl } = await import("@/lib/r2-url");
      presignedUrl = await getPresignedReadUrl(mediaUrlKey, 3600);
    } catch (err) {
      console.warn(
        "[persist-canonical-inbound] presigned_url_failed",
        err,
      );
    }
  }

  let mediaType: "image" | "document" | "audio" | "video" | undefined;
  if (mimetype) {
    if (mimetype.startsWith("image/")) mediaType = "image";
    else if (mimetype.startsWith("video/")) mediaType = "video";
    else if (mimetype.startsWith("audio/")) mediaType = "audio";
    else if (mimetype === "application/pdf") mediaType = "document";
    else mediaType = "document";
  }

  try {
    const { dispatchMessageIncoming } = await import(
      "@/features/workflows/lib/agent-trigger-helpers"
    );
    void dispatchMessageIncoming({
      leadId: args.lead.id,
      organizationId: args.lead.organizationId,
      trackingId: args.ctx.trackingId,
      messageText: messageBody,
      messageId: args.canonical.externalMessageId,
      ...(presignedUrl ? { mediaUrl: presignedUrl } : {}),
      ...(mediaType ? { mediaType } : {}),
      ...(mimetype ? { mimetype } : {}),
      ...(fileName ? { fileName } : {}),
    });
  } catch (err) {
    console.error("[persist-canonical-inbound] agent_dispatch_failed", err);
  }
}
