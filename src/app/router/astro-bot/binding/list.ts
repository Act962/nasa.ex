import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { assertOrgAdmin } from "../_require-admin";

/**
 * Lista os números da allow-list do Astro. `scope: "org"` (todos da org) é
 * restrito a owner/admin; `scope: "mine"` lista os do próprio usuário.
 */
export const listBindings = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      scope: z.enum(["mine", "org"]).default("mine"),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    if (input.scope === "org") {
      await assertOrgAdmin({
        organizationId: context.org.id,
        userId: context.user.id,
        errors,
      });
    }

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
