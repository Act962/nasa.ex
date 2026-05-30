import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { requireOrgMiddleware } from "../../middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Lista enriquecida de trackings pra o dashboard. Pra cada tracking:
 *   - apparência (`cardBorderColor`, `cardBackgroundImage`)
 *   - participantes com isCreator + isOnline
 *   - status com cor + contagem de leads em cada um
 *   - trackings relacionados via workflows com nó MOVE_LEAD apontando pra
 *     outro tracking (mostra o ícone de "automação cruzada" no card)
 *
 * Mantém `tracking.list` intocado pra não quebrar consumidores existentes.
 */

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 min

export const listDashboard = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Tracking list enriquecida para o dashboard",
    tags: ["Trackings"],
  })
  .input(z.void())
  .handler(async ({ context }) => {
    const { user, org } = context;

    const trackings = await prisma.tracking.findMany({
      where: {
        organizationId: org?.id,
        isArchived: false,
        participants: { some: { userId: user.id } },
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
      },
    });

    if (trackings.length === 0) return { trackings: [] };

    // Carregar fields de aparência via $queryRaw — não depende do Prisma
    // client ter sido regenerado após a migration. Se as colunas ainda
    // não existirem (migration não aplicada), degrada graciosamente
    // para zero customizações sem quebrar a página.
    const ids = trackings.map((t) => t.id);
    let appearanceById = new Map<
      string,
      {
        cardBorderColor: string | null;
        cardBackgroundImage: string | null;
        cardBackgroundBlur: number;
        cardBackgroundOpacity: number;
      }
    >();
    try {
      const rows = await prisma.$queryRaw<
        Array<{
          id: string;
          card_border_color: string | null;
          card_background_image: string | null;
          card_background_blur: number;
          card_background_opacity: number;
        }>
      >`SELECT id, card_border_color, card_background_image, card_background_blur, card_background_opacity FROM tracking WHERE id = ANY(${ids}::text[])`;
      appearanceById = new Map(
        rows.map((r) => [
          r.id,
          {
            cardBorderColor: r.card_border_color,
            cardBackgroundImage: r.card_background_image,
            cardBackgroundBlur: r.card_background_blur ?? 8,
            cardBackgroundOpacity: r.card_background_opacity ?? 25,
          },
        ]),
      );
    } catch (e) {
      console.warn(
        "[tracking.listDashboard] appearance columns missing — run pnpm prisma migrate deploy",
        e,
      );
    }

    // Participantes — agrupados por trackingId. Limita pra não buscar
    // gigabytes em orgs com muitos participantes.
    const participants = await prisma.trackingParticipant.findMany({
      where: { trackingId: { in: ids } },
      select: {
        id: true,
        trackingId: true,
        role: true,
        createdAt: true,
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Online status: UserPresence com lastSeenAt nos últimos 5 min.
    const userIds = Array.from(new Set(participants.map((p) => p.user.id)));
    const presences =
      userIds.length > 0
        ? await prisma.userPresence.findMany({
            where: {
              userId: { in: userIds },
              organizationId: org?.id,
            },
            select: { userId: true, lastSeenAt: true },
          })
        : [];
    const onlineSet = new Set(
      presences
        .filter(
          (p) => Date.now() - p.lastSeenAt.getTime() < ONLINE_THRESHOLD_MS,
        )
        .map((p) => p.userId),
    );

    // Status + contagem de leads por status (group by).
    const statuses = await prisma.status.findMany({
      where: { trackingId: { in: ids } },
      select: { id: true, name: true, color: true, order: true, trackingId: true },
      orderBy: { order: "asc" },
    });
    const leadCounts = await prisma.lead.groupBy({
      by: ["statusId"],
      where: {
        trackingId: { in: ids },
        isActive: true,
      },
      _count: { _all: true },
    });
    const countByStatus = new Map(
      leadCounts.map((c) => [c.statusId, c._count._all]),
    );

    // Trackings relacionados via workflows com node MOVE_LEAD apontando
    // pra outro tracking. Buscamos os nós uma vez e classificamos.
    const moveLeadNodes = await prisma.node.findMany({
      where: {
        type: "MOVE_LEAD",
        workflow: { trackingId: { in: ids } },
      },
      select: {
        data: true,
        workflow: { select: { trackingId: true } },
      },
    });
    const relatedTrackingIds = new Map<string, Set<string>>();
    for (const n of moveLeadNodes) {
      const sourceId = n.workflow.trackingId;
      if (!sourceId) continue;
      const data = (n.data ?? {}) as { trackingId?: string };
      const targetId = data.trackingId;
      if (!targetId || targetId === sourceId) continue;
      if (!relatedTrackingIds.has(sourceId)) {
        relatedTrackingIds.set(sourceId, new Set());
      }
      relatedTrackingIds.get(sourceId)!.add(targetId);
    }

    // Status da instância WhatsApp por tracking — pro botão power no
    // card mostrar azul quando CONNECTED, muted quando DISCONNECTED/null.
    // Schema garante 1-1 (`trackingId @unique` em WhatsAppInstance), então
    // não precisa de Map de array.
    const whatsappInstances = await prisma.whatsAppInstance.findMany({
      where: { trackingId: { in: ids } },
      select: { trackingId: true, status: true, isActive: true },
    });
    const whatsappStatusByTracking = new Map(
      whatsappInstances.map((i) => [
        i.trackingId,
        i.status === "CONNECTED" && i.isActive
          ? ("CONNECTED" as const)
          : ("DISCONNECTED" as const),
      ]),
    );

    // Resolve nomes dos trackings relacionados (em batch).
    const allRelatedIds = new Set<string>();
    for (const set of relatedTrackingIds.values()) {
      for (const id of set) allRelatedIds.add(id);
    }
    const relatedNames =
      allRelatedIds.size > 0
        ? await prisma.tracking.findMany({
            where: { id: { in: Array.from(allRelatedIds) } },
            select: { id: true, name: true },
          })
        : [];
    const relatedNameById = new Map(relatedNames.map((r) => [r.id, r.name]));

    // Monta o resultado final por tracking.
    const enriched = trackings.map((t) => {
      const trackParticipants = participants.filter(
        (p) => p.trackingId === t.id,
      );
      // O criador é o participante mais antigo (primeira insert) — não há
      // `createdBy` explícito no Tracking. Aproximação simples e estável.
      const creator = trackParticipants[0];
      const trackStatuses = statuses
        .filter((s) => s.trackingId === t.id)
        .map((s) => ({
          id: s.id,
          name: s.name,
          color: s.color ?? null,
          leadCount: countByStatus.get(s.id) ?? 0,
        }));

      const related = Array.from(relatedTrackingIds.get(t.id) ?? []).map(
        (id) => ({ id, name: relatedNameById.get(id) ?? "Tracking" }),
      );

      return {
        id: t.id,
        name: t.name,
        description: t.description,
        createdAt: t.createdAt,
        cardBorderColor: appearanceById.get(t.id)?.cardBorderColor ?? null,
        cardBackgroundImage:
          appearanceById.get(t.id)?.cardBackgroundImage ?? null,
        cardBackgroundBlur: appearanceById.get(t.id)?.cardBackgroundBlur ?? 8,
        cardBackgroundOpacity:
          appearanceById.get(t.id)?.cardBackgroundOpacity ?? 25,
        participants: trackParticipants.map((p) => ({
          id: p.user.id,
          name: p.user.name,
          email: p.user.email,
          image: p.user.image,
          role: p.role,
          isCreator: creator ? p.user.id === creator.user.id : false,
          isOnline: onlineSet.has(p.user.id),
        })),
        statuses: trackStatuses,
        relatedTrackings: related,
        whatsappStatus: whatsappStatusByTracking.get(t.id) ?? null,
      };
    });

    return { trackings: enriched };
  });
