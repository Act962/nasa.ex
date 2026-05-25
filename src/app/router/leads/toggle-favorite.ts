import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logActivity } from "@/features/admin/lib/activity-logger";

/**
 * Toggle "Favoritar lead" no contexto do `/tracking-chat`.
 *
 * Semântica: "favorita" é uma **tag** com slug `favoritas` (ou nome
 * contendo "favorit"/"star") attachada ao lead. Mesma heurística que
 * `conversation/list.ts` usa pro filtro `favoritesOnly`, garantindo
 * que o estado visual da estrela = estado do filtro.
 *
 * Fluxo:
 *  - Se o lead já tem alguma tag "favorita" → remove TODAS as variantes
 *    detectadas (evita "fantasma" se houver tags duplicadas com nomes
 *    parecidos).
 *  - Se NÃO tem → garante uma tag canônica `Favoritas` (slug `favoritas`)
 *    no tracking do lead e attacha. Cria a tag on-demand se não existir.
 *
 * Cobra 0★ — operação interna de organização do inbox.
 *
 * Idempotente do ponto de vista do `isFavorite` resultante: chamadas
 * repetidas com mesmo input alternam o estado, e o response retorna o
 * estado final pra UI sincronizar sem refetch.
 */

const FAVORITE_TAG_SLUG = "favoritas";
const FAVORITE_TAG_NAME = "Favoritas";

/** Bate com a heurística do `conversation/list.ts` filtro favoritesOnly. */
function isFavoriteTagName(name?: string | null, slug?: string | null) {
  const n = (name ?? "").toLowerCase();
  const s = (slug ?? "").toLowerCase();
  return /favorit|star/.test(n) || /favorit|star/.test(s);
}

export const toggleFavorite = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    path: "/leads/toggle-favorite",
    summary: "Favorita/desfavorita lead via tag canônica 'Favoritas'",
    tags: ["Leads"],
  })
  .input(
    z.object({
      leadId: z.string().min(1),
    }),
  )
  .output(
    z.object({
      isFavorite: z.boolean(),
      tagId: z.string().nullable(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const lead = await prisma.lead.findUnique({
      where: { id: input.leadId },
      select: {
        id: true,
        name: true,
        trackingId: true,
        tracking: { select: { organizationId: true, name: true } },
        leadTags: {
          select: {
            tagId: true,
            tag: { select: { name: true, slug: true } },
          },
        },
      },
    });
    if (!lead) {
      throw errors.NOT_FOUND({ message: "Lead não encontrado" });
    }
    if (lead.tracking.organizationId !== context.org.id) {
      throw errors.FORBIDDEN({ message: "Sem permissão pra esse lead" });
    }

    // Detecta TODAS as tags "favoritas" attachadas atualmente — pode ter
    // mais de uma se a org tem variantes ("VIP Stars", "Favoritos").
    const currentFavoriteTagIds = lead.leadTags
      .filter((lt) => isFavoriteTagName(lt.tag.name, lt.tag.slug))
      .map((lt) => lt.tagId);

    const isCurrentlyFavorite = currentFavoriteTagIds.length > 0;

    if (isCurrentlyFavorite) {
      // ── Unfavorite: remove TODAS as tags "favoritas" do lead ──
      await prisma.leadTag.deleteMany({
        where: {
          leadId: lead.id,
          tagId: { in: currentFavoriteTagIds },
        },
      });

      logActivity({
        organizationId: lead.tracking.organizationId,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: (context.user as any).image ?? null,
        appSlug: "tracking",
        subAppSlug: "tracking-chat",
        featureKey: "lead.unfavorited",
        action: "lead.unfavorited",
        actionLabel: `Desfavoritou "${lead.name}"`,
        resource: lead.name,
        resourceId: lead.id,
        metadata: {
          trackingName: lead.tracking.name,
          removedTagIds: currentFavoriteTagIds,
        },
      }).catch(() => {});

      return { isFavorite: false, tagId: null };
    }

    // ── Favorite: garante a tag canônica "Favoritas" e attacha ──
    // Procura por slug primeiro (mais estável que name), depois por
    // qualquer tag "favorita" existente no tracking pra reusar variantes.
    let favoriteTag = await prisma.tag.findFirst({
      where: {
        organizationId: lead.tracking.organizationId,
        trackingId: lead.trackingId,
        OR: [
          { slug: FAVORITE_TAG_SLUG },
          { name: { contains: "favorit", mode: "insensitive" } },
          { slug: { contains: "favorit", mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, slug: true },
    });

    if (!favoriteTag) {
      // Cria on-demand. Cor amarela combina com a estrela visual.
      favoriteTag = await prisma.tag.create({
        data: {
          name: FAVORITE_TAG_NAME,
          slug: FAVORITE_TAG_SLUG,
          color: "#f59e0b",
          organizationId: lead.tracking.organizationId,
          trackingId: lead.trackingId,
        },
        select: { id: true, name: true, slug: true },
      });
    }

    // Attach (idempotente via @@unique([leadId, tagId]))
    await prisma.leadTag.upsert({
      where: { leadId_tagId: { leadId: lead.id, tagId: favoriteTag.id } },
      create: { leadId: lead.id, tagId: favoriteTag.id },
      update: {},
    });

    logActivity({
      organizationId: lead.tracking.organizationId,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image ?? null,
      appSlug: "tracking",
      subAppSlug: "tracking-chat",
      featureKey: "lead.favorited",
      action: "lead.favorited",
      actionLabel: `Favoritou "${lead.name}"`,
      resource: lead.name,
      resourceId: lead.id,
      metadata: {
        trackingName: lead.tracking.name,
        tagId: favoriteTag.id,
        tagName: favoriteTag.name,
      },
    }).catch(() => {});

    return { isFavorite: true, tagId: favoriteTag.id };
  });
