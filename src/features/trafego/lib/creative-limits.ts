// Anúncios rodando ao mesmo tempo por campanha (spec 0127). Puro: roda no QA.

/** Faixas de verba → anúncios incluídos. Pouca verba com muitos anúncios divide a entrega e nada aprende. */
const INCLUDED_ADS_BY_BUDGET = [
  { maxBudgetBrlCents: 50_000, includedAds: 3 },
  { maxBudgetBrlCents: 200_000, includedAds: 5 },
  { maxBudgetBrlCents: null, includedAds: 8 },
] as const;

/** Teto técnico de arquivos enviados por pedido, só contra abuso (RF-5). */
export const MAX_UPLOADED_CREATIVES = 20;

export function resolveIncludedAds(adBudgetBrlCents: number): number {
  const tier = INCLUDED_ADS_BY_BUDGET.find(
    (candidate) => candidate.maxBudgetBrlCents === null || adBudgetBrlCents <= candidate.maxBudgetBrlCents,
  );
  return tier?.includedAds ?? INCLUDED_ADS_BY_BUDGET[0].includedAds;
}

interface CampaignForCount {
  id: string;
  status: string | null;
  adsets?: { id: string; status: string | null }[];
  ads: { id?: string; status: string | null; adsetId?: string }[];
}

/** Anúncios no ar: anúncio, conjunto e campanha ACTIVE (RF-3). Pausado ou arquivado libera a vaga. */
export function countRunningAds(
  campaigns: CampaignForCount[],
  options?: { excludeCampaignId?: string; excludeAdsetId?: string; excludeAdId?: string },
): number {
  return campaigns
    .filter((campaign) => campaign.id !== options?.excludeCampaignId && campaign.status === "ACTIVE")
    .reduce((total, campaign) => {
      const pausedAdsetIds = new Set(
        (campaign.adsets ?? []).filter((adset) => adset.status !== "ACTIVE").map((adset) => adset.id),
      );
      const runningAds = campaign.ads.filter(
        (ad) =>
          ad.status === "ACTIVE" &&
          !(ad.adsetId && (pausedAdsetIds.has(ad.adsetId) || ad.adsetId === options?.excludeAdsetId)) &&
          !(ad.id && ad.id === options?.excludeAdId),
      );
      return total + runningAds.length;
    }, 0);
}

export function runningAdsLimitMessage(maxAds: number): string {
  return `Esta campanha roda até ${maxAds} anúncios ao mesmo tempo. Pause um anúncio ou peça mais à equipe.`;
}
