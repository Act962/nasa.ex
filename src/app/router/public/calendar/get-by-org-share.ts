import { base } from "@/app/middlewares/base";
import { optionalAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";

/**
 * Endpoint público pro link de compartilhamento do Calendário Workspace.
 * Valida slug + token + expiração da org. Em sucesso, retorna a lista de
 * ações do período com NÍVEL DE DETALHE DIFERENCIADO:
 *
 *   - `mode = "full"`  → user logado E membro da org → payload completo
 *     (participantes, responsáveis, lead, descrição, cover etc).
 *   - `mode = "minimal"` → user anônimo OU membro de outra org → cards
 *     mínimos (título + datas + horário + workspace). Sem descrição,
 *     anexos, ou referências de pessoas.
 *
 * Tratamento de NOT_FOUND idêntico pra "não existe", "desabilitado" e
 * "expirado" — evita vazar info sobre existência da org via timing.
 */
export const getByOrgShare = base
  .use(optionalAuthMiddleware)
  .input(
    z.object({
      slug: z.string().min(1).max(120),
      token: z.string().min(8).max(64),
      startDate: z.string(),
      endDate: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);
    end.setHours(23, 59, 59, 999);

    const org = await prisma.organization.findUnique({
      where: { slug: input.slug },
      select: {
        id: true,
        name: true,
        logo: true,
        calendarPublicEnabled: true,
        calendarPublicToken: true,
        calendarPublicExpiresAt: true,
      },
    });

    if (
      !org ||
      !org.calendarPublicEnabled ||
      !org.calendarPublicToken ||
      org.calendarPublicToken !== input.token
    ) {
      throw new ORPCError("NOT_FOUND", { message: "Calendário não encontrado" });
    }

    if (
      !org.calendarPublicExpiresAt ||
      org.calendarPublicExpiresAt.getTime() < Date.now()
    ) {
      throw new ORPCError("NOT_FOUND", { message: "Link expirado" });
    }

    // Detecta modo full vs minimal server-side. Zero confiança no cliente.
    let mode: "full" | "minimal" = "minimal";
    if (context.user) {
      const member = await prisma.member.findFirst({
        where: { organizationId: org.id, userId: context.user.id },
        select: { id: true },
      });
      if (member) mode = "full";
    }

    const whereClause = {
      organizationId: org.id,
      isArchived: false,
      isGuestDraft: false,
      OR: [
        { dueDate: { gte: start, lte: end } },
        { startDate: { gte: start, lte: end } },
      ],
    };

    const orderBy: Array<
      | { dueDate: { sort: "asc"; nulls: "last" } }
      | { startDate: { sort: "asc"; nulls: "last" } }
    > = [
      { dueDate: { sort: "asc", nulls: "last" } },
      { startDate: { sort: "asc", nulls: "last" } },
    ];

    if (mode === "minimal") {
      const actions = await prisma.action.findMany({
        where: whereClause,
        orderBy,
        select: {
          id: true,
          title: true,
          startDate: true,
          dueDate: true,
          endDate: true,
          isDone: true,
          workspaceId: true,
          workspace: {
            select: { id: true, name: true, color: true, icon: true },
          },
        },
      });
      return {
        org: { name: org.name, logo: org.logo },
        mode,
        expiresAt: org.calendarPublicExpiresAt,
        actions,
      };
    }

    // Mode "full" — mesmo shape de getWorkspaceCalendar.
    const actions = await prisma.action.findMany({
      where: whereClause,
      orderBy,
      select: {
        id: true,
        title: true,
        dueDate: true,
        startDate: true,
        endDate: true,
        priority: true,
        isDone: true,
        coverImage: true,
        workspaceId: true,
        workspace: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
            coverImage: true,
          },
        },
        orgProjectId: true,
        orgProject: {
          select: {
            id: true,
            name: true,
            type: true,
            color: true,
            avatar: true,
          },
        },
        trackingId: true,
        tracking: { select: { id: true, name: true } },
        leadId: true,
        lead: { select: { id: true, name: true, email: true } },
        createdBy: true,
        user: { select: { id: true, name: true, image: true } },
        participants: {
          select: {
            userId: true,
            user: { select: { id: true, name: true, image: true } },
          },
        },
        responsibles: {
          select: {
            userId: true,
            user: { select: { id: true, name: true, image: true } },
          },
        },
      },
    });

    return {
      org: { name: org.name, logo: org.logo },
      mode,
      expiresAt: org.calendarPublicExpiresAt,
      actions,
    };
  });
