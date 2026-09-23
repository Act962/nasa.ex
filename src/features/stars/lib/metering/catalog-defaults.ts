// Padrões de catálogo em tempo de compilação — última camada antes de "sem preço".
//
// Estes valores NÃO definem preço novo. Eles definem apenas a FORMA da cobrança
// (unidade, divisor, teto) de ações que cobram por quantidade, para que a linha
// cadastrada no banco só precise informar o valor.
//
// O preço em si é decisão de negócio e mora no banco, editável sem deploy.
// Por isso todo `baseCost`/`unitCost` aqui é 0: enquanto o admin não cadastrar,
// a ação não cobra — mas agora ela aparece no relatório de ações sem preço em
// vez de sumir em silêncio.

import type { MeterUnit, VariantMode } from "./types";

export interface CatalogDefault {
  unit: MeterUnit;
  unitDivisor?: number;
  minCharge?: number;
  /** Teto obrigatório em cobrança por quantidade (D-5 da spec 0020). */
  maxCharge?: number;
  variantMode?: VariantMode;
  allowBonus?: boolean;
  displayName?: string;
}

/**
 * Forma da cobrança por ação. A ausência de entrada aqui significa custo fixo
 * (`unit: "call"`), que é o comportamento de todas as ações existentes hoje.
 */
export const CATALOG_DEFAULTS: Record<string, CatalogDefault> = {
  astro_tokens: {
    unit: "token",
    unitDivisor: 1000,
    minCharge: 1,
    maxCharge: 500,
    displayName: "ASTRO — consumo por tokens",
  },
  planner_image: {
    unit: "image",
    maxCharge: 50,
    variantMode: "absolute",
    displayName: "NASA Planner — geração de imagem",
  },
  planner_video: {
    unit: "second",
    maxCharge: 300,
    variantMode: "absolute",
    displayName: "NASA Planner — geração de vídeo",
  },
  planner_transcription: {
    unit: "minute",
    minCharge: 1,
    maxCharge: 200,
    displayName: "NASA Planner — transcrição de áudio",
  },
  route_video_upload: {
    unit: "mb",
    minCharge: 1,
    maxCharge: 5000,
    displayName: "NASA Route — upload de vídeo",
  },
};

/**
 * Ações que o código cobra e que seguem sem preço. Enquanto estiverem aqui,
 * continuam gratuitas — mas visíveis no relatório de ações sem preço.
 *
 * Definir o valor de cada uma é decisão de negócio (RF-9 da spec 0020): estas
 * nunca tiveram valor decidido em lugar nenhum, nem em `DEFAULT_STAR_RULES` nem
 * no seed. A decisão espera a medição de custo da spec 0021.
 *
 * Fora desta lista, mas ainda sem linha no banco, estão `astro_prompt` (5★) e
 * `calendar_share_enable` (5★): têm valor decidido em `prisma/seed-star-rules.ts`
 * e dependem apenas de alguém rodar `scripts/seed-star-prices.ts`. `astro_prompt`
 * é o caso sensível — cadastrá-lo passa a cobrar cada prompt do ASTRO.
 *
 * Ver docs/relatorios/inventario-stars-2026-09-18.md §3.1.
 */
export const ACTIONS_WITHOUT_PRICE = [
  "check_payment_query",
  "form_publish",
  "linnker_page_create",
  "linnker_scan_capture",
  "nasa_planner_post_create",
  "page_publish",
  "send_email_transactional",
  "tracking_preset_apply",
  "workspace_action_create",
] as const;
