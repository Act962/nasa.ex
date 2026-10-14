import prisma from "@/lib/prisma";
import { base } from "./base";

/**
 * Trava de isolamento entre empresas para procedures que recebem o id de um
 * recurso (S5 da auditoria de segurança, spec 0106).
 *
 * Alcança o recurso quem é membro da empresa dona dele, participante do
 * tracking ou membro do workspace. A empresa ativa da sessão não entra na
 * conta: quem participa de várias empresas usa recursos de todas.
 *
 * Cada lote nasce só registrando o que seria negado e passa a negar quando
 * entra em `TENANCY_GUARD_ENFORCED_BATCHES`.
 */

export type TenantResourceKind = "tracking" | "lead" | "conversation" | "workspace";

export type TenancyGuardBatch = "lote-1";

export type TenantAccessVerdict = "allowed" | "denied" | "missing";

type ResourceOwner = {
  organizationId: string;
  trackingId: string | null;
  workspaceId: string | null;
};

async function findResourceOwner(kind: TenantResourceKind, resourceId: string): Promise<ResourceOwner | null> {
  switch (kind) {
    case "tracking": {
      const tracking = await prisma.tracking.findUnique({
        where: { id: resourceId },
        select: { organizationId: true },
      });
      return tracking ? { organizationId: tracking.organizationId, trackingId: resourceId, workspaceId: null } : null;
    }
    case "lead":
    case "conversation": {
      const query = { where: { id: resourceId }, select: { trackingId: true, tracking: { select: { organizationId: true } } } };
      const owned = kind === "lead" ? await prisma.lead.findUnique(query) : await prisma.conversation.findUnique(query);
      return owned
        ? { organizationId: owned.tracking.organizationId, trackingId: owned.trackingId, workspaceId: null }
        : null;
    }
    case "workspace": {
      const workspace = await prisma.workspace.findUnique({
        where: { id: resourceId },
        select: { organizationId: true },
      });
      return workspace ? { organizationId: workspace.organizationId, trackingId: null, workspaceId: resourceId } : null;
    }
  }
}

export async function checkTenantResourceAccess(
  userId: string,
  kind: TenantResourceKind,
  resourceId: string,
): Promise<TenantAccessVerdict> {
  const owner = await findResourceOwner(kind, resourceId);
  if (!owner) return "missing";

  const [membership, trackingParticipation, workspaceMembership] = await Promise.all([
    prisma.member.findFirst({ where: { userId, organizationId: owner.organizationId }, select: { id: true } }),
    owner.trackingId
      ? prisma.trackingParticipant.findUnique({
          where: { userId_trackingId: { userId, trackingId: owner.trackingId } },
          select: { id: true },
        })
      : null,
    owner.workspaceId
      ? prisma.workspaceMember.findUnique({
          where: { workspaceId_userId: { workspaceId: owner.workspaceId, userId } },
          select: { id: true },
        })
      : null,
  ]);

  return membership || trackingParticipation || workspaceMembership ? "allowed" : "denied";
}

export function isTenancyBatchEnforced(batch: TenancyGuardBatch): boolean {
  return (process.env.TENANCY_GUARD_ENFORCED_BATCHES ?? "")
    .split(",")
    .map((enforcedBatch) => enforcedBatch.trim())
    .includes(batch);
}

/**
 * Use depois de `.input(...)`. Recurso inexistente segue para o handler, que
 * já responde do jeito dele; recurso de outra empresa responde NOT_FOUND, para
 * não revelar que o id existe.
 */
export function requireTenantResource<TInput>(
  kind: TenantResourceKind,
  readResourceId: (input: TInput) => string,
  batch: TenancyGuardBatch,
) {
  return base
    .$context<{ user: { id: string } }>()
    .middleware(async ({ context, next, errors, path }, input: TInput) => {
      const resourceId = readResourceId(input);
      const verdict = await checkTenantResourceAccess(context.user.id, kind, resourceId);

      if (verdict === "denied") {
        if (isTenancyBatchEnforced(batch)) throw errors.NOT_FOUND();
        console.warn(
          `[tenancy-guard] seria negado batch=${batch} procedure=${path.join(".")} ${kind}=${resourceId} user=${context.user.id}`,
        );
      }

      return next();
    });
}
