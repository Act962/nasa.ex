import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireAppPermission } from "@/app/middlewares/app-permission";
import prisma from "@/lib/prisma";

export const removeSalesApprover = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireAppPermission("catalogo-online", "canEdit"))
  .input(z.object({ approverId: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    await prisma.salesApprover.deleteMany({ where: { id: input.approverId, organizationId: context.org.id } });
    return { ok: true };
  });
