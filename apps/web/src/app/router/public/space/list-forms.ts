import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { spaceVisibilityGuard } from "./middlewares/visibility-guard";

/**
 * Lista forms publicados de uma empresa para a Spacehome.
 * Usado no `card-forms` com tabs tipo "Trabalhe conosco" / "Fale com comercial".
 */
export const listForms = base
  .use(spaceVisibilityGuard)
  .input(
    z.object({
      nick: z.string().min(1),
    }),
  )
  .handler(async ({ context }) => {
    const forms = await prisma.form.findMany({
      where: {
        organizationId: context.organization.id,
        published: true,
        isTemplate: false,
        isPublicOnSpace: true,   // só forms aprovados pelo dono p/ exibição pública
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        shareUrl: true,
        views: true,
        responses: true,
        createdAt: true,
      },
    });
    return { forms };
  });
