import "server-only";
import prisma from "@/lib/prisma";
import { getTagSnapshotAtDate } from "@/features/insights/lib/tag-snapshot";

/**
 * Contagem de leads por tag usando snapshot temporal (reconstrói via
 * LeadJourneyEvent pra não cair retroativamente o count de períodos passados).
 * Fonte de verdade única, consumida pela procedure `insights.getLeadsByTags`
 * (página) e pela tool do Astro.
 */

export interface LeadsByTagsResult {
  tags: Array<{
    tag: {
      id: string;
      name: string;
      color: string | null;
      slug: string;
      isArchived: boolean;
    };
    count: number;
  }>;
  totalWithTags: number;
}

export interface ComputeLeadsByTagsArgs {
  organizationId: string;
  trackingId?: string;
  tagIds?: string[];
  endDate?: Date;
  /** Inclui tags arquivadas (soft-deleted) na lista. Default false. */
  includeArchived?: boolean;
}

export async function computeLeadsByTags(
  args: ComputeLeadsByTagsArgs,
): Promise<LeadsByTagsResult> {
  const {
    organizationId,
    trackingId,
    tagIds,
    endDate,
    includeArchived = false,
  } = args;

  const tags = await prisma.tag.findMany({
    where: {
      organizationId,
      ...(tagIds?.length ? { id: { in: tagIds } } : {}),
      ...(trackingId ? { OR: [{ trackingId }, { trackingId: null }] } : {}),
      ...(includeArchived ? {} : { archivedAt: null }),
    },
    select: {
      id: true,
      name: true,
      color: true,
      slug: true,
      archivedAt: true,
    },
  });

  const leadsInScope = await prisma.lead.findMany({
    where: {
      ...(trackingId ? { trackingId } : {}),
      tracking: { organizationId },
    },
    select: { id: true },
  });
  const snapshot = await getTagSnapshotAtDate(
    leadsInScope.map((lead) => lead.id),
    endDate ?? null,
  );

  const countByTagId = new Map<string, number>();
  const leadsByTagId = new Map<string, Set<string>>();
  for (const entry of snapshot) {
    countByTagId.set(entry.tagId, (countByTagId.get(entry.tagId) ?? 0) + 1);
    const set = leadsByTagId.get(entry.tagId) ?? new Set();
    set.add(entry.leadId);
    leadsByTagId.set(entry.tagId, set);
  }

  // Agrega tags por nome (case-insensitive trim) — colapsa duplicatas legacy
  // da migração TagsV2 que dividiam o count real.
  type TagAgg = {
    primaryTag: (typeof tags)[number];
    primaryRawCount: number;
    leadIds: Set<string>;
  };
  const byNameAgg = new Map<string, TagAgg>();
  for (const tag of tags) {
    const key = tag.name.trim().toLowerCase();
    const rawCount = countByTagId.get(tag.id) ?? 0;
    const leadsForTag = leadsByTagId.get(tag.id) ?? new Set();
    let agg = byNameAgg.get(key);
    if (!agg) {
      agg = { primaryTag: tag, primaryRawCount: rawCount, leadIds: new Set() };
      byNameAgg.set(key, agg);
    } else if (rawCount > agg.primaryRawCount) {
      agg.primaryTag = tag;
      agg.primaryRawCount = rawCount;
    }
    for (const id of leadsForTag) agg.leadIds.add(id);
  }

  const tagCounts = Array.from(byNameAgg.values()).map((agg) => {
    const { archivedAt, ...tagPublic } = agg.primaryTag;
    return {
      tag: { ...tagPublic, isArchived: archivedAt !== null },
      count: agg.leadIds.size,
    };
  });

  const leadsWithAnyTag = new Set<string>();
  for (const agg of byNameAgg.values()) {
    for (const id of agg.leadIds) leadsWithAnyTag.add(id);
  }

  return {
    tags: tagCounts.sort((a, b) => b.count - a.count),
    totalWithTags: leadsWithAnyTag.size,
  };
}
