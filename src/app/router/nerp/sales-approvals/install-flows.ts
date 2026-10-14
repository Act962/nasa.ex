import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireAppPermission } from "@/app/middlewares/app-permission";
import prisma from "@/lib/prisma";
import { resolveApprovalTemplates } from "@/features/nerp-catalog/lib/approvals/approval-rules";
import { createWorkflowFromBlueprint } from "@/features/workflows/lib/agent-presets/create-from-blueprint";
import { findOrCreateTags } from "@/features/workflows/lib/agent-presets/find-or-create-tags";
import { buildGuidedSaleBlueprints, GUIDED_SALE_TAGS } from "@/features/workflows/lib/agent-presets/venda-guiada-catalogo";
import { listChatFields } from "@/features/workflows/lib/form-chat";

// Spec 0104, D-5: cria os fluxos prontos da venda guiada nos Gatilhos do funil. Nascem pausados.
export const installGuidedSaleFlows = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireAppPermission("catalogo-online", "canEdit"))
  .input(z.object({ trackingId: z.string().min(1).optional(), registrationFormId: z.string().min(1).optional() }))
  .handler(async ({ input, context, errors }) => {
    const integration = await prisma.nerpCatalogIntegration.findUnique({
      where: { organizationId: context.org.id },
      select: { ordersTrackingId: true, approvalTemplates: true },
    });
    const trackingId = input.trackingId ?? integration?.ordersTrackingId;
    if (!trackingId) throw errors.BAD_REQUEST({ message: "Escolha o funil onde o pedido do catálogo chega." });
    const tracking = await prisma.tracking.findFirst({ where: { id: trackingId, organizationId: context.org.id }, select: { id: true } });
    if (!tracking) throw errors.NOT_FOUND({ message: "Funil não encontrado." });

    // Cadastro do cliente novo (passo "Preencher formulário pela conversa"): todos os campos que dá para perguntar.
    let registration: { formId: string; fieldIds: string[] } | null = null;
    if (input.registrationFormId) {
      const form = await prisma.form.findFirst({ where: { id: input.registrationFormId, organizationId: context.org.id }, select: { id: true, jsonBlock: true } });
      if (!form) throw errors.NOT_FOUND({ message: "Formulário de cadastro não encontrado." });
      const fieldIds = listChatFields(form.jsonBlock).map((field) => field.id);
      if (fieldIds.length === 0) throw errors.BAD_REQUEST({ message: "Esse formulário não tem campos que dá para perguntar pela conversa." });
      registration = { formId: form.id, fieldIds };
    }
    const blueprints = buildGuidedSaleBlueprints({
      organizationId: context.org.id,
      templates: resolveApprovalTemplates(integration?.approvalTemplates),
      registration,
    });
    const workflowIds = await prisma.$transaction(async (tx) => {
      const { tagMap } = await findOrCreateTags(tx, context.org.id, [...GUIDED_SALE_TAGS]);
      const created: string[] = [];
      for (const blueprint of blueprints) {
        const result = await createWorkflowFromBlueprint(tx, { trackingId: tracking.id, userId: context.user.id, blueprint, tagMap, isActive: false });
        created.push(result.workflowId);
      }
      return created;
    }, { timeout: 20_000 });
    return { workflowIds, trackingId: tracking.id };
  });
