import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import {
  getMetaConversionTagId,
  setMetaConversionTagId,
} from "./_conversion-tag";

/**
 * Procedures pra ler/escrever a tag de conversão usada nos insights Meta.
 * Apenas owner/admin da org pode mudar (deveria ser quem configura integração).
 */

export const getConversionTag = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const tagId = await getMetaConversionTagId(context.org.id);
    if (!tagId) return { tag: null };

    const tag = await prisma.tag.findFirst({
      where: { id: tagId, organizationId: context.org.id },
      select: { id: true, name: true, slug: true, color: true },
    });
    return { tag };
  });

export const setConversionTag = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      tagId: z.string().nullable(),
    }),
  )
  .handler(async ({ input, context }) => {
    // Validar role (só owner/admin pode mexer)
    const member = (context.org.members as Array<{ userId: string; role: string }>).find(
      (m) => m.userId === context.user.id,
    );
    if (!member || !["owner", "admin"].includes(member.role)) {
      throw new Error("Apenas owners/admins podem alterar a tag de conversão");
    }

    // Validar que a tag existe e pertence à org
    if (input.tagId) {
      const tag = await prisma.tag.findFirst({
        where: { id: input.tagId, organizationId: context.org.id },
        select: { id: true },
      });
      if (!tag) throw new Error("Tag não encontrada");
    }

    await setMetaConversionTagId(context.org.id, input.tagId);
    return { success: true };
  });
