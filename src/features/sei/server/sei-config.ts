import "server-only";

import { IntegrationPlatform } from "@/generated/prisma/enums";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import prisma from "@/lib/prisma";
import type { SeiConfig } from "./sei-client";

const ENCRYPTED_PREFIX = "enc:";

export function encryptSeiIdentification(value: string): string {
  if (value.startsWith(ENCRYPTED_PREFIX)) return value;
  return `${ENCRYPTED_PREFIX}${encryptSecret(value)}`;
}

export function decryptSeiIdentification(value: string): string {
  if (!value.startsWith(ENCRYPTED_PREFIX)) return value;
  return decryptSecret(value.slice(ENCRYPTED_PREFIX.length));
}

export async function getSeiConfig(organizationId: string): Promise<SeiConfig> {
  const integration = await prisma.platformIntegration.findUnique({
    where: {
      organizationId_platform: {
        organizationId,
        platform: IntegrationPlatform.SEI,
      },
    },
    select: { config: true, isActive: true },
  });
  if (!integration?.isActive) throw new Error("Integração SEI não está ativa.");

  const config = integration.config as Record<string, unknown>;
  const endpoint = String(config.endpoint ?? "").trim();
  const siglaSistema = String(config.siglaSistema ?? "").trim();
  const identificacao = String(config.identificacaoServico ?? "").trim();
  const idUnidade = String(config.idUnidade ?? "").trim();
  if (!endpoint || !siglaSistema || !identificacao || !idUnidade) {
    throw new Error("Configuração do SEI está incompleta.");
  }

  return {
    endpoint,
    siglaSistema,
    identificacaoServico: decryptSeiIdentification(identificacao),
    idUnidade,
  };
}
