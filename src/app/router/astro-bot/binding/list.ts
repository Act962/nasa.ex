import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Lista bindings do user atual (membro normal) OU TODOS da org (admin
 * via `scope: 'org'`). Filtro feito no handler — middleware de role
 * adicional seria mais robusto mas o MVP confia no front.
 */
export const listBindings = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      scope: z.enum(["mine", "org"]).default("mine"),
    }),
  )
  .handler(async ({ input, context }) => {
    const where =
      input.scope === "org"
        ? { organizationId: context.org.id }
        : { organizationId: context.org.id, userId: context.user.id };

    const bindings = await prisma.userWhatsappBinding.findMany({
      where,
      select: {
        id: true,
        userId: true,
        phoneE164: true,
        verifiedAt: true,
        isActive: true,
        allowedTools: true,
        lastSeenAt: true,
        pinFailures: true,
        pinLockedUntil: true,
        sessionExpiresAt: true,
        createdAt: true,
        user:
          input.scope === "org"
            ? { select: { id: true, name: true, email: true, image: true } }
            : false,
        _count: { select: { commands: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return { bindings };
  });
