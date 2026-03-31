import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export type EntityType =
  | "agenda"
  | "lead"
  | "product"
  | "tracking"
  | "trackingStatus"
  | "user"
  | "workspace"
  | "workspaceColumn";

export const searchEntities = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      entityType: z.enum([
        "agenda",
        "lead",
        "product",
        "tracking",
        "trackingStatus",
        "user",
        "workspace",
        "workspaceColumn",
      ]),
      query: z.string().default(""),
      parentId: z.string().optional(), // e.g. trackingId for statuses
    }),
  )
  .output(
    z.object({
      results: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          sublabel: z.string().optional(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    const { entityType, query, parentId } = input;
    const orgId = context.org.id;
    const q = query.trim();
    const where = q
      ? { contains: q, mode: "insensitive" as const }
      : undefined;

    switch (entityType) {
      // ── Agendas ──────────────────────────────────────────────────────────────
      case "agenda": {
        const rows = await prisma.agenda.findMany({
          where: {
            organizationId: orgId,
            isActive: true,
            ...(where ? { name: where } : {}),
          },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
          take: 10,
        });
        return { results: rows.map((r) => ({ id: r.id, label: r.name })) };
      }

      // ── Leads ─────────────────────────────────────────────────────────────────
      case "lead": {
        const rows = await prisma.lead.findMany({
          where: {
            isActive: true,
            tracking: { organizationId: orgId },
            ...(where ? { name: where } : {}),
          },
          select: { id: true, name: true, email: true, phone: true },
          orderBy: { name: "asc" },
          take: 10,
        });
        return {
          results: rows.map((r) => ({
            id: r.id,
            label: r.name,
            sublabel: r.email ?? r.phone ?? undefined,
          })),
        };
      }

      // ── Produtos (Forge) ──────────────────────────────────────────────────────
      case "product": {
        const rows = await prisma.forgeProduct.findMany({
          where: {
            organizationId: orgId,
            ...(where ? { name: where } : {}),
          },
          select: { id: true, name: true, value: true },
          orderBy: { name: "asc" },
          take: 10,
        });
        return {
          results: rows.map((r) => ({
            id: r.id,
            label: r.name,
            sublabel: r.value != null ? `R$ ${Number(r.value).toFixed(2)}` : undefined,
          })),
        };
      }

      // ── Trackings / Pipelines ─────────────────────────────────────────────────
      case "tracking": {
        const rows = await prisma.tracking.findMany({
          where: {
            organizationId: orgId,
            ...(where ? { name: where } : {}),
          },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
          take: 10,
        });
        return { results: rows.map((r) => ({ id: r.id, label: r.name })) };
      }

      // ── Status de um tracking ─────────────────────────────────────────────────
      case "trackingStatus": {
        const rows = await prisma.status.findMany({
          where: {
            ...(parentId ? { trackingId: parentId } : { tracking: { organizationId: orgId } }),
            ...(where ? { name: where } : {}),
          },
          select: { id: true, name: true, tracking: { select: { name: true } } },
          orderBy: { order: "asc" },
          take: 15,
        });
        return {
          results: rows.map((r) => ({
            id: r.id,
            label: r.name,
            sublabel: r.tracking?.name,
          })),
        };
      }

      // ── Usuários / Membros ────────────────────────────────────────────────────
      case "user": {
        const rows = await prisma.member.findMany({
          where: {
            organizationId: orgId,
            ...(where
              ? { user: { name: where } }
              : {}),
          },
          include: { user: { select: { id: true, name: true, email: true } } },
          take: 10,
        });
        return {
          results: rows.map((r) => ({
            id: r.user.id,
            label: r.user.name ?? r.user.email,
            sublabel: r.user.email,
          })),
        };
      }

      // ── Workspaces ────────────────────────────────────────────────────────────
      case "workspace": {
        const rows = await prisma.workspace.findMany({
          where: {
            organizationId: orgId,
            ...(where ? { name: where } : {}),
          },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
          take: 10,
        });
        return { results: rows.map((r) => ({ id: r.id, label: r.name })) };
      }

      // ── Colunas de workspace ──────────────────────────────────────────────────
      case "workspaceColumn": {
        const rows = await prisma.workspaceColumn.findMany({
          where: {
            ...(parentId ? { workspaceId: parentId } : { workspace: { organizationId: orgId } }),
            ...(where ? { name: where } : {}),
          },
          select: { id: true, name: true, workspace: { select: { name: true } } },
          orderBy: { order: "asc" },
          take: 15,
        });
        return {
          results: rows.map((r: { id: string; name: string; workspace: { name: string } | null }) => ({
            id: r.id,
            label: r.name,
            sublabel: r.workspace?.name,
          })),
        };
      }

      default:
        return { results: [] };
    }
  });
