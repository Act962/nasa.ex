import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { logActivity } from "@/features/admin/lib/activity-logger";
import type { AstroAction, AstroActionResult } from "../types";
import { inferPolarity } from "../infer-polarity";
import { resolveSingleLead } from "./resolve-lead";

// Favoritar lead (spec 0024, onda 1). Favorito não é campo próprio: é a tag
// canônica "Favoritas", que é como o filtro `favoritesOnly` do chat já lê.
// Criar um booleano aqui produziria duas verdades sobre a mesma coisa.

const FAVORITE_TAG_NAME = "Favoritas";
const FAVORITE_TAG_SLUG = "favoritas";
const FAVORITE_TAG_COLOR = "#f59e0b";

/** Mesma heurística do `toggle-favorite.ts`, que aceita variantes da org. */
function isFavoriteTag(name?: string | null, slug?: string | null): boolean {
  return /favorit|star/i.test(name ?? "") || /favorit|star/i.test(slug ?? "");
}

const inputSchema = z.object({
  leadName: z.string().trim().min(2).describe("Nome do lead. Pode ser parcial."),
  favorite: z
    .boolean()
    .describe("true para favoritar, false para desfavoritar."),
});

export const toggleLeadFavoriteAction: AstroAction<typeof inputSchema> = {
  key: "lead.toggle_favorite",
  app: "leads",
  toolName: "toggle_lead_favorite",
  description:
    "Favorita ou desfavorita um lead. " +
    "Use quando o usuário disser 'favorita o Fulano', 'marca o Fulano como favorito', " +
    "'tira o Fulano dos favoritos'.",
  permission: { appKey: "tracking", action: "edit" },
  requiresConfirmation: false,
  input: inputSchema,
  inferFields: (text) =>
    inferPolarity(text, "favorite", /\b(desfavorit|tira\w*\s+d\w*\s+favorit|remove\w*\s+d\w*\s+favorit)/i, /\bfavorit/i),

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const resolved = await resolveSingleLead({
      ctx,
      name: input.leadName,
      field: "leadName",
      appName: "Tracking",
    });
    if ("failure" in resolved) return resolved.failure;
    const lead = resolved.lead;

    const attachedTags = await prisma.leadTag.findMany({
      where: { leadId: lead.id },
      select: { tagId: true, tag: { select: { name: true, slug: true } } },
    });
    const currentFavoriteIds = attachedTags
      .filter((leadTag) => isFavoriteTag(leadTag.tag.name, leadTag.tag.slug))
      .map((leadTag) => leadTag.tagId);
    const isFavorite = currentFavoriteIds.length > 0;

    if (isFavorite === input.favorite) {
      return {
        status: "done",
        title: input.favorite ? "Já era favorito" : "Já não era favorito",
        description: `"${lead.name}" já está como você pediu. Nada mudou.`,
        internalUrl: `/contatos/${lead.id}`,
        appName: "Tracking",
      };
    }

    if (dryRun) {
      return {
        status: "done",
        title: input.favorite ? "Favoritar lead" : "Desfavoritar lead",
        description: `"${lead.name}" será ${input.favorite ? "favoritado" : "desfavoritado"}.`,
        appName: "Tracking",
      };
    }

    if (!input.favorite) {
      await prisma.leadTag.deleteMany({
        where: { leadId: lead.id, tagId: { in: currentFavoriteIds } },
      });
    } else {
      // Reusa a tag existente antes de criar — a org pode ter "VIP" ou
      // "Favoritos" no lugar do nome canônico.
      const existing = await prisma.tag.findFirst({
        where: {
          organizationId: lead.tracking.organizationId,
          trackingId: lead.trackingId,
          OR: [
            { slug: FAVORITE_TAG_SLUG },
            { name: { contains: "favorit", mode: "insensitive" } },
            { slug: { contains: "favorit", mode: "insensitive" } },
          ],
        },
        select: { id: true },
      });

      const tag =
        existing ??
        (await prisma.tag.create({
          data: {
            name: FAVORITE_TAG_NAME,
            slug: FAVORITE_TAG_SLUG,
            color: FAVORITE_TAG_COLOR,
            organizationId: lead.tracking.organizationId,
            trackingId: lead.trackingId,
          },
          select: { id: true },
        }));

      await prisma.leadTag.upsert({
        where: { leadId_tagId: { leadId: lead.id, tagId: tag.id } },
        create: { leadId: lead.id, tagId: tag.id },
        update: {},
      });
    }

    const actor = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { name: true, email: true, image: true },
    });

    await logActivity({
      organizationId: lead.tracking.organizationId,
      userId: ctx.userId,
      userName: actor?.name ?? "—",
      userEmail: actor?.email ?? "—",
      userImage: actor?.image,
      appSlug: "tracking",
      subAppSlug: "tracking-chat",
      featureKey: input.favorite ? "lead.favorited" : "lead.unfavorited",
      action: input.favorite ? "lead.favorited" : "lead.unfavorited",
      actionLabel: `${input.favorite ? "Favoritou" : "Desfavoritou"} "${lead.name}" pelo Astro`,
      resource: lead.name,
      resourceId: lead.id,
      metadata: { via: "astro", trackingName: lead.tracking.name },
    });

    return {
      status: "done",
      title: input.favorite ? "Lead favoritado" : "Lead desfavoritado",
      description: `"${lead.name}" ${input.favorite ? "entrou nos" : "saiu dos"} favoritos.`,
      internalUrl: `/contatos/${lead.id}`,
      appName: "Tracking",
    };
  },
};
