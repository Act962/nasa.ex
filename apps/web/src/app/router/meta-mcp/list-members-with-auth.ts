import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { canManageMcpAuthorizations } from "@/lib/meta-mcp/authorization";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

/**
 * Lista todos os members da org com status de autorização Meta MCP anotado.
 *
 * Owner/moderador são autorizados IMPLICITAMENTE pelo role — vêm com
 * `authorizationSource: "role"`. Admin/member precisam de grant explícito —
 * `authorizationSource: "explicit" | "none" | "revoked"`.
 *
 * Retorna ordenado por nome do user.
 */
export const listMembersWithAuth = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    const canManage = await canManageMcpAuthorizations(
      context.user.id,
      context.org.id,
    );
    if (!canManage) {
      throw new ORPCError("FORBIDDEN", {
        message:
          "Apenas Master e Moderador podem visualizar membros autorizados.",
      });
    }

    const [members, grants] = await Promise.all([
      prisma.member.findMany({
        where: { organizationId: context.org.id },
        select: {
          id: true,
          role: true,
          user: { select: { id: true, name: true, email: true, image: true } },
          createdAt: true,
        },
        orderBy: { user: { name: "asc" } },
      }),
      prisma.metaMcpAuthorization.findMany({
        where: { organizationId: context.org.id },
        select: {
          userId: true,
          revokedAt: true,
          authorizedAt: true,
          authorizedById: true,
          notes: true,
          authorizedBy: { select: { name: true } },
        },
      }),
    ]);

    const grantByUser = new Map(grants.map((g) => [g.userId, g]));

    const annotated = members.map((m) => {
      const grant = grantByUser.get(m.user.id);
      let authorized: boolean;
      let source: "role" | "explicit" | "none" | "revoked";
      if (m.role === "owner" || m.role === "moderador") {
        authorized = true;
        source = "role";
      } else if (!grant) {
        authorized = false;
        source = "none";
      } else if (grant.revokedAt) {
        authorized = false;
        source = "revoked";
      } else {
        authorized = true;
        source = "explicit";
      }

      return {
        userId: m.user.id,
        memberId: m.id,
        name: m.user.name,
        email: m.user.email,
        image: m.user.image,
        role: m.role,
        memberSince: m.createdAt.toISOString(),
        authorized,
        authorizationSource: source,
        authorizedAt: grant?.authorizedAt?.toISOString() ?? null,
        authorizedByName: grant?.authorizedBy?.name ?? null,
        revokedAt: grant?.revokedAt?.toISOString() ?? null,
        notes: grant?.notes ?? null,
      };
    });

    return { members: annotated };
  });
