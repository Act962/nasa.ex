import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import z from "zod";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import { computeLeadMetrics } from "@/features/leads/lib/metrics/compute-lead-metrics";
import { auditLeadWithAi } from "@/features/leads/lib/metrics/audit-with-ai";
import { saveLeadMetrics } from "@/features/leads/lib/metrics/save-lead-metrics";

// "Auditar Lead" (spec 0035): ler e calcular as métricas do lead.

const leadInput = z.object({ leadId: z.string() });
/** Abaixo disto o cálculo tem pouco sinal e a IA entra (D-3). */
const AI_CONFIDENCE_THRESHOLD = 40;
const MIN_MESSAGES_FOR_AI = 5;

async function assertLeadInOrg(leadId: string, organizationId: string): Promise<boolean> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, tracking: { organizationId } },
    select: { id: true },
  });
  return Boolean(lead);
}

export const getLeadMetrics = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", path: "/leads/:leadId/metrics", summary: "Lead audit metrics", tags: ["Leads"] })
  .input(leadInput)
  .handler(async ({ input, context, errors }) => {
    if (!(await assertLeadInOrg(input.leadId, context.org.id))) throw errors.NOT_FOUND;
    const metrics = await prisma.leadMetrics.findUnique({ where: { leadId: input.leadId } });
    return { metrics };
  });

export const auditLead = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "POST", path: "/leads/:leadId/audit", summary: "Audit a lead", tags: ["Leads"] })
  .input(leadInput)
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;
    if (!(await assertLeadInOrg(input.leadId, organizationId))) throw errors.NOT_FOUND;

    const computed = await computeLeadMetrics(input.leadId);
    if (!computed) throw errors.NOT_FOUND;

    let aiAudit = null;
    let notice: string | null = null;
    const needsAi = computed.confidence < AI_CONFIDENCE_THRESHOLD && computed.totalMessages >= MIN_MESSAGES_FOR_AI;
    if (needsAi) {
      const charge = await chargeStarsByAction(organizationId, "lead_audit_ai", {
        userId: context.user.id,
        appSlug: "lead_audit_ai",
        description: "Auditoria de lead por IA",
      });
      if (!charge.success) {
        notice = "Sem Stars para a auditoria por IA: mostrando só o que os dados dizem.";
      } else {
        try {
          aiAudit = await auditLeadWithAi({ organizationId, leadId: input.leadId });
        } catch (error) {
          console.error("[leads.auditLead] IA falhou", error);
          notice = "A auditoria por IA não respondeu: mostrando só o que os dados dizem.";
        }
      }
    }

    const metrics = await saveLeadMetrics({
      leadId: input.leadId,
      computed,
      aiAudit,
      isNewAiAudit: Boolean(aiAudit),
    });
    return { metrics, notice };
  });
