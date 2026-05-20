import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";

type CopyTarget = {
  workspaceId: string;
  columnId: string;
  organizationId: string;
  order: Prisma.Decimal;
  createdBy: string;
};

/**
 * Copia uma Action de uma org pra outra preservando todos os dados ricos
 * do evento: descrição, datas, tipo, prioridade, dados de evento público,
 * anexos, links, capa, vídeo, sub-ações e seus grupos.
 *
 * Não copia (intencional): responsibles/participants extras (usuários da
 * org de origem não existem na destino), tags (`WorkspaceTag` é escopada
 * por workspace), `formId` (referência a Form da org de origem), `history`,
 * `publicSlug`/`publishedAt`/`isFavorited`/`isArchived`.
 */
export async function copyActionToOrg(
  sourceActionId: string,
  target: CopyTarget,
) {
  const source = await prisma.action.findUnique({
    where: { id: sourceActionId },
    include: {
      subActionGroups: { orderBy: { order: "asc" } },
      subActions: { orderBy: { order: "asc" } },
    },
  });
  if (!source) throw new Error("Ação de origem não encontrada");

  return prisma.$transaction(async (tx) => {
    const copied = await tx.action.create({
      data: {
        title: source.title,
        description: source.description,
        type: source.type,
        priority: source.priority,
        startDate: source.startDate,
        dueDate: source.dueDate,
        endDate: source.endDate,
        workspaceId: target.workspaceId,
        columnId: target.columnId,
        organizationId: target.organizationId,
        order: target.order,
        createdBy: target.createdBy,
        attachments: source.attachments as Prisma.InputJsonValue,
        links: source.links as Prisma.InputJsonValue,
        coverImage: source.coverImage,
        youtubeUrl: source.youtubeUrl,
        isPublic: source.isPublic,
        eventCategory: source.eventCategory ?? undefined,
        country: source.country ?? undefined,
        state: source.state ?? undefined,
        city: source.city ?? undefined,
        address: source.address ?? undefined,
        registrationUrl: source.registrationUrl ?? undefined,
        participants: {
          create: [{ userId: target.createdBy }],
        },
      },
    });

    const groupIdMap = new Map<string, string>();
    for (const g of source.subActionGroups) {
      const created = await tx.subActionGroup.create({
        data: {
          name: g.name,
          order: g.order,
          isOpen: g.isOpen,
          actionId: copied.id,
        },
      });
      groupIdMap.set(g.id, created.id);
    }

    for (const s of source.subActions) {
      await tx.subActions.create({
        data: {
          title: s.title,
          description: s.description,
          isDone: s.isDone,
          finishDate: s.finishDate,
          order: s.order,
          actionId: copied.id,
          groupId: s.groupId ? (groupIdMap.get(s.groupId) ?? null) : null,
        },
      });
    }

    return copied;
  });
}
