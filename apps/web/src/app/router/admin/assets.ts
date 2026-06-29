import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

// ── List all platform assets (key→url map) ─────────────────────────────────
export const listPlatformAssets = base
  .use(requireAdminMiddleware)
  .route({ method: "GET", summary: "Admin — List platform assets" })
  .output(z.record(z.string(), z.string()))
  .handler(async () => {
    const rows = await prisma.platformAsset.findMany();
    return Object.fromEntries(rows.map((r) => [r.key, r.url]));
  });

// ── Set (upsert) a platform asset ─────────────────────────────────────────
export const setPlatformAsset = base
  .use(requireAdminMiddleware)
  .route({ method: "POST", summary: "Admin — Set platform asset" })
  .input(z.object({ key: z.string().min(1), url: z.string().url() }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input }) => {
    await prisma.platformAsset.upsert({
      where:  { key: input.key },
      update: { url: input.url },
      create: { key: input.key, url: input.url },
    });
    return { success: true };
  });

// ── Delete a platform asset ────────────────────────────────────────────────
export const deletePlatformAsset = base
  .use(requireAdminMiddleware)
  .route({ method: "POST", summary: "Admin — Delete platform asset" })
  .input(z.object({ key: z.string().min(1) }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input }) => {
    await prisma.platformAsset.deleteMany({ where: { key: input.key } });
    return { success: true };
  });

// ── List all Space Point levels ────────────────────────────────────────────
export const listSpaceLevels = base
  .use(requireAdminMiddleware)
  .route({ method: "GET", summary: "Admin — List Space Point levels" })
  .output(z.array(z.object({
    id:             z.string(),
    order:          z.number(),
    name:           z.string(),
    requiredPoints: z.number(),
    badgeNumber:    z.number(),
    planetEmoji:    z.string(),
  })))
  .handler(async () => {
    const levels = await prisma.spacePointLevel.findMany({ orderBy: { order: "asc" } });
    return levels.map((l) => ({
      id:             l.id,
      order:          l.order,
      name:           l.name,
      requiredPoints: l.requiredPoints,
      badgeNumber:    l.badgeNumber,
      planetEmoji:    l.planetEmoji,
    }));
  });

// ── Update a Space Point level ─────────────────────────────────────────────
export const updateSpaceLevel = base
  .use(requireAdminMiddleware)
  .route({ method: "POST", summary: "Admin — Update Space Point level" })
  .input(z.object({
    id:             z.string(),
    name:           z.string().min(1).max(50).optional(),
    requiredPoints: z.number().int().min(0).optional(),
    planetEmoji:    z.string().max(8).optional(),
  }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input }) => {
    await prisma.spacePointLevel.update({
      where: { id: input.id },
      data: {
        ...(input.name           !== undefined ? { name: input.name }                     : {}),
        ...(input.requiredPoints !== undefined ? { requiredPoints: input.requiredPoints } : {}),
        ...(input.planetEmoji   !== undefined ? { planetEmoji: input.planetEmoji }       : {}),
      },
    });
    return { success: true };
  });
