import "server-only";

import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import {
  hasGoogleScope,
  type GoogleIntegrationConfig,
} from "@/features/integrations/lib/oauth/resolve-google-access-token";
import type { PaymentInboxItemStatus } from "@/generated/prisma/enums";
import {
  GMAIL_READONLY_SCOPE,
  PAYMENT_INBOX_SYNC_EVENT,
  type PaymentInboxSyncEventData,
} from "./inbox-constants";

// Leituras e comandos da caixa de entrada usados pela procedure oRPC e pelas
// tools do Astro — mesma regra nos dois lados.

const DEFAULT_GMAIL_QUERY = "has:attachment filename:pdf newer_than:7d";

export async function loadInboxOverview(organizationId: string) {
  const [config, integration, statusGroups] = await Promise.all([
    prisma.paymentInboxConfig.findUnique({ where: { organizationId } }),
    prisma.platformIntegration.findFirst({
      where: { organizationId, platform: "GMAIL", isActive: true },
      select: { config: true },
    }),
    prisma.paymentInboxItem.groupBy({
      by: ["status"],
      where: { organizationId },
      _count: { _all: true },
    }),
  ]);

  const integrationConfig = (integration?.config ?? {}) as unknown as GoogleIntegrationConfig;
  const countsByStatus: Record<PaymentInboxItemStatus, number> = {
    NEW: 0,
    PROPOSED: 0,
    ACCEPTED: 0,
    IGNORED: 0,
    FAILED: 0,
  };
  for (const group of statusGroups) countsByStatus[group.status] = group._count._all;

  return {
    config: {
      isEnabled: config?.isEnabled ?? false,
      gmailQuery: config?.gmailQuery ?? DEFAULT_GMAIL_QUERY,
      notifyWhatsapp: config?.notifyWhatsapp ?? false,
      lastSyncAt: config?.lastSyncAt ?? null,
      lastError: config?.lastError ?? null,
    },
    integration: {
      isConnected: Boolean(integration),
      accountEmail: integrationConfig.userEmail ?? null,
      hasGmailScope: hasGoogleScope(integrationConfig.scopes, GMAIL_READONLY_SCOPE),
    },
    countsByStatus,
  };
}

export async function updateInboxConfig(params: {
  organizationId: string;
  patch: { isEnabled?: boolean; gmailQuery?: string; notifyWhatsapp?: boolean };
}) {
  const gmailQuery = params.patch.gmailQuery?.trim();
  const data = {
    ...(params.patch.isEnabled !== undefined ? { isEnabled: params.patch.isEnabled } : {}),
    ...(gmailQuery ? { gmailQuery } : {}),
    ...(params.patch.notifyWhatsapp !== undefined ? { notifyWhatsapp: params.patch.notifyWhatsapp } : {}),
  };
  return prisma.paymentInboxConfig.upsert({
    where: { organizationId: params.organizationId },
    update: data,
    create: { organizationId: params.organizationId, ...data },
  });
}

export async function listInboxItems(params: {
  organizationId: string;
  statuses?: PaymentInboxItemStatus[];
  page: number;
  perPage: number;
}) {
  const where = {
    organizationId: params.organizationId,
    ...(params.statuses && params.statuses.length > 0 ? { status: { in: params.statuses } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.paymentInboxItem.findMany({
      where,
      select: {
        id: true,
        subject: true,
        fromEmail: true,
        fromName: true,
        receivedAt: true,
        status: true,
        extraction: true,
        errorMessage: true,
        attachment: { select: { id: true, fileName: true, kind: true, mimeType: true } },
        entry: { select: { id: true, description: true, type: true } },
      },
      orderBy: { receivedAt: "desc" },
      skip: (params.page - 1) * params.perPage,
      take: params.perPage,
    }),
    prisma.paymentInboxItem.count({ where }),
  ]);
  return { items, total };
}

export type IgnoreInboxItemResult =
  | { ok: true; subject: string }
  | { ok: false; reason: "not_found" | "already_accepted"; message: string };

export async function ignoreInboxItem(params: {
  organizationId: string;
  itemId: string;
}): Promise<IgnoreInboxItemResult> {
  const item = await prisma.paymentInboxItem.findFirst({
    where: { id: params.itemId, organizationId: params.organizationId },
    select: { id: true, status: true, subject: true },
  });
  if (!item) return { ok: false, reason: "not_found", message: "Item da caixa de entrada não encontrado" };
  if (item.status === "ACCEPTED") {
    return { ok: false, reason: "already_accepted", message: "Este documento já virou lançamento" };
  }
  await prisma.paymentInboxItem.update({ where: { id: item.id }, data: { status: "IGNORED" } });
  return { ok: true, subject: item.subject };
}

export type QueueInboxSyncResult = { ok: true } | { ok: false; message: string };

export async function queueInboxSync(params: {
  organizationId: string;
  triggeredByUserId: string;
}): Promise<QueueInboxSyncResult> {
  const overview = await loadInboxOverview(params.organizationId);
  if (!overview.integration.isConnected) {
    return { ok: false, message: "Conecte a integração Google em /integrations antes de sincronizar." };
  }
  if (!overview.integration.hasGmailScope) {
    return { ok: false, message: "A integração Google não tem permissão de leitura do Gmail. Reconecte em /integrations." };
  }
  // A ativação é o opt-in de cobrança (5★ por documento lido).
  if (!overview.config.isEnabled) {
    return { ok: false, message: "Ative a caixa de entrada do financeiro antes de sincronizar (cada documento lido custa 5★)." };
  }

  const eventData: PaymentInboxSyncEventData = {
    organizationId: params.organizationId,
    triggeredByUserId: params.triggeredByUserId,
  };
  await inngest.send({ name: PAYMENT_INBOX_SYNC_EVENT, data: eventData });
  return { ok: true };
}

/** Quem "lê" o documento no sync automático: o owner da empresa. */
export async function resolveInboxActorUserId(params: {
  organizationId: string;
  triggeredByUserId?: string;
}): Promise<string | null> {
  if (params.triggeredByUserId) return params.triggeredByUserId;
  const owner = await prisma.member.findFirst({
    where: { organizationId: params.organizationId, role: "owner" },
    select: { userId: true },
    orderBy: { createdAt: "asc" },
  });
  return owner?.userId ?? null;
}
