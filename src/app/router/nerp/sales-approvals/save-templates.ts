import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireAppPermission } from "@/app/middlewares/app-permission";
import prisma from "@/lib/prisma";
import { DEFAULT_APPROVAL_TEMPLATES, resolveApprovalTemplates } from "@/features/nerp-catalog/lib/approvals/approval-rules";

const templateNameSchema = z.string().regex(/^[a-z0-9_]{1,512}$/, "Use letras minúsculas, números e _");

export const saveSalesApprovalTemplates = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireAppPermission("catalogo-online", "canEdit"))
  .input(z.object(Object.fromEntries(Object.keys(DEFAULT_APPROVAL_TEMPLATES).map((key) => [key, templateNameSchema.optional()]))))
  .handler(async ({ input, context, errors }) => {
    const integration = await prisma.nerpCatalogIntegration.findUnique({ where: { organizationId: context.org.id }, select: { id: true } });
    if (!integration) throw errors.BAD_REQUEST({ message: "Configure o Catálogo online antes." });
    const templates = resolveApprovalTemplates(input);
    await prisma.nerpCatalogIntegration.update({ where: { id: integration.id }, data: { approvalTemplates: templates } });
    return templates;
  });
