import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { requireOrgAdmin } from "../_access";

const updateSalesGoalBranchInputSchema = z.object({
  branchId: z.string(),
  name: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

// Renomear/reordenar aqui vale só até o próximo import da planilha: o
// import recria a filial pelo nome original (upsert por [periodId, name]).
export const updateSalesGoalBranch = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(updateSalesGoalBranchInputSchema)
  .handler(async ({ input, context }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    const branch = await prisma.salesGoalBranch.findFirst({
      where: { id: input.branchId, period: { organizationId: context.org.id } },
    });
    if (!branch) {
      throw new ORPCError("NOT_FOUND", { message: "Equipe não encontrada." });
    }

    return prisma.salesGoalBranch.update({
      where: { id: input.branchId },
      data: {
        name: input.name,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      },
    });
  });
