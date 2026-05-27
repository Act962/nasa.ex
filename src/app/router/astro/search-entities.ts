import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Procedure oRPC pública (autenticada) — usada pelo slash composer
 * client-side pra autocomplete de entidades (chip picker).
 *
 * Espelha em estrutura a tool `search_entities` que o Astro usa server-side
 * (src/features/astro/server/tools/search/index.ts) — mantém a mesma forma
 * de resposta { status, matches[] } por consistência mental do user (chip
 * picker e Astro chat resolvem nomes do mesmo jeito).
 */
export const searchEntities = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/astro/search-entities",
    summary: "Autocomplete de entidades pelo nome (composer chips)",
  })
  .input(
    z.object({
      entityType: z.enum([
        "lead",
        "agenda",
        "tag",
        "status",
        "member",
        "tracking",
        "workspace",
        "appointment",
        "proposal",
        "form",
        "workflow_folder",
      ]),
      query: z.string().default(""),
      limit: z.coerce.number().int().min(1).max(20).default(8),
    }),
  )
  .output(
    z.object({
      status: z.enum(["none", "single", "multiple"]),
      matches: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          hint: z.string().optional(),
        }),
      ),
    }),
  )
  .handler(async ({ input, context }) => {
    const organizationId = context.org.id;
    const q = input.query.trim();
    const limit = input.limit;

    const matches = await runSearch(input.entityType, q, organizationId, limit);
    const status =
      matches.length === 0
        ? ("none" as const)
        : matches.length === 1
          ? ("single" as const)
          : ("multiple" as const);
    return { status, matches };
  });

type EntityType =
  | "lead"
  | "agenda"
  | "tag"
  | "status"
  | "member"
  | "tracking"
  | "workspace"
  | "appointment"
  | "proposal"
  | "form"
  | "workflow_folder";

