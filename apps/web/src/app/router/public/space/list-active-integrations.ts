import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { spaceVisibilityGuard } from "./middlewares/visibility-guard";

/**
 * Lista de integrações ativas. NUNCA expõe `config` (contém tokens/secrets).
 */
export const listActiveIntegrations = base
  .use(spaceVisibilityGuard)
  .input(z.object({ nick: z.string().min(1) }))
  .handler(async ({ context }) => {
    const rows = await prisma.platformIntegration.findMany({
      where: {
        organizationId: context.organization.id,
        isActive: true,
      },
      select: {
        id: true,
        platform: true,
        createdAt: true,
        // `config` NUNCA exposto — contém tokens
      },
    });
    return { integrations: rows };
  });
