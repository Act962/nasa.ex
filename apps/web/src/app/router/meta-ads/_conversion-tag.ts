import prisma from "@/lib/prisma";

/**
 * Tag de conversão para integração Meta — vive em
 * `PlatformIntegration.config.conversionTagId` (JSON).
 *
 * Quando configurada, redefine como "Conv." é contada nos relatórios:
 * em vez de pegar `actions[].offsite_conversion.*` da Meta API, contamos
 * quantos leads únicos da org têm essa tag E estão atribuídos à entidade
 * (metaCampaignId / metaAdsetId / metaAdId) no período.
 *
 * Quando NULL, mantém o comportamento legado (métrica nativa Meta).
 */

export async function getMetaConversionTagId(
  orgId: string,
): Promise<string | null> {
  const integ = await prisma.platformIntegration.findUnique({
    where: {
      organizationId_platform: { organizationId: orgId, platform: "META" },
    },
    select: { config: true },
  });
  if (!integ) return null;
  const config = (integ.config ?? {}) as Record<string, unknown>;
  const tagId = config.conversionTagId;
  return typeof tagId === "string" && tagId.length > 0 ? tagId : null;
}

export async function setMetaConversionTagId(
  orgId: string,
  tagId: string | null,
): Promise<void> {
  const integ = await prisma.platformIntegration.findUnique({
    where: {
      organizationId_platform: { organizationId: orgId, platform: "META" },
    },
    select: { config: true },
  });
  if (!integ) throw new Error("Integração Meta não configurada");

  const config = ((integ.config ?? {}) as Record<string, unknown>) ?? {};
  if (tagId === null) {
    delete config.conversionTagId;
  } else {
    config.conversionTagId = tagId;
  }

  await prisma.platformIntegration.update({
    where: {
      organizationId_platform: { organizationId: orgId, platform: "META" },
    },
    data: { config: config as object },
  });
}
