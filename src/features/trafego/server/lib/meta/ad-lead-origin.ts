import "server-only";

import prisma from "@/lib/prisma";

/**
 * Para onde foram os leads de cada anúncio no Órbita (spec 0128, RF-16): o atendimento grava
 * `Lead.metaAdId` quando a conversa nasce de um anúncio de WhatsApp. Escopo sempre pela org (CA-14).
 */

const MAX_LEADS_SCANNED = 2000;
const MAX_NAMES = 3;

export interface AdLeadOrigin {
  leadsCount: number;
  trackings: { name: string; count: number }[];
  tags: { name: string; count: number }[];
}

function topCounts(counts: Map<string, number>): { name: string; count: number }[] {
  return [...counts.entries()]
    .sort((first, second) => second[1] - first[1])
    .slice(0, MAX_NAMES)
    .map(([name, count]) => ({ name, count }));
}

export async function loadAdLeadOrigins(organizationId: string, adIds: string[]): Promise<Map<string, AdLeadOrigin>> {
  const origins = new Map<string, AdLeadOrigin>();
  if (adIds.length === 0) return origins;

  const leads = await prisma.lead.findMany({
    where: { metaAdId: { in: adIds }, tracking: { organizationId } },
    select: {
      metaAdId: true,
      tracking: { select: { name: true } },
      leadTags: { select: { tag: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_LEADS_SCANNED,
  });

  const trackingCounts = new Map<string, Map<string, number>>();
  const tagCounts = new Map<string, Map<string, number>>();
  const leadCounts = new Map<string, number>();
  for (const lead of leads) {
    if (!lead.metaAdId) continue;
    leadCounts.set(lead.metaAdId, (leadCounts.get(lead.metaAdId) ?? 0) + 1);
    const trackingsForAd = trackingCounts.get(lead.metaAdId) ?? new Map<string, number>();
    trackingsForAd.set(lead.tracking.name, (trackingsForAd.get(lead.tracking.name) ?? 0) + 1);
    trackingCounts.set(lead.metaAdId, trackingsForAd);
    const tagsForAd = tagCounts.get(lead.metaAdId) ?? new Map<string, number>();
    for (const leadTag of lead.leadTags) tagsForAd.set(leadTag.tag.name, (tagsForAd.get(leadTag.tag.name) ?? 0) + 1);
    tagCounts.set(lead.metaAdId, tagsForAd);
  }

  for (const [adId, leadsCount] of leadCounts) {
    origins.set(adId, {
      leadsCount,
      trackings: topCounts(trackingCounts.get(adId) ?? new Map()),
      tags: topCounts(tagCounts.get(adId) ?? new Map()),
    });
  }
  return origins;
}
