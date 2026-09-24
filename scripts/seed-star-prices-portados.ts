/**
 * Porta para o catálogo os preços que viviam como constante no código (Fase 3).
 *
 * NÃO INVENTA VALOR NENHUM. Cada linha abaixo carrega a constante de origem no
 * campo `origem`, para que a revisão seja uma comparação direta com o código.
 * O objetivo é que a cobrança continue exatamente igual — o que muda é de onde
 * o preço vem, e que agora dá para ajustá-lo sem deploy.
 *
 * Idempotente: não sobrescreve linha existente.
 *
 *   pnpm tsx scripts/seed-star-prices-portados.ts
 */

import "dotenv/config";

import prisma from "../src/lib/prisma";

interface PortedPrice {
  action: string;
  label: string;
  /** Constante de onde o valor veio, para auditoria. */
  origem: string;
  stars?: number;
  unit?: string;
  unitCost?: number;
  unitDivisor?: number;
  minCharge?: number;
  maxCharge?: number;
  variantCosts?: Record<string, number>;
  allowBonus?: boolean;
}

const PORTED: PortedPrice[] = [
  // ── NASA Planner ────────────────────────────────────────────────────────
  {
    action: "planner_campaign_create",
    label: "NASA Planner — criar planejamento de campanha",
    origem: "create-campaign.ts STARS_COST",
    stars: 1,
  },
  {
    action: "planner_post_image",
    label: "NASA Planner — imagem de post",
    origem: "generate-post-image.ts MODEL_TO_STARS",
    stars: 3,
    maxCharge: 50,
    variantCosts: {
      ideogram_quality: 6,
      ideogram_balanced: 4,
      ideogram_turbo: 3,
      dalle3_hd: 5,
      dalle3_standard: 3,
      pollinations: 1,
    },
  },
  {
    action: "planner_image_prompt",
    label: "NASA Planner — imagem a partir de prompt",
    origem: "_helpers/ai-provider.ts STARS_IMAGE_*",
    stars: 3,
    maxCharge: 50,
    variantCosts: { hd: 5, standard: 3, pollinations: 1 },
  },
  {
    action: "planner_image_reference",
    label: "NASA Planner — imagem a partir de referência",
    origem: "generate-image-from-reference.ts STARS_IMG2IMG",
    stars: 1,
  },
  {
    action: "planner_post_generate",
    label: "NASA Planner — geração de conteúdo com IA",
    origem: "_helpers/ai-provider.ts STARS_POST_FULL",
    stars: 5,
  },
  {
    action: "planner_post_publish",
    label: "NASA Planner — publicação de post",
    origem: "_helpers/ai-provider.ts STARS_PUBLISH",
    stars: 1,
  },
  {
    action: "planner_post_schedule",
    label: "NASA Planner — agendamento de post",
    origem: "_helpers/ai-provider.ts STARS_SCHEDULE",
    stars: 1,
  },
  {
    action: "planner_video_generate",
    label: "NASA Planner — geração de vídeo com IA",
    origem: "generate-video-clip.ts STARS_VIDEO_FALAI / STARS_VIDEO_RUNWAY",
    stars: 3,
    maxCharge: 300,
    variantCosts: { falai: 3, runway: 15 },
  },
  {
    action: "planner_video_merge",
    label: "NASA Planner — montagem de vídeo",
    origem: "save-edited-video.ts STARS_MERGE_FFMPEG",
    stars: 1,
  },
  {
    action: "planner_transcription",
    label: "NASA Planner — transcrição de vídeo",
    origem: "transcribe-video.ts — 1★ por minuto estimado, mínimo 1★",
    unit: "minute",
    unitCost: 1,
    unitDivisor: 1,
    minCharge: 1,
    maxCharge: 200,
  },

  // ── ASTRO ───────────────────────────────────────────────────────────────
  {
    action: "astro_tokens",
    label: "ASTRO — consumo por tokens",
    origem: "chat/route.ts e astro-bot/stars-billing.ts STARS_PER_1K_TOKENS = 1",
    unit: "token",
    unitCost: 1,
    unitDivisor: 1000,
    minCharge: 1,
    maxCharge: 500,
  },

  // ── NASA Pages ──────────────────────────────────────────────────────────
  {
    action: "page_create",
    label: "NASA Pages — criação de site",
    origem: "_schemas.ts PAGES_STARS_COST",
    stars: 2000,
  },
  {
    action: "page_duplicate",
    label: "NASA Pages — duplicação de site",
    origem: "_schemas.ts PAGES_STARS_COST",
    stars: 2000,
  },

  // ── NASA Route ──────────────────────────────────────────────────────────
  {
    action: "route_video_upload",
    label: "NASA Route — upload de vídeo de aula",
    // O preço aqui NÃO é fixo: `computeVideoUploadCost` calcula a partir do
    // tamanho, do horizonte de 36 meses de hospedagem, da margem, do câmbio e
    // do preço da estrela. Achatar isso num valor por MB congelaria câmbio e
    // preço da estrela dentro do catálogo. A linha existe pelos metadados —
    // rótulo, teto de segurança e a proibição de pagar com bônus.
    origem: "video-storage-pricing.ts computeVideoUploadCost — fórmula, não constante",
    stars: 0,
    maxCharge: 5000,
    // Hospedagem não é coberta por bônus de boas-vindas.
    allowBonus: false,
  },

  // ── Meta Ads ────────────────────────────────────────────────────────────
  {
    action: "meta_ads_action",
    label: "Meta Ads — ação executada",
    origem: "execute-mcp-action.ts STARS_PER_TOOL",
    stars: 5,
    maxCharge: 20,
    variantCosts: {
      meta_ads_create_campaign: 5,
      meta_ads_update_campaign: 5,
      meta_ads_pause_campaign: 2,
      meta_ads_resume_campaign: 2,
      meta_ads_create_ad: 5,
    },
  },

  // ── NASA Command ────────────────────────────────────────────────────────
  {
    action: "nasa_command",
    label: "NASA Command — comando executado",
    origem: "execute-helpers.ts STAR_COSTS",
    stars: 1,
    maxCharge: 20,
    variantCosts: { query: 1, create: 3, ai_parse: 2, ai_generate: 8, move: 2 },
  },

  // ── Agendamento público ─────────────────────────────────────────────────
  {
    action: "booking_chat_message",
    label: "Chat de agendamento — mensagem processada pela IA",
    origem: "booking-chat/route.ts STARS_PER_BOOKING_MESSAGE",
    stars: 1,
  },
];