async function runSearch(
  entityType: EntityType,
  query: string,
  organizationId: string,
  limit: number,
) {
  // Empty query → retorna top recentes (entityType-dependent)
  const isEmpty = query === "";

  switch (entityType) {
    case "lead": {
      const rows = await prisma.lead.findMany({
        where: {
          tracking: { organizationId },
          ...(isEmpty
            ? {}
            : {
                OR: [
                  { name: { contains: query, mode: "insensitive" } },
                  { email: { contains: query, mode: "insensitive" } },
                  { phone: { contains: query } },
                ],
              }),
        },
        select: {
          id: true,
          name: true,
          phone: true,
          tracking: { select: { name: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
      });
      return rows.map((r) => ({
        id: r.id,
        label: r.name,
        hint: [r.phone, r.tracking?.name].filter(Boolean).join(" · "),
      }));
    }
    case "agenda": {
      const rows = await prisma.agenda.findMany({
        where: {
          organizationId,
          ...(isEmpty
            ? {}
            : { name: { contains: query, mode: "insensitive" } }),
        },
        select: { id: true, name: true, slug: true },
        orderBy: { updatedAt: "desc" },
        take: limit,
      });
      return rows.map((r) => ({
        id: r.id,
        label: r.name,
        hint: r.slug,
      }));
    }
    case "tag": {
      const rows = await prisma.tag.findMany({
        where: {
          organizationId,
          ...(isEmpty
            ? {}
            : { name: { contains: query, mode: "insensitive" } }),
        },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
        take: limit,
      });
      return rows.map((r) => ({ id: r.id, label: r.name }));
    }
    case "status": {
      const rows = await prisma.status.findMany({
        where: {
          tracking: { organizationId },
          ...(isEmpty
            ? {}
            : { name: { contains: query, mode: "insensitive" } }),
        },
        select: {
          id: true,
          name: true,
          tracking: { select: { name: true } },
        },
        orderBy: { order: "asc" },
        take: limit,
      });
      return rows.map((r) => ({
        id: r.id,
        label: r.name,
        hint: r.tracking?.name,
      }));
    }
    case "member": {
      const rows = await prisma.member.findMany({
        where: {
          organizationId,
          ...(isEmpty
            ? {}
            : {
                user: {
                  OR: [
                    { name: { contains: query, mode: "insensitive" } },
                    { email: { contains: query, mode: "insensitive" } },
                  ],
                },
              }),
        },
        select: {
          userId: true,
          role: true,
          user: { select: { name: true, email: true } },
        },
        take: limit,
      });
      return rows.map((r) => ({
        id: r.userId,
        label: r.user?.name ?? r.user?.email ?? r.userId,
        hint: r.role,
      }));
    }
    case "tracking": {
      const rows = await prisma.tracking.findMany({
        where: {
          organizationId,
          ...(isEmpty
            ? {}
            : { name: { contains: query, mode: "insensitive" } }),
        },
        select: { id: true, name: true },
        orderBy: { updatedAt: "desc" },
        take: limit,
      });
      return rows.map((r) => ({ id: r.id, label: r.name }));
    }
    case "workspace": {
      const rows = await prisma.workspace.findMany({
        where: {
          organizationId,
          isArchived: false,
          ...(isEmpty
            ? {}
            : { name: { contains: query, mode: "insensitive" } }),
        },
        select: { id: true, name: true },
        orderBy: { updatedAt: "desc" },
        take: limit,
      });
      return rows.map((r) => ({ id: r.id, label: r.name }));
    }
    case "appointment": {
      const rows = await prisma.appointment.findMany({
        where: {
          agenda: { organizationId },
          ...(isEmpty
            ? {}
            : {
                OR: [
                  { title: { contains: query, mode: "insensitive" } },
                  { lead: { name: { contains: query, mode: "insensitive" } } },
                ],
              }),
        },
        select: {
          id: true,
          title: true,
          startsAt: true,
          lead: { select: { name: true } },
        },
        orderBy: { startsAt: "desc" },
        take: limit,
      });
      return rows.map((r) => ({
        id: r.id,
        label: r.title ?? r.lead?.name ?? "Agendamento",
        hint: r.startsAt.toLocaleString("pt-BR"),
      }));
    }
    case "proposal": {
      const rows = await prisma.forgeProposal.findMany({
        where: {
          organizationId,
          ...(isEmpty
            ? {}
            : { title: { contains: query, mode: "insensitive" } }),
        },
        select: { id: true, title: true, number: true, status: true },
        orderBy: { updatedAt: "desc" },
        take: limit,
      });
      return rows.map((r) => ({
        id: r.id,
        label: r.title,
        hint: `#${r.number} · ${r.status}`,
      }));
    }
    case "form": {
      const rows = await prisma.form.findMany({
        where: {
          organizationId,
          ...(isEmpty
            ? {}
            : { name: { contains: query, mode: "insensitive" } }),
        },
        select: { id: true, name: true, published: true },
        orderBy: { updatedAt: "desc" },
        take: limit,
      });
      return rows.map((r) => ({
        id: r.id,
        label: r.name,
        hint: r.published ? "publicado" : "rascunho",
      }));
    }
    case "workflow_folder": {
      try {
        const rows = await prisma.workflowFolder.findMany({
          where: {
            tracking: { organizationId },
            ...(isEmpty
              ? {}
              : { name: { contains: query, mode: "insensitive" } }),
          },
          select: {
            id: true,
            name: true,
            tracking: { select: { name: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: limit,
        });
        return rows.map((r) => ({
          id: r.id,
          label: r.name,
          hint: r.tracking?.name,
        }));
      } catch (err: unknown) {
        // Tabela ainda não existe (migration `workflow_folders` não aplicada)
        const code =
          err instanceof Error && "code" in err
            ? (err as { code?: string }).code
            : undefined;
        if (code === "P2021" || code === "P2022") return [];
        throw err;
      }
    }
    default: {
      const _exhaustive: never = entityType;
      void _exhaustive;
      return [];
    }
  }
}
