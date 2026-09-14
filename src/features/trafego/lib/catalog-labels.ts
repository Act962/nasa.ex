/**
 * Rótulos do catálogo trafeGO e a ponte com o vocabulário das plataformas.
 *
 * `META_OBJECTIVE` e `GOOGLE_CAMPAIGN_TYPE` traduzem nosso enum para o termo
 * que a equipe usa ao criar a campanha real em cada gerenciador.
 */

import type {
  TrafegoCampaignType,
  TrafegoObjective,
  TrafegoPlatform,
} from "@/generated/prisma/enums";

export const PLATFORM_LABEL: Record<TrafegoPlatform, string> = {
  META_ADS: "Tráfego pago — Meta (Facebook e Instagram)",
  GOOGLE_ADS: "Tráfego pago — Google (Pesquisa, YouTube e Display)",
  WHATSAPP_OFICIAL: "Disparo — WhatsApp API Oficial",
};

export const PLATFORM_SHORT_LABEL: Record<TrafegoPlatform, string> = {
  META_ADS: "Meta Ads",
  GOOGLE_ADS: "Google Ads",
  WHATSAPP_OFICIAL: "WhatsApp Oficial",
};

export const CAMPAIGN_TYPE_LABEL: Record<TrafegoCampaignType, string> = {
  PROSPECCAO: "Prospecção",
  REMARKETING: "Remarketing",
  VENDA_DIRETA: "Venda direta",
  RECONHECIMENTO: "Reconhecimento",
  RELACIONAMENTO: "Relacionamento",
};

export const CAMPAIGN_TYPE_SHORT_LABEL = CAMPAIGN_TYPE_LABEL;

export const CAMPAIGN_TYPE_DESCRIPTION: Record<TrafegoCampaignType, string> = {
  PROSPECCAO: "Alcançar quem ainda não te conhece",
  REMARKETING: "Reimpactar quem já interagiu",
  VENDA_DIRETA: "Converter agora",
  RECONHECIMENTO: "Tornar a marca conhecida",
  RELACIONAMENTO: "Manter a base aquecida",
};

export const OBJECTIVE_LABEL: Record<TrafegoObjective, string> = {
  LEADS: "Gerar leads",
  TRAFFIC: "Visitas no site",
  SALES: "Vender",
  AWARENESS: "Reconhecimento",
  ENGAGEMENT: "Engajamento",
  MESSAGES: "Mensagens no WhatsApp",
  BROADCAST: "Disparo para lista",
  SEARCH: "Aparecer na busca",
};

export const OBJECTIVE_DESCRIPTION: Record<TrafegoObjective, string> = {
  LEADS: "Captar contatos interessados",
  TRAFFIC: "Levar gente para o seu site",
  SALES: "Vender produto ou serviço",
  AWARENESS: "Fazer mais gente conhecer você",
  ENGAGEMENT: "Curtidas, comentários e seguidores",
  MESSAGES: "Receber conversas no WhatsApp",
  BROADCAST: "Enviar mensagem para seus contatos",
  SEARCH: "Aparecer para quem já está procurando",
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

/** Objetivo trafeGO → tipo de campanha no Google Ads. */
export const GOOGLE_CAMPAIGN_TYPE: Partial<Record<TrafegoObjective, string>> = {
  SEARCH: "Search",
  LEADS: "Search (Lead form)",
  TRAFFIC: "Performance Max",
  SALES: "Performance Max",
  AWARENESS: "Display / YouTube",
};

/** Objetivos oferecidos por plataforma no wizard público. */
export const OBJECTIVES_BY_PLATFORM: Record<TrafegoPlatform, TrafegoObjective[]> = {
  META_ADS: ["LEADS", "MESSAGES", "SALES", "TRAFFIC", "ENGAGEMENT", "AWARENESS"],
  GOOGLE_ADS: ["SEARCH", "LEADS", "SALES", "TRAFFIC", "AWARENESS"],
  WHATSAPP_OFICIAL: ["BROADCAST"],
};

/** Tipos de campanha oferecidos por plataforma. */
export const CAMPAIGN_TYPES_BY_PLATFORM: Record<
  TrafegoPlatform,
  TrafegoCampaignType[]
> = {
  META_ADS: [
    "PROSPECCAO",
    "REMARKETING",
    "VENDA_DIRETA",
    "RECONHECIMENTO",
    "RELACIONAMENTO",
  ],
  GOOGLE_ADS: ["PROSPECCAO", "REMARKETING", "VENDA_DIRETA", "RECONHECIMENTO"],
  WHATSAPP_OFICIAL: ["RELACIONAMENTO", "VENDA_DIRETA", "REMARKETING"],
};
