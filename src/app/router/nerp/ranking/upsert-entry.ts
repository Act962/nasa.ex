import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { requireOrgAdmin } from "../_access";

const upsertSalesGoalEntryInputSchema = z.object({
  entryId: z.string(),
  goalName: z.string().min(1).optional(),
  goalAmount: z.number().nonnegative().optional(),
  achievedAmount: z.number().nonnegative().nullable().optional(),
  entryKind: z.enum(["SELLER", "BUCKET"]).optional(),
  memberId: z.string().nullable().optional(),
});

export const upsertSalesGoalEntry = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(upsertSalesGoalEntryInputSchema)
  .handler(async ({ input, context }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    const entry = await prisma.salesGoalEntry.findFirst({
      where: { id: input.entryId, branch: { period: { organizationId: context.org.id } } },
    });
    if (!entry) {
      throw new ORPCError("NOT_FOUND", { message: "Meta não encontrada." });
    }

    return prisma.salesGoalEntry.update({
      where: { id: input.entryId },
      data: {
        goalName: input.goalName,
        goalAmount: input.goalAmount,
        achievedAmount: input.achievedAmount,
        entryKind: input.entryKind,
        memberId: input.memberId,
      },
    });
  });
