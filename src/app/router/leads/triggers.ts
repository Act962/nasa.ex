import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import z from "zod";
import { nextWindowOpening } from "@/features/leads/lib/triggers/schedule";
import {
  LEAD_TRIGGER_TEMPLATES,
  hasLeadNamePlaceholder,
  type LeadTriggerTemplateKey,
} from "@/features/leads/lib/triggers/templates";

// Gatilho do lead (spec 0038): ler e salvar os cards-modelo de um lead.

const TEMPLATE_KEYS = LEAD_TRIGGER_TEMPLATES.map((template) => template.key) as [LeadTriggerTemplateKey, ...LeadTriggerTemplateKey[]];
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

async function findLeadInOrg(leadId: string, organizationId: string) {
  return prisma.lead.findFirst({
    where: { id: leadId, tracking: { organizationId } },
    select: { id: true, trackingId: true },
  });
}

export const listLeadTriggers = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", path: "/leads/:leadId/triggers", summary: "Lead triggers", tags: ["Leads"] })
  .input(z.object({ leadId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const lead = await findLeadInOrg(input.leadId, context.org.id);
    if (!lead) throw errors.NOT_FOUND;
    const triggers = await prisma.leadTrigger.findMany({
      where: { leadId: input.leadId },
      select: {
        id: true,
        template: true,
        message: true,
        isActive: true,
        scheduledAt: true,
        nextRunAt: true,
        windowStart: true,
        windowEnd: true,
        weekdays: true,
        skipWhenInService: true,
        repeatEveryDays: true,
        maxRepetitions: true,
        cycleFireCount: true,
        tagIds: true,
        activationCount: true,
        lastFiredAt: true,
        lastError: true,
      },
    });
    return { triggers, trackingId: lead.trackingId };
  });

export const saveLeadTrigger = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "PUT", path: "/leads/:leadId/triggers/:template", summary: "Save a lead trigger", tags: ["Leads"] })
  .input(
    z.object({
      leadId: z.string(),
      template: z.enum(TEMPLATE_KEYS),
      message: z.string().trim().min(3).max(1000),
      isActive: z.boolean(),
      scheduledAt: z.string().datetime().nullable(),
      windowStart: z.string().regex(TIME_PATTERN),
      windowEnd: z.string().regex(TIME_PATTERN),
      weekdays: z.array(z.number().int().min(0).max(6)).max(7),
      skipWhenInService: z.boolean(),
      repeatEveryDays: z.number().int().min(1).max(365).nullable(),
      maxRepetitions: z.number().int().min(1).max(30),
      tagIds: z.array(z.string()).max(20),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const lead = await findLeadInOrg(input.leadId, context.org.id);
    if (!lead) throw errors.NOT_FOUND;
    // CA-1: sem o nome do lead a mensagem não sai.
    if (!hasLeadNamePlaceholder(input.message)) {
      throw errors.BAD_REQUEST({ message: "A mensagem precisa ter {nome} — é onde entra o nome do lead." });
    }
    if (input.isActive && !input.scheduledAt) {
      throw errors.BAD_REQUEST({ message: "Escolha a data e o horário antes de ligar o gatilho." });
    }
    if (input.maxRepetitions > 1 && !input.repeatEveryDays) {
      throw errors.BAD_REQUEST({ message: "Com mais de uma repetição, escolha de quantos em quantos dias." });
    }
    if (input.windowStart >= input.windowEnd) {
      throw errors.BAD_REQUEST({ message: "O horário de início precisa ser antes do fim." });
    }

    // "Apenas com as tags": só tags desta org entram.
    const tagIds = input.tagIds.length
      ? (
          await prisma.tag.findMany({
            where: { id: { in: input.tagIds }, organizationId: context.org.id },
            select: { id: true },
          })
        ).map((tag) => tag.id)
      : [];

    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
    const window = { windowStart: input.windowStart, windowEnd: input.windowEnd, weekdays: input.weekdays };
    const nextRunAt = input.isActive && scheduledAt ? nextWindowOpening(scheduledAt, window) : null;
    if (input.isActive && !nextRunAt) {
      throw errors.BAD_REQUEST({ message: "O período de ativação não tem nenhum dia ou horário aberto." });
    }

    const template = LEAD_TRIGGER_TEMPLATES.find((item) => item.key === input.template)!;
    const existing = await prisma.leadTrigger.findUnique({
      where: { leadId_template: { leadId: input.leadId, template: input.template } },
      select: { isActive: true },
    });
    const isTurningOn = input.isActive && !existing?.isActive;
    const data = {
      message: input.message,
      isActive: input.isActive,
      scheduledAt,
      nextRunAt,
      windowStart: input.windowStart,
      windowEnd: input.windowEnd,
      weekdays: input.weekdays,
      skipWhenInService: input.skipWhenInService,
      repeatEveryDays: input.maxRepetitions > 1 ? input.repeatEveryDays : null,
      maxRepetitions: input.maxRepetitions,
      tagIds,
      lastError: null,
      failureCount: 0,
      // Ligar (de desligado) começa um ciclo novo de repetições.
      ...(isTurningOn ? { cycleFireCount: 0 } : {}),
    };
    const trigger = await prisma.leadTrigger.upsert({
      where: { leadId_template: { leadId: input.leadId, template: input.template } },
      create: {
        ...data,
        organizationId: context.org.id,
        leadId: input.leadId,
        createdById: context.user.id,
        template: input.template,
        title: template.title,
      },
      update: data,
      select: { id: true, isActive: true, nextRunAt: true },
    });
    return { trigger };
  });
