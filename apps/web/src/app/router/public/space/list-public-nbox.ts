import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { spaceVisibilityGuard } from "./middlewares/visibility-guard";

/**
 * Itens N-Box marcados como públicos por uma empresa.
 *
 * Para baixar o arquivo, o visitante usa `/api/nbox/public/[token]`
 * que valida `is_public=true` no endpoint dedicado.
 */
export const listPublicNBox = base
  .use(spaceVisibilityGuard)
  .input(z.object({ nick: z.string().min(1) }))
  .handler(async ({ context }) => {
    const items = await prisma.nBoxItem.findMany({
      where: { organizationId: context.organization.id, isPublic: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        mimeType: true,
        size: true,
        publicToken: true,
        tags: true,
        createdAt: true,
      },
    });
    return { items };
  });
