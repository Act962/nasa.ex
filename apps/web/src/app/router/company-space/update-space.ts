import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { orgAdminGuard } from "./middlewares/org-admin-guard";

/**
 * Atualiza os campos da Spacehome da empresa.
 * Limita quem pode editar via `orgAdminGuard` (owner/admin only).
 */
export const updateSpace = base
  .use(orgAdminGuard)
  .input(
    z.object({
      orgId: z.string().min(1),
      bio: z.string().max(500).nullable().optional(),
      bannerUrl: z.string().url().nullable().optional(),
      website: z.string().max(500).nullable().optional(),
      spacehomeTemplate: z
        .enum(["default", "corporate", "creative"])
        .optional(),
      nasaPageId: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const updated = await prisma.organization.update({
      where: { id: context.orgId },
      data: {
        ...(input.bio !== undefined ? { bio: input.bio } : {}),
        ...(input.bannerUrl !== undefined ? { bannerUrl: input.bannerUrl } : {}),
        ...(input.website !== undefined ? { website: input.website } : {}),
        ...(input.spacehomeTemplate
          ? { spacehomeTemplate: input.spacehomeTemplate }
          : {}),
        ...(input.nasaPageId !== undefined
          ? { nasaPageId: input.nasaPageId }
          : {}),
      },
      select: {
        id: true,
        bio: true,
        bannerUrl: true,
        website: true,
        spacehomeTemplate: true,
        nasaPageId: true,
        isSpacehomePublic: true,
      },
    });

    return updated;
  });
