import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { requireOrgMiddleware } from "../../middlewares/org";

export const listTags = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/tags",
  })
  .input(
    z.object({
      query: z
        .object({
          /** Filtra tags vinculadas a um tracking específico (legacy).
           *  Default (omitido): traz tags org-wide + tracking-scoped. */
          trackingId: z.string().optional(),
          /** Filtra por grupo. `null` explícito = tags sem grupo. */
          tagGroupId: z.string().nullable().optional(),
          /** Quando true, inclui tags arquivadas (archivedAt != null).
           *  Default false — pickers/automation só veem ativas. */
          includeArchived: z.boolean().optional().default(false),
          /** Quando true, retorna SÓ arquivadas (excluindo ativas).
           *  Usado pela aba "Arquivadas" do TagSheet. */
          onlyArchived: z.boolean().optional().default(false),
        })
        .optional(),
    }),
  )

  .handler(async ({ input, context, errors }) => {
    try {
      const includeArchived = input.query?.includeArchived ?? false;
      const onlyArchived = input.query?.onlyArchived ?? false;

      // Constrói filtro de soft-delete:
      //  - onlyArchived → só arquivadas
      //  - includeArchived → todas (ativas + arquivadas)
      //  - default → só ativas (archivedAt = null)
      const archivedFilter = onlyArchived
        ? { archivedAt: { not: null } }
        : includeArchived
          ? {}
          : { archivedAt: null };

      const tags = await prisma.tag.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          color: true,
          whatsappId: true,
          description: true,
          icon: true,
          type: true,
          organizationId: true,
          trackingId: true,
          tagGroupId: true,
          archivedAt: true,
          // Conta leads vinculados (LeadTag) — pra mostrar badge "N lead(s)"
          // ao lado do contador de automações na UI do TagSheet.
          _count: { select: { leadTags: true } },
        },
        where: {
          organizationId: context.org.id,
          ...(input.query?.trackingId && {
            trackingId: input.query.trackingId,
          }),
          ...(input.query?.tagGroupId !== undefined && {
            tagGroupId: input.query.tagGroupId,
          }),
          ...archivedFilter,
        },
        orderBy: {
          name: "asc",
        },
      });

      // Contagem de automações ATIVAS referenciando cada tag — alerta visual
      // pro user antes de arquivar/editar. Workflows armazenam tagId/tagIds
      // em Node.data JSON; query agregada com $queryRaw pra usar operadores
      // JSON do Postgres (?, ->>) que o Prisma client ainda não expõe nativamente.
      const tagIds = tags.map((t) => t.id);
      let automationCountByTag = new Map<string, number>();
      if (tagIds.length > 0) {
        try {
          const counts = await prisma.$queryRaw<
            Array<{ tag_id: string; count: bigint }>
          >`
            SELECT t.id AS tag_id, COUNT(DISTINCT w.id)::bigint AS count
            FROM tags t
            LEFT JOIN nodes n
              ON n.type IN ('TAG', 'LEAD_TAGGED')
              AND (
                (n.data::jsonb->>'tagId') = t.id
                OR (n.data::jsonb->'tagIds') ? t.id
              )
            LEFT JOIN workflows w
              ON w.id = n.workflow_id AND w.is_active = true
            WHERE t.id = ANY(${tagIds}::text[])
            GROUP BY t.id
          `;
          automationCountByTag = new Map(
            counts.map((r) => [r.tag_id, Number(r.count)]),
          );
        } catch (err) {
          // Schema drift / Node table sem coluna `workflow_id` em alguma migration —
          // não bloqueia a listagem, só perde o contador visual. Log + continua.
          console.warn("[tags.list] automationCount query falhou:", err);
        }
      }

      return {
        tags: tags.map(({ _count, ...tag }) => ({
          ...tag,
          color: tag.color ?? "#1447e6",
          isArchived: tag.archivedAt !== null,
          leadCount: _count.leadTags,
          automationCount: automationCountByTag.get(tag.id) ?? 0,
        })),
      };
    } catch (error) {
      if (error === errors.BAD_REQUEST || error === errors.UNAUTHORIZED) {
        throw error;
      }
      if (error instanceof Error) {
        if (
          error.message.includes("connection") ||
          error.message.includes("timeout")
        ) {
          throw errors.INTERNAL_SERVER_ERROR;
        }
      }
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