async function main() {
  let created = 0;
  let kept = 0;

  for (const price of PORTED) {
    const existing = await prisma.appStarCost.findUnique({
      where: { appSlug: price.action },
      select: { monthlyCost: true },
    });
    if (existing) {
      kept += 1;
      console.log(
        `[JÁ EXISTE] ${price.action.padEnd(26)} ${existing.monthlyCost}★ no banco, mantido`,
      );
      continue;
    }

    await prisma.appStarCost.create({
      data: {
        appSlug: price.action,
        monthlyCost: price.stars ?? 0,
        setupCost: 0,
        displayName: price.label,
        description: `Portado de ${price.origem}`,
        category: "action",
        isPublic: false,
        unit: price.unit,
        unitCost: price.unitCost,
        unitDivisor: price.unitDivisor ?? 1,
        minCharge: price.minCharge ?? 0,
        maxCharge: price.maxCharge,
        variantCosts: price.variantCosts,
        allowBonus: price.allowBonus ?? true,
      },
    });
    created += 1;
    const shown = price.unit
      ? `${price.unitCost}★/${price.unit}`
      : `${price.stars}★`;
    console.log(
      `[CRIADO]    ${price.action.padEnd(26)} ${shown.padEnd(14)} ← ${price.origem}`,
    );
  }

  console.log(`\n${created} criada(s), ${kept} já existente(s).`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
