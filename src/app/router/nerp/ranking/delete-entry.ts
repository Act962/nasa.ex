import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { requireOrgAdmin } from "../_access";

export const deleteSalesGoalEntry = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ entryId: z.string() }))
  .handler(async ({ input, context }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    const entry = await prisma.salesGoalEntry.findFirst({
      where: { id: input.entryId, branch: { period: { organizationId: context.org.id } } },
    });
    if (!entry) {
      throw new ORPCError("NOT_FOUND", { message: "Meta não encontrada." });
    }

    await prisma.salesGoalEntry.delete({ where: { id: input.entryId } });
    return { deleted: true as const };
  });
