import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { orgAdminGuard } from "./middlewares/org-admin-guard";

/**
 * Atualiza um CompanyPost existente. Se `isPublished` mudar de false
 * para true, seta `publishedAt=now` (a não ser que já exista).
 */
export const updatePost = base
  .use(orgAdminGuard)
  .input(
    z.object({
      orgId: z.string().min(1),
      postId: z.string().min(1),
      title: z.string().min(1).max(200).optional(),
      excerpt: z.string().max(500).nullable().optional(),
      content: z.any().optional(),
      coverUrl: z.string().url().nullable().optional(),
      isPublished: z.boolean().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const existing = await prisma.companyPost.findFirst({
      where: { id: input.postId, orgId: context.orgId },
      select: { id: true, isPublished: true, publishedAt: true },
    });
    if (!existing) throw errors.NOT_FOUND({ message: "Post não encontrado." });

    const goingLive =
      input.isPublished === true &&
      !existing.isPublished &&
      !existing.publishedAt;

    const updated = await prisma.companyPost.update({
      where: { id: existing.id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.excerpt !== undefined ? { excerpt: input.excerpt } : {}),
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.coverUrl !== undefined ? { coverUrl: input.coverUrl } : {}),
        ...(input.isPublished !== undefined
          ? { isPublished: input.isPublished }
          : {}),
        ...(goingLive ? { publishedAt: new Date() } : {}),
      },
    });

    return updated;
  });
