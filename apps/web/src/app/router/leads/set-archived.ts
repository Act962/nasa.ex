import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logActivity } from "@/features/admin/lib/activity-logger";

/**
 * Toggle de **arquivamento de lead** (diferente da `archive.ts` legacy
 * que faz soft-delete via `currentAction: DELETED`).
 *
 * Semântica do "arquivado" aqui:
 *  - Lead some da lista padrão do `/tracking-chat` (`conversation.list`
 *    filtra `lead.isArchived = false` por default)
 *  - Aparece SÓ no filtro "Arquivados" da sidebar
 *  - Na `/contatos`, fica com badge "Arquivado" ao lado do nome
 *  - Mensagens novas dele continuam chegando no DB, mas só visíveis
 *    dentro do filtro Arquivados
 *  - Reversível via `setArchived({ isArchived: false })`
 *
 * Não usa `currentAction` nem `statusFlow` — é orthogonal ao fluxo de
 * status. Um lead pode estar ARQUIVADO + ACTIVE no statusFlow ao mesmo
 * tempo (arquivamento é uma camada extra de visibilidade).
 *
 * Cobra 0★ (operação interna de organização).
 */

export const setArchived = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    path: "/leads/set-archived",
    summary: "Toggle arquivamento de lead (visibilidade no tracking-chat)",
    tags: ["Leads"],
  })
  .input(
    z.object({
      leadId: z.string().min(1),
      isArchived: z.boolean(),
    }),
  )
  .output(
    z.object({
      lead: z.object({
        id: z.string(),
        isArchived: z.boolean(),
        archivedAt: z.date().nullable(),
      }),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    // Valida que o lead existe + pertence à org do user
    const existing = await prisma.lead.findUnique({
      where: { id: input.leadId },
      select: {
        id: true,
        name: true,
        isArchived: true,
        tracking: { select: { organizationId: true, name: true } },
      },
    });
    if (!existing) {
      throw errors.NOT_FOUND({ message: "Lead não encontrado" });
    }
    if (existing.tracking.organizationId !== context.org.id) {
      throw errors.FORBIDDEN({ message: "Sem permissão pra esse lead" });
    }

    // No-op se já está no estado desejado — evita log + history poluído
    if (existing.isArchived === input.isArchived) {
      return {
        lead: {
          id: existing.id,
          isArchived: existing.isArchived,
          archivedAt: null, // já estava no estado; histórico não disponível aqui
        },
      };
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Atualiza flags do lead
      const lead = await tx.lead.update({
        where: { id: input.leadId },
        data: {
          isArchived: input.isArchived,
          archivedAt: input.isArchived ? new Date() : null,
        },
        select: { id: true, isArchived: true, archivedAt: true },
      });
      // Histórico (auditoria visual em /contatos/[id]). Mantém o lead
      // como `ACTIVE` no `LeadAction` — arquivar é OUTRO eixo (visibilidade
      // no inbox), não muda o status do funil. O `notes` deixa claro o
      // que aconteceu. `LeadAction` só tem ACTIVE/DELETED/WON/LOST hoje.
      await tx.leadHistory.create({
        data: {
          leadId: input.leadId,
          notes: input.isArchived
            ? "Lead arquivado pelo chat"
            : "Lead desarquivado",
          userId: context.user.id,
          action: "ACTIVE",
        },
      });
      return lead;
    });

    // Log de organização (Insights / Activity feed)
    await logActivity({
      organizationId: existing.tracking.organizationId,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "tracking",
      subAppSlug: "tracking-chat",
      featureKey: input.isArchived ? "lead.chat_archived" : "lead.chat_unarchived",
      action: input.isArchived ? "lead.chat_archived" : "lead.chat_unarchived",
      actionLabel: input.isArchived
        ? `Arquivou "${existing.name}" no chat`
        : `Desarquivou "${existing.name}" no chat`,
      resource: existing.name,
      resourceId: existing.id,
      metadata: { trackingName: existing.tracking.name },
    });

    return { lead: updated };
  });
