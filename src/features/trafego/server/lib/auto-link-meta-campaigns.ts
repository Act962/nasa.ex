import "server-only";
import prisma from "@/lib/prisma";
import { extractOrderCodes } from "@/features/trafego/lib/campaign-code";
import { loadTrafegoSettings } from "./trafego-settings";

/**
 * Liga o pedido à campanha do Meta pelo código no nome — em vez de alguém
 * colar o ID no admin.
 *
 * Roda depois do cron que espelha a estrutura, e só para a org da AGÊNCIA:
 * outra organização pode ter uma campanha chamada "TG-0007" por coincidência,
 * e vincular por nome cruzando orgs seria vazamento de métrica.
 *
 * Nunca sobrescreve vínculo existente — se a equipe ligou à mão, manda ela.
 * Ambiguidade (dois nomes com o mesmo código, ou um nome com dois códigos)
 * não vincula nada e vira notificação: adivinhar aqui mostraria número errado
 * para o cliente, que é pior do que não mostrar número nenhum.
 */
export interface AutoLinkCampaign {
  id: string;
  name: string;
}

export interface AutoLinkResult {
  linked: string[];
  ambiguous: string[];
  skipped: number;
}

export async function autoLinkTrafegoMetaCampaigns(params: {
  organizationId: string;
  campaigns: AutoLinkCampaign[];
}): Promise<AutoLinkResult> {
  const settings = await loadTrafegoSettings();
  if (settings.agencyOrganizationId !== params.organizationId) {
    return { linked: [], ambiguous: [], skipped: 0 };
  }

  // code → ids de campanha que o citam
  const byCode = new Map<string, string[]>();
  for (const campaign of params.campaigns) {
    const codes = extractOrderCodes(campaign.name);
    // Nome que cita dois pedidos não serve para nenhum dos dois.
    if (codes.length !== 1) continue;
    const existing = byCode.get(codes[0]) ?? [];
    existing.push(campaign.id);
    byCode.set(codes[0], existing);
  }
  if (byCode.size === 0) return { linked: [], ambiguous: [], skipped: 0 };

  const orders = await prisma.trafegoOrder.findMany({
    where: {
      code: { in: [...byCode.keys()] },
      platform: "META_ADS",
      metaCampaignExternalId: null,
    },
    select: { id: true, code: true, status: true },
  });

  const linked: string[] = [];
  const ambiguous: string[] = [];
  let skipped = 0;

  for (const order of orders) {
    const campaignIds = byCode.get(order.code) ?? [];
    if (campaignIds.length !== 1) {
      ambiguous.push(order.code);
      continue;
    }
    const externalId = campaignIds[0];

    // O mesmo id do Meta não pode servir a dois pedidos: o segundo veria os
    // números do primeiro.
    const taken = await prisma.trafegoOrder.count({
      where: { metaCampaignExternalId: externalId, id: { not: order.id } },
    });
    if (taken > 0) {
      skipped++;
      continue;
    }

    const localCampaign = await prisma.metaAdCampaign.findUnique({
      where: { metaCampaignId: externalId },
      select: { id: true },
    });

    await prisma.$transaction([
      prisma.trafegoOrder.update({
        where: { id: order.id },
        data: {
          metaCampaignExternalId: externalId,
          metricsOrganizationId: params.organizationId,
          metaAdCampaignId: localCampaign?.id ?? null,
          metaAutoLinkedAt: new Date(),
        },
      }),
      prisma.trafegoOrderEvent.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: order.status,
          title: "Campanha do Meta vinculada automaticamente",
          detail: `Encontrada pelo código no nome da campanha (${externalId}).`,
          isClientVisible: false,
          source: "SYSTEM",
        },
      }),
    ]);
    linked.push(order.code);
  }

  if (ambiguous.length > 0) {
    await notifyAmbiguity(ambiguous).catch((error) =>
      console.error("[trafego/auto-link] aviso de ambiguidade falhou:", error),
    );
  }

  return { linked, ambiguous, skipped };
}

async function notifyAmbiguity(codes: string[]): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { isSystemAdmin: true, isActive: true },
    select: { id: true },
  });
  if (admins.length === 0) return;

  await prisma.userNotification.createMany({
    data: admins.map((admin) => ({
      userId: admin.id,
      type: "CUSTOM" as const,
      title: "trafeGO: código de pedido repetido no Meta",
      body: `Mais de uma campanha cita ${codes.join(", ")}. Renomeie para uma campanha por código ou vincule à mão.`,
      appKey: "trafego",
      actionUrl: "/admin/trafego",
    })),
  });
}
