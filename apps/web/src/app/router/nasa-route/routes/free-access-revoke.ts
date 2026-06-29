import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { isCourseManager } from "../utils";

export const freeAccessRevoke = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ id: z.string().min(1) }))
  .handler(async ({ input, context }) => {
    const orgId = context.org.id;

    const ok = await isCourseManager(context.user.id, orgId);
    if (!ok) {
      throw new ORPCError("FORBIDDEN", {
        message: "Apenas owner/moderador pode revogar acesso livre",
      });
    }

    const entry = await prisma.nasaRouteFreeAccess.findUnique({
      where: { id: input.id },
      select: { creatorOrgId: true },
    });
    if (!entry || entry.creatorOrgId !== orgId) {
      throw new ORPCError("NOT_FOUND", { message: "Entry não encontrada" });
    }

    await prisma.nasaRouteFreeAccess.delete({ where: { id: input.id } });
    return { ok: true };
  });
