import "server-only";
import type { ActiveCampaign } from "@/features/star-friends/lib/campaign/campaign";
import type { RegisterReceiptResult } from "@/features/star-friends/lib/campaign/register-receipt";
import { getMemberLifetimeStars } from "@/features/star-friends/lib/members";
import { getActiveProgram } from "@/features/star-friends/lib/program";
import { acceptedReceiptMessage, campaignNoun, pendingReviewMessage, type CampaignMode } from "@/features/star-friends/utils/campaign-messages";
import { resolveTier, TIER_LABELS } from "@/features/star-friends/utils/tiers";
import type { CodedReplyOption } from "./coded-reply";
import { CAMPAIGN_OPTION } from "./coded-menu-options";

// Respostas da campanha por cupom que dependem do modo (sorteio da 0102 ou pontos da 0135).

/** RF-4: no modo pontos, "Ver prêmios" entra no lugar de "Ver meus códigos". */
export function memberOptionsFor(mode: CampaignMode): CodedReplyOption[] {
  return [
    { id: CAMPAIGN_OPTION.newReceipt, title: "Cadastrar novo cupom" },
    { id: CAMPAIGN_OPTION.points, title: "Ver meus pontos" },
    mode === "POINTS" ? { id: CAMPAIGN_OPTION.rewards, title: "Ver prêmios" } : { id: CAMPAIGN_OPTION.codes, title: "Ver meus códigos" },
  ];
}

export function wrongDeviceMessage(mode: CampaignMode): string {
  return `Você não está acessando pelo dispositivo que se cadastrou ${campaignNoun(mode).in}.`;
}

export function receiptReplyOf(result: RegisterReceiptResult, campaign: ActiveCampaign, starsBalance: number | null): string {
  const noun = campaignNoun(campaign.mode);
  switch (result.outcome) {
    case "accepted":
      return acceptedReceiptMessage({
        mode: campaign.mode,
        totalCents: result.totalCents,
        codes: result.codes,
        carryOverCents: result.carryOverCents,
        amountPerNumberCents: campaign.amountPerNumberCents,
        starsBalance,
      });
    case "duplicate":
      return `Este cupom já foi cadastrado ${noun.in}. Cada cupom vale uma vez só.`;
    case "rejected":
      if (result.reason === "wrong_issuer") return `Este cupom não é de uma compra feita na nossa loja, então não vale para ${noun.the}.`;
      if (result.reason === "out_of_period") return `A data desta compra está fora do período ${noun.of}.`;
      if (result.reason === "not_a_receipt") return "Essa imagem não parece ser um cupom de compra. Envie a foto do cupom inteiro, com o valor total e a data.";
      return "Não consegui ler o valor do cupom nesta foto. Tire outra foto com o cupom inteiro, bem iluminado e sem dobras, e envie de novo.";
    case "pending_review":
      return pendingReviewMessage(campaign.mode);
    case "daily_limit":
      return "Você atingiu o limite de cupons de hoje. Amanhã você pode cadastrar mais.";
    case "file_missing":
      return "Não consegui abrir o arquivo. Envie a foto do cupom de novo, por favor.";
    case "try_later":
      return "Não consegui conferir o cupom agora. Tente de novo em alguns minutos.";
    case "already_processed":
      return receiptReplyOf(result.stored, campaign, starsBalance);
  }
}

export async function tierLabelOf(organizationId: string, memberId: string): Promise<string | null> {
  const [program, lifetimeStars] = await Promise.all([getActiveProgram(organizationId), getMemberLifetimeStars(memberId)]);
  return program ? TIER_LABELS[resolveTier(lifetimeStars, program)] : null;
}

