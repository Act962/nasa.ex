import "server-only";
import { ORPCError } from "@orpc/server";
import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { WhatsAppProvider, type WhatsAppTemplateCategory } from "@/generated/prisma/enums";
import { normalizePhone } from "@/utils/format-phone";
import { getMessageTemplates } from "@/http/whats-oficial";
import { buildLeadAudienceWhere } from "@/features/campanhas/lib/audience-query";
import { findTemplateMappingProblems } from "@/features/campanhas/lib/template-variables";
import { assertMetaCloudTracking, resolveCampaignMetaCredentials } from "@/features/campanhas/server/lib/broadcast-access";
import { assertBroadcastSendable } from "@/features/campanhas/server/lib/assert-broadcast-sendable";
import { assertBroadcastFeePaid } from "@/features/campanhas/server/lib/broadcast-fee-service";
import type { AudienceFilter, BroadcastTemplateParam } from "@/features/campanhas/schema/broadcast-schemas";

/**
 * Disparo de WhatsApp programado pelo Planner (spec 0060): mesmas regras das Campanhas,
 * mas na org do cliente escolhido — não na org ativa da sessão.
 */

export async function listOfficialSendingNumbers(organizationIds: string[]) {
  if (organizationIds.length === 0) return [];
  const instances = await prisma.whatsAppInstance.findMany({
    where: { organizationId: { in: organizationIds }, provider: WhatsAppProvider.META_CLOUD },
    select: { organizationId: true, trackingId: true, phoneNumber: true, profileName: true, status: true, tracking: { select: { name: true } } },
  });
  return instances.map((instance) => ({
    organizationId: instance.organizationId,
    trackingId: instance.trackingId,
    trackingName: instance.tracking?.name ?? "",
    phoneNumber: instance.phoneNumber,
    profileName: instance.profileName,
    status: instance.status,
  }));
}

function countBodyVariables(bodyText: string) {
  const placeholders = bodyText.match(/\{\{\s*\d+\s*\}\}/g);
  return placeholders ? new Set(placeholders).size : 0;
}

/** Só modelos aprovados de marketing e utilidade: são os que dá para disparar. */
export async function listApprovedTemplates(organizationId: string, trackingId: string) {
  const credentials = await resolveCampaignMetaCredentials(trackingId, organizationId);
  const response = await getMessageTemplates(credentials.accessToken, credentials.wabaId);
  return response.data
    .filter((template) => template.status === "APPROVED" && (template.category === "MARKETING" || template.category === "UTILITY"))
    .map((template) => {
      const bodyText = template.components.find((component) => component.type === "BODY")?.text ?? "";
      return {
        name: template.name,
        language: template.language,
        category: template.category as "MARKETING" | "UTILITY",
        bodyText,
        variableCount: countBodyVariables(bodyText),
      };
    });
}

export interface ScheduledBroadcastInput {
  organizationId: string;
  userId: string;
  trackingId: string;
  name: string;
  templateName: string;
  templateLanguage: string;
  templateCategory: "MARKETING" | "UTILITY";
  templateVariableCount: number;
  bodyParams: BroadcastTemplateParam[];
  audienceFilters: AudienceFilter;
  scheduledAt: Date;
}

export async function createScheduledBroadcast(input: ScheduledBroadcastInput) {
  if (input.scheduledAt.getTime() <= Date.now()) {
    throw new ORPCError("BAD_REQUEST", { message: "Escolha uma data e hora futura para o disparo." });
  }
  await assertMetaCloudTracking(input.trackingId, input.organizationId);
  const mappingProblems = findTemplateMappingProblems(input.bodyParams, input.templateVariableCount);
  if (mappingProblems.length > 0) throw new ORPCError("BAD_REQUEST", { message: mappingProblems[0] });

  // Público primeiro: sem destinatário, nenhuma campanha é criada (spec 0060, CA-4).
  const leads = await prisma.lead.findMany({
    where: buildLeadAudienceWhere(input.trackingId, input.audienceFilters),
    select: { id: true, name: true, phone: true },
  });
  const seenPhones = new Set<string>();
  const recipientRows = leads.flatMap((lead) => {
    const phone = normalizePhone(lead.phone ?? "");
    if (!phone || seenPhones.has(phone)) return [];
    seenPhones.add(phone);
    return [{ leadId: lead.id, name: lead.name, phone }];
  });
  if (recipientRows.length === 0) {
    throw new ORPCError("BAD_REQUEST", { message: "Nenhum contato com telefone nesse público. Ajuste os filtros." });
  }

  const broadcast = await prisma.broadcast.create({
    data: {
      name: input.name,
      trackingId: input.trackingId,
      organizationId: input.organizationId,
      createdById: input.userId,
      templateName: input.templateName,
      templateLanguage: input.templateLanguage,
      templateCategory: input.templateCategory as WhatsAppTemplateCategory,
      templateVariables: { header: [], body: input.bodyParams },
    },
  });
  await prisma.broadcastRecipient.createMany({
    data: recipientRows.map((row) => ({ ...row, broadcastId: broadcast.id })),
    skipDuplicates: true,
  });
  const totalRecipients = await prisma.broadcastRecipient.count({ where: { broadcastId: broadcast.id } });
  const draftBroadcast = await prisma.broadcast.update({ where: { id: broadcast.id }, data: { totalRecipients } });

  // Taxa não paga ou modelo inválido: a campanha fica em rascunho nas Campanhas (CB-1), sem agendar.
  const pendingCount = await assertBroadcastSendable(draftBroadcast, input.organizationId);
  await assertBroadcastFeePaid(broadcast.id, pendingCount);

  const scheduledBroadcast = await prisma.broadcast.update({
    where: { id: broadcast.id },
    data: { status: "SCHEDULED", scheduledAt: input.scheduledAt },
    select: { id: true, name: true, status: true, scheduledAt: true, totalRecipients: true },
  });
  await inngest
    .send({
      name: "campanhas/broadcast.scheduled",
      data: { broadcastId: broadcast.id, organizationId: input.organizationId, scheduledAt: input.scheduledAt.toISOString() },
    })
    .catch((error) => console.error("[planner/whatsapp] agendamento do disparo falhou; o cron das Campanhas cobre:", error));
  return scheduledBroadcast;
}

export async function listCalendarBroadcasts(organizationIds: string[], from: Date, to: Date) {
  if (organizationIds.length === 0) return [];
  return prisma.broadcast.findMany({
    where: {
      organizationId: { in: organizationIds },
      OR: [{ scheduledAt: { gte: from, lt: to } }, { scheduledAt: null, startedAt: { gte: from, lt: to } }],
    },
    select: {
      id: true,
      organizationId: true,
      name: true,
      status: true,
      scheduledAt: true,
      startedAt: true,
      totalRecipients: true,
      sentCount: true,
      tracking: { select: { name: true } },
    },
    orderBy: { scheduledAt: "asc" },
    take: 200,
  });
}
