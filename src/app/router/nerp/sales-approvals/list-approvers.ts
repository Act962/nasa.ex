import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireAppPermission } from "@/app/middlewares/app-permission";
import prisma from "@/lib/prisma";
import { resolveApprovalTemplates } from "@/features/nerp-catalog/lib/approvals/approval-rules";

// Spec 0104, RF-8: quem aprova a venda do catálogo, por setor, e os nomes dos templates.
export const listSalesApprovers = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireAppPermission("catalogo-online", "canView"))
  .handler(async ({ context }) => {
    const [approvers, members, integration] = await Promise.all([
      prisma.salesApprover.findMany({
        where: { organizationId: context.org.id },
        orderBy: [{ sector: "asc" }, { createdAt: "asc" }],
        select: { id: true, sector: true, rounds: true, phoneE164: true, optInAt: true, isActive: true, user: { select: { id: true, name: true } } },
      }),
      prisma.member.findMany({
        where: { organizationId: context.org.id },
        select: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.nerpCatalogIntegration.findUnique({
        where: { organizationId: context.org.id },
        select: { ordersTrackingId: true, approvalTemplates: true },
      }),
    ]);
    return {
      approvers: approvers.map((approver) => ({
        id: approver.id,
        sector: approver.sector,
        rounds: approver.rounds,
        phone: approver.phoneE164,
        hasOptIn: !!approver.optInAt,
        isActive: approver.isActive,
        userId: approver.user.id,
        userName: approver.user.name,
      })),
      members: members.map((member) => ({ id: member.user.id, name: member.user.name })),
      templates: resolveApprovalTemplates(integration?.approvalTemplates),
      ordersTrackingId: integration?.ordersTrackingId ?? null,
    };
  });
