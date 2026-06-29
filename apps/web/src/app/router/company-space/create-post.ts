import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { orgAdminGuard } from "./middlewares/org-admin-guard";

/**
 * Cria um CompanyPost (news). Slug é gerado automaticamente a partir
 * do título; caso colida, adiciona sufixo numérico até ficar único.
 * `content` é JSON (TipTap).
 */
export const createPost = base
  .use(orgAdminGuard)
  .input(
    z.object({
      orgId: z.string().min(1),
      title: z.string().min(1).max(200),
      excerpt: z.string().max(500).nullable().optional(),
      content: z.any(),
      coverUrl: z.string().url().nullable().optional(),
      isPublished: z.boolean().optional().default(false),
    }),
  )
  .handler(async ({ input, context }) => {
    const baseSlug = input.title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "post";

    // Garante slug único
    let slug = baseSlug;
    let i = 1;
    // Limitar a 50 tentativas para não loop infinito
    while (i < 50) {
      const clash = await prisma.companyPost.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!clash) break;
      i += 1;
      slug = `${baseSlug}-${i}`;
    }

    const post = await prisma.companyPost.create({
      data: {
        orgId: context.orgId,
        authorId: context.user.id,
        title: input.title,
        slug,
        excerpt: input.excerpt ?? null,
        content: input.content,
        coverUrl: input.coverUrl ?? null,
        isPublished: input.isPublished ?? false,
        publishedAt: input.isPublished ? new Date() : null,
      },
    });

    return post;
  });
