/**
 * Rótulos do catálogo trafeGO e a ponte com o vocabulário do Meta.
 *
 * `METa_OBJECTIVE` mapeia nosso enum pros `OUTCOME_*` da Graph API — a equipe
 * usa esse valor ao criar a campanha real em `metaAds.campaigns.create`.
 */

import type {
  TrafegoCampaignType,
  TrafegoObjective,
  TrafegoPlatform,
} from "@/generated/prisma/enums";

export const PLATFORM_LABEL: Record<TrafegoPlatform, string> = {
  META_ADS: "Tráfego pago — Meta (Facebook e Instagram)",
  WHATSAPP_OFICIAL: "Disparo — WhatsApp API Oficial",
};

export const PLATFORM_SHORT_LABEL: Record<TrafegoPlatform, string> = {
  META_ADS: "Meta Ads",
  WHATSAPP_OFICIAL: "WhatsApp Oficial",
};

export const CAMPAIGN_TYPE_LABEL: Record<TrafegoCampaignType, string> = {
  PROSPECCAO: "Prospecção — alcançar quem ainda não te conhece",
  REMARKETING: "Remarketing — reimpactar quem já interagiu",
  VENDA_DIRETA: "Venda direta — converter agora",
  RECONHECIMENTO: "Reconhecimento — tornar a marca conhecida",
  RELACIONAMENTO: "Relacionamento — manter a base aquecida",
};

export const CAMPAIGN_TYPE_SHORT_LABEL: Record<TrafegoCampaignType, string> = {
  PROSPECCAO: "Prospecção",
  REMARKETING: "Remarketing",
  VENDA_DIRETA: "Venda direta",
  RECONHECIMENTO: "Reconhecimento",
  RELACIONAMENTO: "Relacionamento",
};

export const OBJECTIVE_LABEL: Record<TrafegoObjective, string> = {
  LEADS: "Gerar leads",
  TRAFFIC: "Levar tráfego pro site",
  SALES: "Vender",
  AWARENESS: "Reconhecimento de marca",
  ENGAGEMENT: "Engajamento",
  MESSAGES: "Receber mensagens no WhatsApp",
  BROADCAST: "Disparar mensagem pra uma lista",
};

/** Objetivo trafeGO → `objective` da Graph API do Meta. */
export const META_OBJECTIVE: Partial<Record<TrafegoObjective, string>> = {
  LEADS: "OUTCOME_LEADS",
  TRAFFIC: "OUTCOME_TRAFFIC",
  SALES: "OUTCOME_SALES",
  AWARENESS: "OUTCOME_AWARENESS",
  ENGAGEMENT: "OUTCOME_ENGAGEMENT",
  MESSAGES: "OUTCOME_ENGAGEMENT",
};

/** Objetivos oferecidos por plataforma no wizard público. */
export const OBJECTIVES_BY_PLATFORM: Record<TrafegoPlatform, TrafegoObjective[]> = {
  META_ADS: ["LEADS", "TRAFFIC", "SALES", "AWARENESS", "ENGAGEMENT", "MESSAGES"],
  WHATSAPP_OFICIAL: ["BROADCAST"],
};
