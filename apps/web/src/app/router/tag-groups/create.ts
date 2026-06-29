import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Cor inválida (use #RRGGBB)");

export const createTagGroup = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      name: z.string().trim().min(1).max(60),
      color: hexColor.default("#6366f1"),
      icon: z.string().trim().nullable().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    // `order` default = MAX(order)+1 — novo grupo vai pro fim da lista.
    const lastOrder = await prisma.tagGroup.findFirst({
      where: { organizationId: context.org.id },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    try {
      const group = await prisma.tagGroup.create({
        data: {
          name: input.name,
          color: input.color,
          icon: input.icon ?? null,
          organizationId: context.org.id,
          order: (lastOrder?.order ?? -1) + 1,
        },
      });
      return { group };
    } catch (err: unknown) {
      // Unique constraint (name, organization_id) — nome duplicado
      const code =
        err instanceof Error && "code" in err
          ? (err as { code?: string }).code
          : undefined;
      if (code === "P2002") {
        throw errors.BAD_REQUEST({
          message: `Já existe um grupo chamado "${input.name}"`,
        });
      }
      throw err;
    }
  });
