import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { IntegrationPlatform } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { isMetaManagedByOrbita } from "@/features/integrations/lib/integration-api-key";
import { runMetaConnectionCheck, type MetaConnectionCheck } from "@/features/integrations/lib/meta-connection-check";
import { isOrgOwnerOrAdmin } from "@/features/permissions/server/is-org-admin";
import { isUserSystemAdmin } from "@/features/permissions/server/is-system-admin";

async function loadMetaIntegration(organizationId: string) {
  return prisma.platformIntegration.findUnique({
    where: { organizationId_platform: { organizationId, platform: IntegrationPlatform.META } },
    select: { id: true, isActive: true, config: true },
  });
}

async function resolveViewer(organizationId: string, userId: string, config: Record<string, unknown> | null) {
  const [isSystemAdmin, isOwnerOrAdmin] = await Promise.all([
    isUserSystemAdmin(userId),
    isOrgOwnerOrAdmin(organizationId, userId),
  ]);
  const isManagedByOrbita = isMetaManagedByOrbita(config);
  return {
    isSystemAdmin,
    canEdit: isSystemAdmin || (isOwnerOrAdmin && !isManagedByOrbita),
    canTest: isSystemAdmin || isOwnerOrAdmin,
    isManagedByOrbita,
  };
}

/** Situação da conexão Meta da org (spec 0122, RF-9). Nunca devolve segredo. */
export const getMetaConnectionStatus = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    const integration = await loadMetaIntegration(context.org.id);
    const config = (integration?.config ?? null) as Record<string, unknown> | null;
    const viewer = await resolveViewer(context.org.id, context.user.id, config);
    return {
      isConnected: Boolean(integration?.isActive),
      adAccountId: typeof config?.adAccountId === "string" ? config.adAccountId : null,
      check: (config?.connectionCheck as MetaConnectionCheck | undefined) ?? null,
      viewer,
    };
  });

/** "Testar conexão": consulta a Meta ao vivo e grava o resumo (RF-7). */
export const testMetaConnection = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    const integration = await loadMetaIntegration(context.org.id);
    if (!integration) {
      throw new ORPCError("NOT_FOUND", { message: "Conecte a Meta antes de testar." });
    }
    const config = (integration.config ?? null) as Record<string, unknown> | null;
    const viewer = await resolveViewer(context.org.id, context.user.id, config);
    if (!viewer.canTest) {
      throw new ORPCError("FORBIDDEN", { message: "Só o dono ou um administrador da empresa testa a conexão." });
    }

    const check = await runMetaConnectionCheck(config);
    await prisma.platformIntegration.update({
      where: { id: integration.id },
      data: { config: { ...(config ?? {}), connectionCheck: check } as unknown as Prisma.InputJsonObject },
    });
    return { check };
  });
