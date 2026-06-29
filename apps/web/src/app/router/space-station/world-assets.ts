import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import z from "zod";

const ASSET_TYPES = ["furniture", "chair", "desk", "computer", "game_view"] as const;

export const listWorldAssets = base
  .route({
    method: "GET",
    path: "/space-station/world-assets",
    summary: "List world game assets by type",
  })
  .input(
    z.object({
      type: z.enum(ASSET_TYPES).optional(),
    }),
  )
  .handler(async ({ input }) => {
    const assets = await prisma.worldGameAsset.findMany({
      where: {
        isActive: true,
        ...(input.type ? { type: input.type } : {}),
      },
      orderBy: { createdAt: "asc" },
    });
    return { assets };
  });

export const createWorldAsset = base
  .use(requireAdminMiddleware)
  .route({
    method: "POST",
    path: "/admin/space-station/world-assets",
    summary: "Create a world game asset (admin only)",
  })
  .input(
    z.object({
      type: z.enum(ASSET_TYPES),
      name: z.string().min(1).max(80),
      imageUrl: z.string().url(),
      previewUrl: z.string().url().optional(),
      config: z.record(z.string(), z.unknown()).optional(),
    }),
  )
  .handler(async ({ input }) => {
    const asset = await prisma.worldGameAsset.create({
      data: {
        type: input.type,
        name: input.name,
        imageUrl: input.imageUrl,
        previewUrl: input.previewUrl ?? null,
        ...(input.config !== undefined
          ? { config: input.config as Prisma.InputJsonValue }
          : {}),
      },
    });
    return { asset };
  });

export const updateWorldAsset = base
  .use(requireAdminMiddleware)
  .route({
    method: "PATCH",
    path: "/admin/space-station/world-assets/:id",
    summary: "Update a world game asset (admin only)",
  })
  .input(
    z.object({
      id: z.string(),
      name: z.string().min(1).max(80).optional(),
      imageUrl: z.string().url().optional(),
      previewUrl: z.string().url().nullable().optional(),
      config: z.record(z.string(), z.unknown()).nullable().optional(),
      isActive: z.boolean().optional(),
    }),
  )
  .handler(async ({ input }) => {
    const { id, config, ...rest } = input;
    const data: Prisma.WorldGameAssetUpdateInput = {
      ...rest,
      ...(config === null
        ? { config: Prisma.JsonNull }
        : config !== undefined
          ? { config: config as Prisma.InputJsonValue }
          : {}),
    };
    const asset = await prisma.worldGameAsset.update({ where: { id }, data });
    return { asset };
  });

export const deleteWorldAsset = base
  .use(requireAdminMiddleware)
  .route({
    method: "DELETE",
    path: "/admin/space-station/world-assets/:id",
    summary: "Delete a world game asset (admin only)",
  })
  .input(z.object({ id: z.string() }))
  .handler(async ({ input }) => {
    await prisma.worldGameAsset.delete({ where: { id: input.id } });
    return { ok: true };
  });
