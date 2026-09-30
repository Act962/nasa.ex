import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { CATALOG_STAGES, type CatalogStageKey } from "./catalog-stages";

type StageSetupClient = Pick<Prisma.TransactionClient, "status" | "tag">;

/**
 * Garante as 5 colunas e tags de etapa do pedido num tracking (spec 0044, RF-3/RF-4).
 * Reaproveita coluna de mesmo nome sem chave; nunca apaga nada. Idempotente.
 */
export async function ensureCatalogStages(params: {
  organizationId: string;
  trackingId: string;
  client?: StageSetupClient;
}): Promise<Record<CatalogStageKey, string>> {
  const client = params.client ?? prisma;
  const existingStatuses = await client.status.findMany({
    where: { trackingId: params.trackingId },
    select: { id: true, name: true, systemKey: true, order: true },
    orderBy: { order: "asc" },
  });
  let nextOrder = existingStatuses.reduce((highest, status) => Math.max(highest, Number(status.order)), -1) + 1;
  const statusIdByKey = {} as Record<CatalogStageKey, string>;

  for (const stage of CATALOG_STAGES) {
    const byKey = existingStatuses.find((status) => status.systemKey === stage.key);
    if (byKey) {
      statusIdByKey[stage.key] = byKey.id;
      continue;
    }
    const byName = existingStatuses.find(
      (status) => !status.systemKey && status.name.trim().toLowerCase() === stage.name.toLowerCase(),
    );
    if (byName) {
      await client.status.update({ where: { id: byName.id }, data: { systemKey: stage.key } });
      byName.systemKey = stage.key;
      statusIdByKey[stage.key] = byName.id;
      continue;
    }
    const created = await client.status.create({
      data: { name: stage.name, color: stage.color, order: nextOrder, systemKey: stage.key, trackingId: params.trackingId },
      select: { id: true },
    });
    nextOrder += 1;
    statusIdByKey[stage.key] = created.id;
  }

  await client.tag.createMany({
    data: CATALOG_STAGES.map((stage) => ({
      name: stage.name,
      slug: stage.tagSlug,
      color: stage.tagColor,
      description: `Etapa do pedido: ${stage.name}.`,
      type: "SYSTEM" as const,
      organizationId: params.organizationId,
      trackingId: params.trackingId,
    })),
    skipDuplicates: true,
  });

  return statusIdByKey;
}
