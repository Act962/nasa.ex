import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const shareAction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({
    actionId: z.string(),
    companyCode: z.string().min(1),
    message: z.string().optional(),
  }))
  .handler(async ({ input, context }) => {
    // Validate action belongs to org
    const action = await prisma.action.findFirst({
      where: { id: input.actionId, organizationId: context.org.id },
      select: { id: true, title: true },
    });
    if (!action) throw new Error("Ação não encontrada");

    // Find target org by company code
    const targetOrg = await prisma.organization.findUnique({
      where: { companyCode: input.companyCode.toUpperCase() },
      select: { id: true, name: true },
    });
    if (!targetOrg) throw new Error("Código de empresa não encontrado");
    if (targetOrg.id === context.org.id) throw new Error("Não é possível compartilhar com sua própria empresa");

    // Check for duplicate pending share
    const existing = await prisma.actionShare.findFirst({
      where: {
        sourceActionId: input.actionId,
        targetOrgId: targetOrg.id,
        status: "PENDING",
      },
    });
    if (existing) throw new Error("Já existe um pedido pendente para esta empresa");

    const share = await prisma.actionShare.create({
      data: {
        sourceActionId: input.actionId,
        sourceOrgId: context.org.id,
        targetOrgId: targetOrg.id,
        requestedBy: context.user.id,
        message: input.message,
        status: "PENDING",
      },
      include: {
        targetOrg: { select: { id: true, name: true } },
        sourceAction: { select: { id: true, title: true } },
      },
    });

    return { share, targetOrgName: targetOrg.name };
  });
