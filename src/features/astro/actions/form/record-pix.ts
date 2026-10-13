import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";
import type { AstroAction, AstroActionResult } from "../types";
import { resolveSingleLead } from "../leads/resolve-lead";
import { LEAD_FIELD_STEP, extractNameAfter } from "../leads/lead-steps";
import { checkRecordPix, sendRecordPix, setRecordPaid } from "@/features/form-records/server/record-pix";
import { formatCents } from "@/features/form-records/lib/measure-units";

// PIX das fichas pelo ASTRO (spec 0081, RF-20 a RF-22): "manda o PIX para a Maria" e
// "marca a ficha da Maria como paga". A ficha é a mais recente do cliente, finalizada, com valor e sem baixa.

const APP_NAME = "Formulários";
const leadNameSchema = z.object({
  leadName: z.string().trim().min(2).optional().describe("Nome do cliente dono da ficha."),
});

type UnpaidRecord = { id: string; label: string | null; usageTotalCents: number; pixSentAt: Date | null; form: { name: string } };

async function findLatestUnpaidRecord(organizationId: string, leadId: string): Promise<UnpaidRecord | null> {
  return prisma.formRecord.findFirst({
    where: { organizationId, leadId, finalizedAt: { not: null }, usageTotalCents: { gt: 0 }, paidAt: null },
    orderBy: { referenceDate: "desc" },
    select: { id: true, label: true, usageTotalCents: true, pixSentAt: true, form: { select: { name: true } } },
  });
}

function describeRecord(record: UnpaidRecord): string {
  return `${record.label ? `${record.form.name} · ${record.label}` : record.form.name}, ${formatCents(record.usageTotalCents)}`;
}

async function resolveClientRecord(params: {
  ctx: AgentContext;
  leadName: string | undefined;
  question: string;
}): Promise<{ lead: { id: string; name: string }; record: UnpaidRecord } | { failure: AstroActionResult }> {
  if (!params.leadName) {
    return {
      failure: {
        status: "needs_input",
        title: "Qual cliente?",
        description: params.question,
        missingFields: [{ key: "leadName", label: "o nome do cliente" }],
        appName: APP_NAME,
        picker: LEAD_FIELD_STEP.picker,
      },
    };
  }
  const resolved = await resolveSingleLead({ ctx: params.ctx, name: params.leadName, field: "leadName", appName: APP_NAME });
  if ("failure" in resolved) return { failure: resolved.failure };
  const record = await findLatestUnpaidRecord(params.ctx.organizationId, resolved.lead.id);
  if (!record) {
    return {
      failure: {
        status: "error",
        title: "Nada a cobrar",
        description: `${resolved.lead.name} não tem ficha finalizada com valor em aberto.`,
        appName: APP_NAME,
      },
    };
  }
  return { lead: resolved.lead, record };
}

const inferLeadName = (text: string) => {
  const leadName = extractNameAfter(text, ["para", "pra", "pro", "da", "do", "de"]);
  return leadName ? { leadName } : {};
};

export const sendRecordPixAction: AstroAction<typeof leadNameSchema> = {
  key: "form.send_record_pix",
  app: "form",
  toolName: "send_record_pix",
  description:
    "Envia ao cliente, pelo WhatsApp, o PIX copia e cola da ficha de atendimento mais recente dele — " +
    "'manda o PIX para a Maria', 'cobra a Maria no PIX'. Não lança no financeiro.",
  permission: { appKey: "formularios", action: "edit" },
  requiresConfirmation: true,
  confirmTitle: "Enviar PIX ao cliente",
  input: leadNameSchema,
  inferFields: inferLeadName,
  intentPatterns: [/\b(manda|mande|mandar|envia|envie|enviar|cobra|cobrar|cobre)\b.{0,40}\bpix\b/],
  fieldSteps: { leadName: { ...LEAD_FIELD_STEP, title: "Qual cliente?", question: "Para qual cliente eu mando o PIX?" } },

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const resolved = await resolveClientRecord({ ctx, leadName: input.leadName, question: "Para qual cliente eu mando o PIX?" });
    if ("failure" in resolved) return resolved.failure;
    const { lead, record } = resolved;

    // O ensaio já barra o que impediria o envio: cliente sem telefone, chave PIX não cadastrada.
    const checked = await checkRecordPix({ organizationId: ctx.organizationId, recordId: record.id });
    if (checked.failure) {
      return { status: "error", title: "Não dá para enviar o PIX", description: checked.failure.message, appName: APP_NAME };
    }
    if (dryRun) {
      const resendNote = record.pixSentAt ? " O PIX desta ficha já foi enviado antes." : "";
      return { status: "done", title: "Enviar PIX ao cliente", description: `Para ${lead.name}: ${describeRecord(record)}.${resendNote}`, appName: APP_NAME };
    }

    const sender = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } });
    const result = await sendRecordPix({ organizationId: ctx.organizationId, recordId: record.id, senderName: sender?.name ?? "ASTRO" });
    if (!result.isSent) return { status: "error", title: "PIX não enviado", description: result.message, appName: APP_NAME };
    return {
      status: "done",
      title: "PIX enviado",
      description: `Enviei o PIX de ${formatCents(result.amountCents)} para ${result.leadName}.`,
      appName: APP_NAME,
    };
  },
};

export const markRecordPaidAction: AstroAction<typeof leadNameSchema> = {
  key: "form.mark_record_paid",
  app: "form",
  toolName: "mark_record_paid",
  description:
    "Marca como PAGA a ficha de atendimento mais recente de um cliente — 'marca a ficha da Maria como paga', " +
    "'a Maria pagou a ficha'. É a baixa da ficha, não um lançamento do financeiro.",
  permission: { appKey: "formularios", action: "edit" },
  requiresConfirmation: true,
  confirmTitle: "Marcar ficha como paga",
  input: leadNameSchema,
  inferFields: inferLeadName,
  intentPatterns: [/\b(marca|marcar|marque)\b.{1,50}\bfichas?\b.{0,50}\b(pago|paga)\b/],
  fieldSteps: { leadName: { ...LEAD_FIELD_STEP, title: "Qual cliente?", question: "De qual cliente é a ficha paga?" } },

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const resolved = await resolveClientRecord({ ctx, leadName: input.leadName, question: "De qual cliente é a ficha paga?" });
    if ("failure" in resolved) return resolved.failure;
    const { lead, record } = resolved;
    if (dryRun) {
      return { status: "done", title: "Marcar ficha como paga", description: `De ${lead.name}: ${describeRecord(record)}.`, appName: APP_NAME };
    }
    const wasUpdated = await setRecordPaid({ organizationId: ctx.organizationId, recordId: record.id, isPaid: true });
    return wasUpdated
      ? { status: "done", title: "Ficha paga", description: `Marquei como paga a ficha de ${lead.name} (${describeRecord(record)}).`, appName: APP_NAME }
      : { status: "error", title: "Não foi possível dar a baixa", description: "A ficha não foi encontrada.", appName: APP_NAME };
  },
};
