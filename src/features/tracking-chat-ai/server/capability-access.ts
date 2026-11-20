import "server-only";
import { resolveBotVoice } from "@/features/astro-bot/lib/voice/voices";
import prisma from "@/lib/prisma";
import type { AiCapabilities } from "../lib/capabilities";

/**
 * Capacidades vindas do navegador antes de gravar (spec 0084): agenda, formulário, Workspace e documento de outra empresa
 * são descartados, e quem assina demandas e lembretes é sempre quem salvou, nunca o valor enviado.
 */
export async function sanitizeAiCapabilities(capabilities: AiCapabilities, params: { organizationId: string; userId: string }): Promise<AiCapabilities> {
  const [ownedAgendas, ownedForms, ownedWorkspace, ownedKnowledge] = await Promise.all([
    capabilities.agenda.agendaIds.length > 0
      ? prisma.agenda.findMany({ where: { id: { in: capabilities.agenda.agendaIds }, organizationId: params.organizationId }, select: { id: true } })
      : [],
    capabilities.forms.formIds.length > 0
      ? prisma.form.findMany({ where: { id: { in: capabilities.forms.formIds }, organizationId: params.organizationId, published: true }, select: { id: true } })
      : [],
    capabilities.teamRequest.workspaceId
      ? prisma.workspace.findFirst({ where: { id: capabilities.teamRequest.workspaceId, organizationId: params.organizationId }, select: { id: true } })
      : null,
    capabilities.knowledgeIds.length > 0
      ? prisma.aiKnowledge.findMany({ where: { id: { in: capabilities.knowledgeIds }, organizationId: params.organizationId }, select: { id: true } })
      : [],
  ]);
  return {
    ...capabilities,
    voiceName: capabilities.voiceName ? resolveBotVoice(capabilities.voiceName) : null,
    agenda: { ...capabilities.agenda, agendaIds: ownedAgendas.map((agenda) => agenda.id) },
    forms: { ...capabilities.forms, formIds: ownedForms.map((form) => form.id) },
    teamRequest: { isEnabled: capabilities.teamRequest.isEnabled && Boolean(ownedWorkspace), workspaceId: ownedWorkspace?.id ?? null },
    knowledgeIds: ownedKnowledge.map((document) => document.id),
    configuredByUserId: params.userId,
  };
}

/** O que a empresa pode liberar ao atendimento: agendas, formulários publicados, Workspaces e documentos prontos. */
export async function loadAiCapabilityOptions(organizationId: string) {
  const [agendas, forms, workspaces, knowledge] = await Promise.all([
    prisma.agenda.findMany({ where: { organizationId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.form.findMany({ where: { organizationId, published: true }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 100 }),
    prisma.workspace.findMany({ where: { organizationId }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 100 }),
    prisma.aiKnowledge.findMany({
      where: { organizationId, status: "READY", content: { not: null } },
      select: { id: true, name: true },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
  ]);
  return { agendas, forms, workspaces, knowledge };
}
