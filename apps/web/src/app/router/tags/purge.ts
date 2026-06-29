import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { logActivity } from "@/features/admin/lib/activity-logger";
import prisma from "@/lib/prisma";
import z from "zod";

/**
 * `tag.purge` — HARD DELETE de uma tag previamente arquivada.
 *
 * Diferente do `tag.delete` (que faz soft via `archivedAt`), `purge` apaga
 * fisicamente: cascade em `LeadTag` é executado e a tag some do banco.
 * `LeadJourneyEvent` permanece com `metadata.tagName/tagColor` (capturados
 * no momento do evento), então a Jornada do lead ainda mostra a operação
 * histórica — só não consegue resolver `tagId` pra link clicável.
 *
 * Pré-condição: tag DEVE estar arquivada (`archivedAt != null`). Bloqueia
 * purge de tag ativa pra forçar o user a soft-delete primeiro e revisar
 * automações que dependem dela (via UI).
 *
 * Permissão: qualquer membro autenticado da org dona da tag — futuramente
 * podemos restringir a "admin" via `requireOrgRoleMiddleware`, mas o
 * dialog de confirmação dupla no front já dá fricção suficiente.
 */
export const purgeTag = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      tagId: z.string(),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    const tag = await prisma.tag.findUnique({
      where: { id: input.tagId },
    });

    if (!tag) {
      throw errors.NOT_FOUND({ message: "Tag não encontrada" });
    }

    if (!tag.archivedAt) {
      throw errors.BAD_REQUEST({
        message:
          "Arquive a tag primeiro antes de excluir permanentemente. Isso garante revisão das automações que dependem dela.",
      });
    }

    const deleted = await prisma.tag.delete({
      where: { id: input.tagId },
    });

    await logActivity({
      organizationId: tag.organizationId,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "tracking",
      subAppSlug: "tracking-tags",
      featureKey: "tag.purged",
      action: "tag.purged",
      actionLabel: `Excluiu permanentemente a tag "${tag.name}"`,
      resource: tag.name,
      resourceId: tag.id,
      metadata: {
        trackingId: tag.trackingId ?? undefined,
        color: tag.color ?? undefined,
        archivedAt: tag.archivedAt?.toISOString() ?? null,
      },
    });

    return deleted;
  });
