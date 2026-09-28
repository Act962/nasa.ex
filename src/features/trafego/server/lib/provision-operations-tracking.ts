import "server-only";
import prisma from "@/lib/prisma";
import {
  TRAFEGO_KANBAN_COLUMNS,
  type TrafegoStatusColumnMap,
} from "@/features/trafego/lib/kanban-columns";
import { invalidateTrafegoSettingsCache, loadTrafegoSettings } from "./trafego-settings";

/**
 * Cria (ou completa) o tracking de operação e preenche `statusColumnMap`.
 *
 * Não usa `tracking.create` da procedure: ela semeia três colunas com
 * `order = 0` e cobra Stars. Aqui as colunas nascem com a ordem explícita da
 * spec. Idempotente: se o tracking já existe, colunas faltantes são criadas
 * por nome e o mapa é refeito.
 */
export async function provisionTrafegoOperationsTracking(params: {
  organizationId: string;
  actorUserId: string;
  trackingName?: string;
}): Promise<{ trackingId: string; statusColumnMap: TrafegoStatusColumnMap; created: boolean }> {
  const settings = await loadTrafegoSettings({ fresh: true });
  const trackingName = params.trackingName?.trim() || "TrafeGO";

  let trackingId = settings.operationsTrackingId;
  let created = false;

  const existing = trackingId
    ? await prisma.tracking.findFirst({
        where: { id: trackingId, organizationId: params.organizationId },
        select: { id: true },
      })
    : null;

  if (!existing) {
    const tracking = await prisma.tracking.create({
      data: {
        name: trackingName,
        description:
          "Operação do trafeGO — um card por cliente, uma coluna por fase do pedido. Gerado pelo admin.",
        organizationId: params.organizationId,
        globalAiActive: false,
        participants: { create: { userId: params.actorUserId, role: "OWNER" } },
        status: {
          createMany: {
            data: TRAFEGO_KANBAN_COLUMNS.map((column) => ({
              name: column.name,
              color: column.color,
              order: column.order,
            })),
          },
        },
      },
      select: { id: true },
    });
    trackingId = tracking.id;
    created = true;
  } else {
    trackingId = existing.id;
    await prisma.trackingParticipant.upsert({
      where: { userId_trackingId: { userId: params.actorUserId, trackingId } },
      create: { userId: params.actorUserId, trackingId, role: "OWNER" },
      update: {},
    });
  }

  const columns = await prisma.status.findMany({
    where: { trackingId },
    select: { id: true, name: true, order: true },
  });
  const byName = new Map(columns.map((column) => [column.name.trim().toLowerCase(), column]));
  const maxOrder = columns.reduce((max, column) => Math.max(max, Number(column.order)), -1);

  const statusColumnMap: TrafegoStatusColumnMap = {};
  let nextOrder = maxOrder + 1;

  for (const spec of TRAFEGO_KANBAN_COLUMNS) {
    const found = byName.get(spec.name.trim().toLowerCase());
    if (found) {
      statusColumnMap[spec.key] = found.id;
      continue;
    }
    const createdColumn = await prisma.status.create({
      data: { trackingId, name: spec.name, color: spec.color, order: nextOrder++ },
      select: { id: true },
    });
    statusColumnMap[spec.key] = createdColumn.id;
  }

  await prisma.trafegoSettings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      operationsTrackingId: trackingId,
      statusColumnMap,
      updatedById: params.actorUserId,
    },
    update: { operationsTrackingId: trackingId, statusColumnMap, updatedById: params.actorUserId },
  });
  invalidateTrafegoSettingsCache();

  return { trackingId, statusColumnMap, created };
}
