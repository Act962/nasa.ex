/**
 * Audience Resolver — transforma `{ kind, userIds? }` declarado na regra em
 * lista concreta de userIds que devem receber a notificação.
 *
 * Cada kind consulta tabelas existentes (Member, Lead, Action) sem duplicar
 * lógica. Resolver é puro/idempotente — recebe payload do evento + ctx da
 * regra, retorna userIds.
 */

import prisma from "@/lib/prisma";
import type { Audience, AudienceKind } from "./alert-catalog";

interface ResolveContext {
  orgId: string | null;
  leadId?: string | null;
  responsibleId?: string | null;
  participantUserIds?: string[];
  /** Pra audiência "user" override por ID específico (passar daqui). */
  explicitUserIds?: string[];
}

/**
 * Resolve uma Audience pra lista de userIds.
 *
 * Convenção: retorna SEMPRE userIds únicos. Lista vazia = silenciar
 * (engine não cria notification).
 */
export async function resolveAudience(
  audience: Audience,
  ctx: ResolveContext,
): Promise<string[]> {
  switch (audience.kind) {
    case "lead_responsible":
      return resolveLeadResponsible(ctx);

    case "action_participants":
      return ctx.participantUserIds ?? [];

    case "org_supervisors":
      return ctx.orgId ? resolveOrgSupervisors(ctx.orgId) : [];

    case "org_admins":
      return ctx.orgId ? resolveOrgAdmins(ctx.orgId) : [];

    case "whole_org":
      return ctx.orgId ? resolveWholeOrg(ctx.orgId) : [];

    case "user":
      return dedupe(audience.userIds ?? ctx.explicitUserIds ?? []);

    default: {
      // exaustividade
      const _exhaustive: never = audience.kind;
      void _exhaustive;
      return [];
    }
  }
}

/** Helpers individuais (também exportados pra testes/uso direto). */

export async function resolveLeadResponsible(
  ctx: ResolveContext,
): Promise<string[]> {
  if (ctx.responsibleId) return [ctx.responsibleId];
  if (!ctx.leadId) return [];
  const lead = await prisma.lead.findUnique({
    where: { id: ctx.leadId },
    select: { responsibleId: true },
  });
  return lead?.responsibleId ? [lead.responsibleId] : [];
}

export async function resolveOrgSupervisors(
  orgId: string,
): Promise<string[]> {
  // "Supervisores" = members com role admin OU owner OU moderador.
  // (Role "member" puro fica de fora.)
  const members = await prisma.member.findMany({
    where: {
      organizationId: orgId,
      role: { in: ["admin", "owner", "moderador"] },
    },
    select: { userId: true },
  });
  return dedupe(members.map((m) => m.userId));
}

export async function resolveOrgAdmins(orgId: string): Promise<string[]> {
  const members = await prisma.member.findMany({
    where: { organizationId: orgId, role: { in: ["admin", "owner"] } },
    select: { userId: true },
  });
  return dedupe(members.map((m) => m.userId));
}

export async function resolveWholeOrg(orgId: string): Promise<string[]> {
  const members = await prisma.member.findMany({
    where: { organizationId: orgId },
    select: { userId: true },
  });
  return dedupe(members.map((m) => m.userId));
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

/** Helper exposto pra UI: lista o que cada kind significa em linguagem natural. */
export const AUDIENCE_LABELS: Record<AudienceKind, string> = {
  lead_responsible: "Responsável pelo lead",
  action_participants: "Participantes da ação",
  org_supervisors: "Supervisores da empresa",
  org_admins: "Admins da empresa",
  user: "Usuário específico",
  whole_org: "Toda a empresa",
};
