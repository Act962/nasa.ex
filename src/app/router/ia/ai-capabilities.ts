import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { aiCapabilitiesSchema, parseAiCapabilities } from "@/features/tracking-chat-ai/lib/capabilities";
import { loadAiCapabilityOptions, sanitizeAiCapabilities } from "@/features/tracking-chat-ai/server/capability-access";
import prisma from "@/lib/prisma";
import { isAttendanceStateEnabled } from "@/features/org-defaults/lib/attendance/flag";
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
    const options = await loadAiCapabilityOptions(context.org.id);
    return {
      hasAiSettings: Boolean(tracking.aiSettings),
      // Estado de atendimento ligado na empresa (spec 0113): mostra a seção "Atendimento".
      isAttendanceManaged: isAttendanceStateEnabled(context.org.id),
      capabilities: parseAiCapabilities(tracking.aiSettings?.capabilities),
      availableAgendas: options.agendas,
      availableForms: options.forms,
      availableWorkspaces: options.workspaces,
      availableKnowledge: options.knowledge,
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
      throw errors.BAD_REQUEST({ message: "Preencha a aba Geral do Fluxo de atendimento antes de ligar estas opções." });
    }
    const capabilities = await sanitizeAiCapabilities(input.capabilities, { organizationId: context.org.id, userId: context.user.id });
    await prisma.aiSettings.update({
      where: { trackingId: input.trackingId },
      data: { capabilities },
    });
    return { trackingId: input.trackingId, capabilities };
  });
