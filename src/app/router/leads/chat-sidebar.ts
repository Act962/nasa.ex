import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import z from "zod";

// Lateral "Detalhes do Lead" do chat: contadores dos itens e as listas que
// ainda não tinham consulta por lead (agenda, campanhas, comandos do ASTRO).
// Todas conferem que o lead é da org de quem pede.

const leadInput = z.object({ leadId: z.string() });
const LIST_LIMIT = 100;

async function assertLeadInOrg(leadId: string, organizationId: string): Promise<boolean> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, tracking: { organizationId } },
    select: { id: true },
  });
  return Boolean(lead);
}

/** `triggerKey` do COMMANDER para eventos disparados por este lead. */
const commandTriggerKey = (leadId: string) => `lead:${leadId}`;

export const getChatSidebarSummary = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", path: "/leads/:leadId/chat-sidebar", summary: "Counts for the chat lead sidebar", tags: ["Leads"] })
  .input(leadInput)
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;
    if (!(await assertLeadInOrg(input.leadId, organizationId))) throw errors.NOT_FOUND;
    const { leadId } = input;
    const [journeyEvents, history, files, forms, contracts, documents, appointments, campaigns, activeTriggers] =
      await Promise.all([
        prisma.leadJourneyEvent.count({ where: { leadId } }),
        prisma.leadHistory.count({ where: { leadId } }),
        prisma.leadFile.count({ where: { leadId } }),
        prisma.formResponses.count({ where: { leadId } }),
        prisma.forgeContract.count({ where: { organizationId, isTemplate: false, proposal: { clientId: leadId } } }),
        prisma.forgeProposal.count({ where: { organizationId, clientId: leadId } }),
        prisma.appointment.count({ where: { leadId, agenda: { organizationId } } }),
        prisma.broadcastRecipient.count({ where: { leadId, broadcast: { organizationId } } }),
        prisma.leadTrigger.count({ where: { leadId, isActive: true } }),
      ]);
    return {
      counts: {
        journey: journeyEvents + history,
        files,
        forms,
        contracts,
        documents,
        agenda: appointments,
        campaigns,
        leadTriggers: activeTriggers,
      },
    };
  });

export const listLeadAppointments = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", path: "/leads/:leadId/appointments", summary: "Appointments of a lead", tags: ["Leads"] })
  .input(leadInput)
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;
    if (!(await assertLeadInOrg(input.leadId, organizationId))) throw errors.NOT_FOUND;
    const appointments = await prisma.appointment.findMany({
      where: { leadId: input.leadId, agenda: { organizationId } },
      select: {
        id: true,
        title: true,
        startsAt: true,
        endsAt: true,
        status: true,
        agenda: { select: { id: true, name: true } },
      },
      orderBy: { startsAt: "desc" },
      take: LIST_LIMIT,
    });
    return { appointments };
  });

export const listLeadCampaigns = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", path: "/leads/:leadId/campaigns", summary: "Campaigns sent to a lead", tags: ["Leads"] })
  .input(leadInput)
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;
    if (!(await assertLeadInOrg(input.leadId, organizationId))) throw errors.NOT_FOUND;
    const recipients = await prisma.broadcastRecipient.findMany({
      where: { leadId: input.leadId, broadcast: { organizationId } },
      select: {
        id: true,
        status: true,
        sentAt: true,
        deliveredAt: true,
        readAt: true,
        errorMessage: true,
        createdAt: true,
        broadcast: { select: { id: true, name: true, templateName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: LIST_LIMIT,
    });
    // Disparo em massa só sai por número da API Oficial (Meta Cloud) com WABA.
    const lead = await prisma.lead.findUniqueOrThrow({
      where: { id: input.leadId },
      select: { trackingId: true, tracking: { select: { whatsappInstance: { select: { provider: true, metaBusinessAccountId: true } } } } },
    });
    const instance = lead.tracking.whatsappInstance;
    return {
      recipients,
      massSend: {
        trackingId: lead.trackingId,
        hasOfficialNumber: instance?.provider === "META_CLOUD" && Boolean(instance.metaBusinessAccountId),
        hasAnyInstance: Boolean(instance),
      },
    };
  });

export const listLeadCommandRuns = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", path: "/leads/:leadId/command-runs", summary: "ASTRO command runs triggered by a lead", tags: ["Leads"] })
  .input(leadInput)
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;
    if (!(await assertLeadInOrg(input.leadId, organizationId))) throw errors.NOT_FOUND;
    const runs = await prisma.astroCommandRun.findMany({
      where: { organizationId, triggerKey: commandTriggerKey(input.leadId) },
      select: {
        id: true,
        status: true,
        summary: true,
        startedAt: true,
        finishedAt: true,
        command: { select: { id: true, title: true } },
      },
      orderBy: { startedAt: "desc" },
      take: LIST_LIMIT,
    });
    return { runs };
  });
