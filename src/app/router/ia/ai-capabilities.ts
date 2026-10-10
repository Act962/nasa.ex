import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { aiCapabilitiesSchema, parseAiCapabilities } from "@/features/tracking-chat-ai/lib/capabilities";
import { resolveBotVoice } from "@/features/astro-bot/lib/voice/voices";
import prisma from "@/lib/prisma";
import { z } from "zod";

// O que o Chatbot IA pode fazer pelo cliente (spec 0084). O tracking é sempre
// conferido contra a empresa ativa: sem isso, o id de outro tracking bastaria.

async function findOwnedTracking(trackingId: string, organizationId: string) {
  return prisma.tracking.findFirst({
    where: { id: trackingId, organizationId },
    select: { id: true, aiSettings: { select: { capabilities: true } } },
  });
}

export const getAiCapabilities = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ trackingId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const tracking = await findOwnedTracking(input.trackingId, context.org.id);
    if (!tracking) throw errors.NOT_FOUND({ message: "Tracking não encontrado" });
    const agendas = await prisma.agenda.findMany({
      where: { organizationId: context.org.id, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    const [forms, workspaces] = await Promise.all([
      prisma.form.findMany({
        where: { organizationId: context.org.id, published: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
        take: 100,
      }),
      prisma.workspace.findMany({
        where: { organizationId: context.org.id },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
        take: 100,
      }),
    ]);
    return {
      hasAiSettings: Boolean(tracking.aiSettings),
      capabilities: parseAiCapabilities(tracking.aiSettings?.capabilities),
      availableAgendas: agendas,
      availableForms: forms,
      availableWorkspaces: workspaces,
    };
  });

export const updateAiCapabilities = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ trackingId: z.string(), capabilities: aiCapabilitiesSchema }))
  .handler(async ({ input, context, errors }) => {
    const tracking = await findOwnedTracking(input.trackingId, context.org.id);
    if (!tracking) throw errors.NOT_FOUND({ message: "Tracking não encontrado" });
    if (!tracking.aiSettings) {
      throw errors.BAD_REQUEST({ message: "Preencha a aba Geral do Chatbot IA antes de ligar estas opções." });
    }
    // Só agendas desta empresa entram na lista do agente.
    const ownedAgendas = await prisma.agenda.findMany({
      where: { id: { in: input.capabilities.agenda.agendaIds }, organizationId: context.org.id },
      select: { id: true },
    });
    // O mesmo vale para formulários e Workspace: id de outra empresa é descartado.
    const [ownedForms, ownedWorkspace] = await Promise.all([
      prisma.form.findMany({
        where: { id: { in: input.capabilities.forms.formIds }, organizationId: context.org.id, published: true },
        select: { id: true },
      }),
      input.capabilities.teamRequest.workspaceId
        ? prisma.workspace.findFirst({
            where: { id: input.capabilities.teamRequest.workspaceId, organizationId: context.org.id },
            select: { id: true },
          })
        : null,
    ]);
    const capabilities = {
      ...input.capabilities,
      voiceName: input.capabilities.voiceName ? resolveBotVoice(input.capabilities.voiceName) : null,
      agenda: { ...input.capabilities.agenda, agendaIds: ownedAgendas.map((agenda) => agenda.id) },
      forms: { ...input.capabilities.forms, formIds: ownedForms.map((form) => form.id) },
      teamRequest: {
        isEnabled: input.capabilities.teamRequest.isEnabled && Boolean(ownedWorkspace),
        workspaceId: ownedWorkspace?.id ?? null,
      },
      // Quem salva assina as demandas e os lembretes criados pelo agente; nunca vem do cliente.
      configuredByUserId: context.user.id,
    };
    await prisma.aiSettings.update({
      where: { trackingId: input.trackingId },
      data: { capabilities, isAudioEnabled: capabilities.voiceReply },
    });
    return { trackingId: input.trackingId, capabilities };
  });
