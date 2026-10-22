import "server-only";
import prisma from "@/lib/prisma";
import { LeadSource } from "@/generated/prisma/enums";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { assignLeadRoundRobin } from "@/http/rodizio/create-lead";
import type { PublicSite, PublicVisitor } from "./public-api";

/**
 * Lead anônimo do visitante do ASTRO CHAT (spec 0031, RF-5). Nasce na primeira
 * mensagem, no tracking/status do site, com conversa própria marcada pela origem.
 */

const WORKFLOW_TIMEOUT_MS = 10_000;

export type VisitorConversation = {
  leadId: string;
  conversationId: string;
  trackingId: string;
  isNew: boolean;
  /** Só no lead recém-criado: log, rodízio e workflow NEW_LEAD, para rodar após a resposta. */
  runNewLeadSideEffects?: () => Promise<void>;
};

class VisitorAlreadyLinkedError extends Error {}

export function buildVisitorRemoteJid(visitorId: string): string {
  return `astrochat:${visitorId}`;
}

function buildAnonymousName(visitorId: string): string {
  return `Visitante do site #${visitorId.slice(-4).toUpperCase()}`;
}

async function resolveTargetStatusId(site: PublicSite, trackingId: string): Promise<string | null> {
  if (site.statusId) {
    const configured = await prisma.status.findFirst({
      where: { id: site.statusId, trackingId },
      select: { id: true },
    });
    if (configured) return configured.id;
  }
  const firstStatus = await prisma.status.findFirst({
    where: { trackingId },
    orderBy: { order: "asc" },
    select: { id: true },
  });
  return firstStatus?.id ?? null;
}

async function loadLinkedConversation(leadId: string): Promise<VisitorConversation | null> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, trackingId: true, conversation: { select: { id: true } } },
  });
  if (!lead?.conversation) return null;
  return {
    leadId: lead.id,
    conversationId: lead.conversation.id,
    trackingId: lead.trackingId,
    isNew: false,
  };
}

export async function ensureVisitorConversation(params: {
  site: PublicSite;
  visitor: PublicVisitor;
  appOrigin: string;
}): Promise<VisitorConversation | null> {
  const { site, visitor } = params;
  if (visitor.leadId) {
    const linked = await loadLinkedConversation(visitor.leadId);
    if (linked) return linked;
  }

  const trackingId = site.trackingId;
  if (!trackingId) return null;
  const statusId = await resolveTargetStatusId(site, trackingId);
  if (!statusId) return null;

  const topLead = await prisma.lead.findFirst({
    where: { statusId },
    orderBy: { order: "asc" },
    select: { order: true },
  });

  let created: { id: string; name: string; conversationId: string };
  try {
    created = await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.create({
        data: {
          name: buildAnonymousName(visitor.id),
          statusId,
          trackingId,
          source: LeadSource.ASTRO_CHAT,
          order: topLead ? Number(topLead.order) - 1 : 0,
          statusFlow: "WAITING",
          conversation: {
            create: {
              remoteJid: buildVisitorRemoteJid(visitor.id),
              trackingId,
              isActive: true,
              name: "ASTRO CHAT",
            },
          },
        },
        select: { id: true, name: true, conversation: { select: { id: true } } },
      });
      const linked = await tx.astroChatVisitor.updateMany({
        where: { id: visitor.id, leadId: null },
        data: { leadId: lead.id },
      });
      // Outra mensagem simultânea já criou o lead: desfaz esta criação.
      if (linked.count === 0) throw new VisitorAlreadyLinkedError();
      return { id: lead.id, name: lead.name, conversationId: lead.conversation!.id };
    });
  } catch (error) {
    if (error instanceof VisitorAlreadyLinkedError) {
      const current = await prisma.astroChatVisitor.findUnique({
        where: { id: visitor.id },
        select: { leadId: true },
      });
      return current?.leadId ? loadLinkedConversation(current.leadId) : null;
    }
    throw error;
  }

  return {
    leadId: created.id,
    conversationId: created.conversationId,
    trackingId,
    isNew: true,
    runNewLeadSideEffects: () =>
      runNewLeadSideEffects({
        organizationId: site.organizationId,
        trackingId,
        leadId: created.id,
        leadName: created.name,
        siteName: site.name,
        appOrigin: params.appOrigin,
      }),
  };
}

async function runNewLeadSideEffects(params: {
  organizationId: string;
  trackingId: string;
  leadId: string;
  leadName: string;
  siteName: string;
  appOrigin: string;
}): Promise<void> {
  await logActivity({
    organizationId: params.organizationId,
    userId: "system",
    userName: "ASTRO",
    userEmail: "sistema@nasa",
    appSlug: "tracking",
    action: "lead.arrived",
    actionLabel: `Um visitante do site "${params.siteName}" começou a conversar com o ASTRO CHAT`,
    resource: params.leadName,
    resourceId: params.leadId,
    metadata: { source: "ASTRO_CHAT", siteName: params.siteName },
  }).catch((error: unknown) => console.error("[astro-chat] log_activity_failed", error));

  try {
    await prisma.$transaction((tx) => assignLeadRoundRobin(tx, params.leadId));
  } catch (error) {
    console.error("[astro-chat] round_robin_failed", error);
  }

  try {
    await fetch(
      `${params.appOrigin}/api/workflows/lead/new?trackingId=${params.trackingId}&leadId=${params.leadId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingId: params.trackingId }),
        signal: AbortSignal.timeout(WORKFLOW_TIMEOUT_MS),
      },
    );
  } catch (error) {
    console.error("[astro-chat] workflow_new_lead_failed", error);
  }
}
