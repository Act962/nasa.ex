import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import z from "zod";

/**
 * Retorna APENAS os segredos de conexão Uazapi de uma instância
 * (`apiKey`/`baseUrl`), com escopo de organização. Uso restrito ao fluxo
 * de conexão/criação/exclusão de instância no app de Configurações, que
 * fala HTTP direto com a Uazapi do browser (QR code, pareamento, status).
 *
 * O payload geral do chat (`integrations.get` / `tracking.list`) NÃO
 * carrega mais o token — ver `router/integrations/list.ts`.
 */
export const getConnectionSecrets = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Get instance connection secrets (Uazapi)",
    tags: ["Integrations"],
  })
  .input(
    z.object({
      trackingId: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    const instance = await prisma.whatsAppInstance.findFirst({
      where: {
        trackingId: input.trackingId,
        organizationId: context.org?.id,
      },
      select: {
        apiKey: true,
        baseUrl: true,
        instanceId: true,
      },
    });
    return instance;
  });
