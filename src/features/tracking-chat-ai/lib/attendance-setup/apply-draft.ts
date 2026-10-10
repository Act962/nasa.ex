import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { parseAiCapabilities } from "../capabilities";
import {
  buildAssistantPrompt,
  buildKnowledgeMarkdown,
  knowledgeDocumentName,
  knowledgeSourceLine,
  pickAssistantName,
  type AttendanceDraft,
} from "./draft";

// Grava o que o administrador confirmou (spec 0088, RF-8 e RF-9). Só escritas de banco:
// é chamado dentro de uma transação (Regra 18).

const ALLOWED_SLOT_MINUTES = [15, 30, 45, 60];
const DEFAULT_SLOT_MINUTES = 30;

function buildAgendaSlug(name: string, position: number): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "agenda"}-${Date.now().toString(36)}${position}`;
}

export interface AppliedAttendanceDraft {
  knowledgeId: string;
  wasKnowledgeUpdated: boolean;
  createdAgendaNames: string[];
  skippedAgendaNames: string[];
  keptExistingInstructions: boolean;
  assistantName: string;
}

export async function applyAttendanceDraft(
  tx: Prisma.TransactionClient,
  params: {
    organizationId: string;
    userId: string;
    trackingId: string;
    siteHost: string;
    draft: AttendanceDraft;
  },
): Promise<AppliedAttendanceDraft> {
  const { draft, organizationId, trackingId } = params;
  const assistantName = pickAssistantName(params.siteHost);
  const content = buildKnowledgeMarkdown({ draft, siteHost: params.siteHost, readAt: new Date() });

  const existingKnowledge = await tx.aiKnowledge.findFirst({
    where: { organizationId, content: { startsWith: knowledgeSourceLine(params.siteHost) } },
    select: { id: true },
  });
  const knowledge = existingKnowledge
    ? await tx.aiKnowledge.update({
        where: { id: existingKnowledge.id },
        data: { content, name: knowledgeDocumentName(draft), status: "READY" },
        select: { id: true },
      })
    : await tx.aiKnowledge.create({
        data: {
          organizationId,
          name: knowledgeDocumentName(draft),
          type: "md",
          content,
          status: "READY",
          createdBy: params.userId,
        },
        select: { id: true },
      });

  const existingAgendas = await tx.agenda.findMany({
    where: { organizationId },
    select: { name: true },
  });
  const existingAgendaNames = new Set(existingAgendas.map((agenda) => agenda.name.trim().toLowerCase()));
  const createdAgendaNames: string[] = [];
  const skippedAgendaNames: string[] = [];
  for (const [position, suggestedAgenda] of draft.suggestedAgendas.entries()) {
    const agendaName = suggestedAgenda.name.trim().slice(0, 80);
    if (agendaName.length < 2) continue;
    if (existingAgendaNames.has(agendaName.toLowerCase())) {
      skippedAgendaNames.push(agendaName);
      continue;
    }
    existingAgendaNames.add(agendaName.toLowerCase());
    await tx.agenda.create({
      data: {
        name: agendaName,
        slug: buildAgendaSlug(agendaName, position),
        slotDuration: ALLOWED_SLOT_MINUTES.includes(suggestedAgenda.slotMinutes)
          ? suggestedAgenda.slotMinutes
          : DEFAULT_SLOT_MINUTES,
        // Nasce desligada: sem horários conferidos, não pode aparecer para o cliente.
        isActive: false,
        trackingId,
        organizationId,
        responsibles: { create: { userId: params.userId } },
      },
    });
    createdAgendaNames.push(agendaName);
  }

  const currentSettings = await tx.aiSettings.findUnique({
    where: { trackingId },
    select: { prompt: true, assistantName: true, capabilities: true },
  });
  const currentCapabilities = parseAiCapabilities(currentSettings?.capabilities);
  const capabilities = {
    ...currentCapabilities,
    knowledgeIds: [...new Set([...currentCapabilities.knowledgeIds, knowledge.id])].slice(0, 10),
    configuredByUserId: currentCapabilities.configuredByUserId ?? params.userId,
  };
  const hasWrittenInstructions = Boolean(currentSettings?.prompt?.trim());

  if (currentSettings) {
    await tx.aiSettings.update({
      where: { trackingId },
      data: {
        capabilities,
        // Instruções que a empresa já escreveu não são trocadas por um texto gerado.
        ...(hasWrittenInstructions
          ? {}
          : { prompt: buildAssistantPrompt(draft, assistantName), assistantName }),
      },
    });
  } else {
    await tx.aiSettings.create({
      data: {
        trackingId,
        prompt: buildAssistantPrompt(draft, assistantName),
        assistantName,
        capabilities,
      },
    });
    // Configuração nova nunca começa atendendo: quem liga é a empresa, depois de revisar.
    await tx.tracking.update({ where: { id: trackingId }, data: { globalAiActive: false } });
  }

  return {
    knowledgeId: knowledge.id,
    wasKnowledgeUpdated: Boolean(existingKnowledge),
    createdAgendaNames,
    skippedAgendaNames,
    keptExistingInstructions: hasWrittenInstructions,
    assistantName: hasWrittenInstructions ? (currentSettings?.assistantName ?? assistantName) : assistantName,
  };
}
