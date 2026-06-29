import { base } from "@/app/middlewares/base";
import { optionalAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Retorna o evento público + dados de viewer (`canEdit`, `isCreator`,
 * `isOrgAdmin`) usados pra renderizar o botão "Editar no Workspace"
 * quando o user logado é o criador ou admin/owner da org dona do evento.
 *
 * Mantém `isLikedByMe: false` por enquanto — like é controlado por
 * fingerprint cliente, não exige resolução server-side aqui.
 */
export const getPublicEvent = base
  .use(optionalAuthMiddleware)
  .input(z.object({ slug: z.string().min(1) }))
  .handler(async ({ input, context, errors }) => {
    const event = await prisma.action.findFirst({
      where: {
        publicSlug: input.slug,
        isPublic: true,
        isGuestDraft: false,
        publishedAt: { not: null },
      },
      include: {
        organization: {
          select: { id: true, name: true, logo: true, isVerified: true },
        },
        user: { select: { id: true, name: true, image: true } },
        participants: {
          include: { user: { select: { id: true, name: true, image: true } } },
        },
        tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
      },
    });

    if (!event) {
      throw errors.NOT_FOUND({ message: "Evento não encontrado" });
    }

    // ── Viewer permissions ────────────────────────────────────────
    const viewerId = context.user?.id ?? null;
    let isCreator   = false;
    let isOrgAdmin  = false;
    if (viewerId) {
      isCreator = event.createdBy === viewerId;
      if (event.organizationId) {
        const member = await prisma.member.findFirst({
          where: {
            userId: viewerId,
            organizationId: event.organizationId,
            role: { in: ["owner", "admin"] },
          },
          select: { id: true },
        });
        isOrgAdmin = !!member;
      }
    }
    const canEdit = isCreator || isOrgAdmin;

    const related = await prisma.action.findMany({
      where: {
        isPublic: true,
        isArchived: false,
        isGuestDraft: false,
        publishedAt: { not: null },
        id: { not: event.id },
        ...(event.eventCategory ? { eventCategory: event.eventCategory } : {}),
      },
      orderBy: { startDate: "asc" },
      take: 4,
      select: {
        id: true,
        publicSlug: true,
        title: true,
        coverImage: true,
        startDate: true,
        city: true,
        state: true,
        eventCategory: true,
      },
    });

    return {
      event,
      isLikedByMe: false,
      related,
      viewer: {
        userId:    viewerId,
        canEdit,
        isCreator,
        isOrgAdmin,
        workspaceId: canEdit ? event.workspaceId : null,
      },
    };
  });
