import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { IntegrationPlatform } from "@/generated/prisma/enums";
import { assertSafeSeiEndpoint } from "@/features/sei/server/sei-client";
import { encryptSeiIdentification } from "@/features/sei/server/sei-config";
import { inngest } from "@/inngest/client";

const seiConfigSchema = z.object({
  endpoint: z.url("Informe uma URL válida para o WebService do SEI."),
  siglaSistema: z.string().trim().min(1, "Informe a sigla cadastrada no SEI."),
  identificacaoServico: z.string().trim().optional(),
  idUnidade: z.string().trim().min(1, "Informe a unidade padrão do SEI."),
});

export const upsertPlatformIntegration = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      platform: z.nativeEnum(IntegrationPlatform),
      config: z.record(z.string(), z.string()),
      isActive: z.boolean().default(true),
    }),
  )
  .handler(async ({ input, context }) => {
    let config: Record<string, string> = input.config;

    if (input.platform === IntegrationPlatform.SEI) {
      const parsed = seiConfigSchema.parse(input.config);
      await assertSafeSeiEndpoint(parsed.endpoint);
      const current = await prisma.platformIntegration.findUnique({
        where: {
          organizationId_platform: {
            organizationId: context.org.id,
            platform: IntegrationPlatform.SEI,
          },
        },
        select: { config: true },
      });
      const currentConfig = (current?.config ?? {}) as Record<string, unknown>;
      const identification = parsed.identificacaoServico
        ? encryptSeiIdentification(parsed.identificacaoServico)
        : String(currentConfig.identificacaoServico ?? "");
      if (!identification) {
        throw new Error("Informe a chave de acesso/identificação do serviço SEI.");
      }
      config = {
        endpoint: parsed.endpoint,
        siglaSistema: parsed.siglaSistema,
        identificacaoServico: identification,
        idUnidade: parsed.idUnidade,
      };
    }

    const integration = await prisma.platformIntegration.upsert({
      where: {
        organizationId_platform: {
          organizationId: context.org.id,
          platform: input.platform,
        },
      },
      create: {
        organizationId: context.org.id,
        platform: input.platform,
        config,
        isActive: input.isActive,
      },
      update: {
        config,
        isActive: input.isActive,
      },
    });
    if (input.platform === IntegrationPlatform.SEI && input.isActive) {
      await inngest.send({
        name: "sei/test-connection",
        data: { organizationId: context.org.id },
      });
    }
    return { integration };
  });
