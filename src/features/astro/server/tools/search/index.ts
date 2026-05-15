import "server-only";
import { tool } from "ai";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { userBelongsToOrg } from "@/features/astro/server/tools/_shared/permissions";

/**
 * Tools de busca de entidades — usadas por TODOS os sub-agentes pra resolver
 * nomes naturais ("João Gabriel", "agenda do Wey", tag "Quente") em IDs.
 *
 * Padrão de resposta:
 *   { matches: [{ id, label, hint }], status: "single" | "multiple" | "none" }
 *
 * Os sub-agentes leem o `status` e respondem ao usuário em linguagem natural:
 *   - "single"   → executa silenciosamente, confirma com nome+ID
 *   - "multiple" → pergunta qual ("Achei dois João Gabriel: o do Vendas e o do Suporte")
 *   - "none"     → fala que não achou e pergunta o que fazer
 *
 * Match: case-insensitive, sem acentos. Substring no nome. Limita a 5 resultados.
 */

export function buildSearchTools(ctx: AgentContext) {
  return {
    search_entities: tool({
      description:
        "Busca entidades da organização atual por nome (case-insensitive, fuzzy). " +
        "Use SEMPRE pra resolver nomes naturais (de leads, agendas, tags, status, members, trackings, workspaces) em IDs antes de criar/atualizar coisas. " +
        "Responde com status='none' | 'single' | 'multiple' + lista de matches.",
      inputSchema: z.object({
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
        ]),
        query: z.string().min(1).describe("Termo de busca (nome parcial)"),
        limit: z.number().int().min(1).max(10).default(5),
      }),
      execute: async ({ entityType, query, limit }) => {
        if (!(await userBelongsToOrg(ctx.userId, ctx.organizationId))) {
          return { status: "none" as const, matches: [], error: "Sem acesso à organização" };
        }

        const q = query.trim();
        if (!q) {
          return { status: "none" as const, matches: [] };
        }

        const matches = await runEntitySearch({
          entityType,
          query: q,
          organizationId: ctx.organizationId,
          limit,
        });

        const status =
          matches.length === 0
            ? ("none" as const)
            : matches.length === 1
              ? ("single" as const)
              : ("multiple" as const);

        return { status, matches };
      },
    }),
  };
}

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
  | "form";

interface SearchResult {
  id: string;
  label: string;
  hint?: string;
}

async function runEntitySearch(opts: {
  entityType: EntityType;
  query: string;
  organizationId: string;
  limit: number;
}): Promise<SearchResult[]> {
  const { entityType, query, organizationId, limit } = opts;

  switch (entityType) {
    case "lead": {
      const rows = await prisma.lead.findMany({
        where: {
          tracking: { organizationId },
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { phone: { contains: query } },
          ],
        },
        select: {
          id: true,
          name: true,
          phone: true,
          tracking: { select: { name: true } },
        },
        take: limit,
        orderBy: { updatedAt: "desc" },
      });
      return rows.map((r) => ({
        id: r.id,
        label: r.name,
        hint: [r.phone, `tracking ${r.tracking?.name}`]
          .filter(Boolean)
          .join(" · "),
      }));
    }

    case "agenda": {
      const rows = await prisma.agenda.findMany({
        where: {
          organizationId,
          name: { contains: query, mode: "insensitive" },
        },
        select: { id: true, name: true, slug: true },
        take: limit,
        orderBy: { updatedAt: "desc" },
      });
      return rows.map((r) => ({
        id: r.id,
        label: r.name,
        hint: r.slug ? `/${r.slug}` : undefined,
      }));
    }

    case "tag": {
      const rows = await prisma.tag.findMany({
        where: {
          organizationId,
          name: { contains: query, mode: "insensitive" },
        },
        select: { id: true, name: true },
        take: limit,
        orderBy: { name: "asc" },
      });
      return rows.map((r) => ({ id: r.id, label: r.name }));
    }

    case "status": {
      const rows = await prisma.status.findMany({
        where: {
          tracking: { organizationId },
          name: { contains: query, mode: "insensitive" },
        },
        select: {
          id: true,
          name: true,
          tracking: { select: { name: true } },
        },
        take: limit,
        orderBy: { order: "asc" },
      });
      return rows.map((r) => ({
        id: r.id,
        label: r.name,
        hint: `tracking ${r.tracking?.name ?? ""}`.trim(),
      }));
    }

    case "member": {
      const rows = await prisma.member.findMany({
        where: {
          organizationId,
          user: {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          },
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
        hint: `${r.role}${r.user?.email ? ` · ${r.user.email}` : ""}`,
      }));
    }

    case "tracking": {
      const rows = await prisma.tracking.findMany({
        where: {
          organizationId,
          name: { contains: query, mode: "insensitive" },
        },
        select: { id: true, name: true },
        take: limit,
        orderBy: { updatedAt: "desc" },
      });
      return rows.map((r) => ({ id: r.id, label: r.name }));
    }

    case "workspace": {
      const rows = await prisma.workspace.findMany({
        where: {
          organizationId,
          isArchived: false,
          name: { contains: query, mode: "insensitive" },
        },
        select: { id: true, name: true },
        take: limit,
        orderBy: { updatedAt: "desc" },
      });
      return rows.map((r) => ({ id: r.id, label: r.name }));
    }

    case "appointment": {
      const rows = await prisma.appointment.findMany({
        where: {
          agenda: { organizationId },
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { notes: { contains: query, mode: "insensitive" } },
            { lead: { name: { contains: query, mode: "insensitive" } } },
          ],
        },
        select: {
          id: true,
          title: true,
          startsAt: true,
          lead: { select: { name: true } },
        },
        take: limit,
        orderBy: { startsAt: "desc" },
      });
      return rows.map((r) => ({
        id: r.id,
        label: r.title ?? r.lead?.name ?? "Agendamento sem título",
        hint: `${r.startsAt.toLocaleString("pt-BR")}${r.lead?.name ? ` · ${r.lead.name}` : ""}`,
      }));
    }

    case "proposal": {
      const rows = await prisma.forgeProposal.findMany({
        where: {
          organizationId,
          title: { contains: query, mode: "insensitive" },
        },
        select: {
          id: true,
          title: true,
          number: true,
          status: true,
        },
        take: limit,
        orderBy: { updatedAt: "desc" },
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
          name: { contains: query, mode: "insensitive" },
        },
        select: { id: true, name: true, published: true },
        take: limit,
        orderBy: { updatedAt: "desc" },
      });
      return rows.map((r) => ({
        id: r.id,
        label: r.name,
        hint: r.published ? "publicado" : "rascunho",
      }));
    }

    default: {
      // exaustividade
      const _exhaustive: never = entityType;
      void _exhaustive;
      return [];
    }
  }
}
