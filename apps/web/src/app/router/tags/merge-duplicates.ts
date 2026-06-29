import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { base } from "@/app/middlewares/base";
import { logActivity } from "@/features/admin/lib/activity-logger";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Mescla N tags duplicadas: user escolhe `survivorId` + lista de `victimIds`.
 *
 * Operações (em transação atômica):
 *  1. Redireciona TODOS os `LeadTag` das vítimas pro sobrevivente
 *     (skipDuplicates pra não estourar unique [leadId, tagId])
 *  2. Atualiza `Node.data` JSON em workflows: troca tagId/tagIds das
 *     vítimas pelo survivorId (preserva automações)
 *  3. Deleta as vítimas (cascade dispara mas lead_tags já redirecionadas)
 *
 * Validações:
 *  - Todas as tags (survivor + victims) devem ser da MESMA organização
 *  - `survivorId` não pode estar em `victimIds`
 *  - victimIds não pode estar vazio
 *
 * Não é destrutivo do ponto de vista de leads/workflows — só remove
 * registros redundantes de Tag. Histórico em LeadJourneyEvent é
 * preservado (metadata.tagId pode virar órfão mas tagName/tagColor
 * continuam renderizando).
 */
export const mergeDuplicateTags = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      survivorId: z.string(),
      victimIds: z.array(z.string()).min(1),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    if (input.victimIds.includes(input.survivorId)) {
      throw errors.BAD_REQUEST({
        message: "Sobrevivente não pode estar entre as vítimas",
      });
    }

    const allIds = [input.survivorId, ...input.victimIds];
    const tags = await prisma.tag.findMany({
      where: { id: { in: allIds }, organizationId: context.org.id },
      select: { id: true, name: true, organizationId: true },
    });

    if (tags.length !== allIds.length) {
      throw errors.NOT_FOUND({
        message: "Alguma tag não encontrada ou de outra organização",
      });
    }

    // Sanity: todas as tags devem ter o MESMO nome (senão não são duplicatas).
    const names = new Set(tags.map((t) => t.name));
    if (names.size > 1) {
      throw errors.BAD_REQUEST({
        message: "Tags têm nomes diferentes — não são duplicatas",
      });
    }
    const tagName = tags[0].name;

    // Transação atômica
    const result = await prisma.$transaction(async (tx) => {
      // 1. Redireciona lead_tags — pra cada vítima, move pro sobrevivente
      // (skipDuplicates evita violar unique [leadId, tagId])
      let redirectedLeadTags = 0;
      for (const victimId of input.victimIds) {
        const victimLeadTags = await tx.leadTag.findMany({
          where: { tagId: victimId },
          select: { leadId: true },
        });
        if (victimLeadTags.length > 0) {
          const inserted = await tx.leadTag.createMany({
            data: victimLeadTags.map((lt) => ({
              leadId: lt.leadId,
              tagId: input.survivorId,
            })),
            skipDuplicates: true,
          });
          redirectedLeadTags += inserted.count;
        }
      }

      // 2. Atualiza Node.data JSON nos workflows (TAG + LEAD_TAGGED).
      //    Lida com 2 shapes: tagId (single) e tagIds (array).
      //    Usa $queryRawUnsafe pra ter os operadores JSON do Postgres
      //    (Prisma client ainda não expõe ? e ->> nativamente).
      const victimIdsArr = `{${input.victimIds.map((id) => `"${id}"`).join(",")}}`;
      // Single tagId
      await tx.$executeRawUnsafe(
        `UPDATE nodes
         SET data = jsonb_set(data::jsonb, '{tagId}', to_jsonb($1::text))
         WHERE type IN ('TAG', 'LEAD_TAGGED')
           AND (data::jsonb->>'tagId') = ANY($2::text[])`,
        input.survivorId,
        input.victimIds,
      );
      // Array tagIds — substitui ocorrências, deduplica.
      await tx.$executeRawUnsafe(
        `UPDATE nodes n
         SET data = jsonb_set(
           n.data::jsonb,
           '{tagIds}',
           (
             SELECT to_jsonb(ARRAY_AGG(DISTINCT
               CASE WHEN elem = ANY($1::text[]) THEN $2::text ELSE elem END
             ))
             FROM jsonb_array_elements_text(n.data::jsonb->'tagIds') AS elem
           )
         )
         WHERE n.type IN ('TAG', 'LEAD_TAGGED')
           AND n.data::jsonb ? 'tagIds'
           AND EXISTS (
             SELECT 1 FROM jsonb_array_elements_text(n.data::jsonb->'tagIds') AS e
             WHERE e = ANY($1::text[])
           )`,
        input.victimIds,
        input.survivorId,
      );

      // 3. Deleta as vítimas (cascade em lead_tags só remove as redundantes
      //    que sobraram com tagId apontando pra vítima — as relevantes já
      //    foram redirecionadas no passo 1).
      const deleted = await tx.tag.deleteMany({
        where: {
          id: { in: input.victimIds },
          organizationId: context.org.id,
        },
      });

      return {
        deletedCount: deleted.count,
        redirectedLeadTags,
      };
    });

    // Log activity (auditoria)
    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "tracking",
      subAppSlug: "tracking-tags",
      featureKey: "tag.merged",
      action: "tag.merged",
      actionLabel: `Mesclou ${result.deletedCount} duplicata(s) da tag "${tagName}"`,
      resource: tagName,
      resourceId: input.survivorId,
      metadata: {
        survivorId: input.survivorId,
        victimIds: input.victimIds,
        redirectedLeadTags: result.redirectedLeadTags,
      },
    });

    return {
      survivorId: input.survivorId,
      deletedCount: result.deletedCount,
      redirectedLeadTags: result.redirectedLeadTags,
    };
  });
