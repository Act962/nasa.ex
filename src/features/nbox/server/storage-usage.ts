import "server-only";

import prisma from "@/lib/prisma";
import { NBOX_STORAGE_FULL_MESSAGE, getNboxStorageLimitBytes } from "@/features/nbox/lib/storage-limits";

export interface NboxStorageUsage {
  usedBytes: number;
  limitBytes: number;
  itemCount: number;
  planSlug: string;
}

export class NboxStorageFullError extends Error {
  constructor() {
    super(NBOX_STORAGE_FULL_MESSAGE);
    this.name = "NboxStorageFullError";
  }
}

export async function getNboxStorageUsage(organizationId: string): Promise<NboxStorageUsage> {
  const [usage, organization] = await Promise.all([
    prisma.nBoxItem.aggregate({
      where: { organizationId, size: { not: null } },
      _sum: { size: true },
      _count: true,
    }),
    prisma.organization.findUnique({ where: { id: organizationId }, select: { plan: { select: { slug: true } } } }),
  ]);
  const planSlug = organization?.plan?.slug ?? "earth";
  return {
    usedBytes: Number(usage._sum.size ?? BigInt(0)),
    limitBytes: getNboxStorageLimitBytes(planSlug),
    itemCount: usage._count,
    planSlug,
  };
}

/** Lança `NboxStorageFullError` se `extraBytes` não cabe no espaço da empresa (spec 0148, RF-4). */
export async function assertNboxStorageAvailable(organizationId: string, extraBytes: number): Promise<void> {
  const usage = await getNboxStorageUsage(organizationId);
  if (usage.usedBytes + extraBytes > usage.limitBytes) throw new NboxStorageFullError();
}
