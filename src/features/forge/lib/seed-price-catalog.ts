// Seed do catálogo de preços do Simulador. Idempotente por upsert na chave
// única (organizationId, category, code). Reusado pelo script de seed e pelo
// lazy-load da procedure `listPriceItems` (primeiro acesso de cada org).
//
// Preços marcados com source "seed:conferir" são valores de referência e devem
// ser conferidos nas páginas oficiais antes de embasar preço de proposta.

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { listPricedModels } from "@/features/ia/lib/token-pricing";

type SeedRow = {
  category:
    | "AI_MODEL"
    | "WHATSAPP_CONVERSATION"
    | "INFRA_SERVER"
    | "HOSTING"
    | "STORAGE"
    | "DATABASE"
    | "LABOR"
    | "OTHER";
  name: string;
  code: string;
  provider?: string;
  currency: "BRL" | "USD";
  unit:
    | "PER_1K_TOKENS"
    | "PER_CONVERSATION"
    | "PER_MONTH"
    | "PER_HOUR"
    | "PER_GB_MONTH"
    | "PER_COMPUTE_HOUR"
    | "FLAT";
  unitPrice?: number;
  inputPer1k?: number;
  outputPer1k?: number;
  cachedInputPer1k?: number;
  metadata?: Record<string, unknown>;
  source: string;
  sortOrder?: number;
};

const PROVIDER_LABEL: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  other: "Outro",
};

function aiModelRows(): SeedRow[] {
  return listPricedModels().map((model, index) => ({
    category: "AI_MODEL",
    name: model.modelId,
    code: model.modelId,
    provider: PROVIDER_LABEL[model.provider] ?? model.provider,
    currency: "USD",
    unit: "PER_1K_TOKENS",
    inputPer1k: model.pricing.inputPer1k,
    outputPer1k: model.pricing.outputPer1k,
    cachedInputPer1k: model.pricing.cachedInputPer1k,
    metadata: { provider: model.provider },
    source: "seed:token-pricing",
    sortOrder: index,
  }));
}

// Mensagens WhatsApp (Meta) por categoria — Brasil/BRL, cobrança POR MENSAGEM.
// Fonte oficial: https://whatsappbusiness.com/pt-br/products/platform-pricing (Brasil, BRL).
const WHATSAPP_ROWS: SeedRow[] = [
  { category: "WHATSAPP_CONVERSATION", name: "Mensagem Marketing", code: "MARKETING", provider: "Meta", currency: "BRL", unit: "PER_CONVERSATION", unitPrice: 0.3217, source: "seed:whatsapp-oficial", sortOrder: 0 },
  { category: "WHATSAPP_CONVERSATION", name: "Mensagem Utilidade", code: "UTILITY", provider: "Meta", currency: "BRL", unit: "PER_CONVERSATION", unitPrice: 0.035, source: "seed:whatsapp-oficial", sortOrder: 1 },
  { category: "WHATSAPP_CONVERSATION", name: "Mensagem Autenticação", code: "AUTHENTICATION", provider: "Meta", currency: "BRL", unit: "PER_CONVERSATION", unitPrice: 0.035, source: "seed:whatsapp-oficial", sortOrder: 2 },
  { category: "WHATSAPP_CONVERSATION", name: "Mensagem Serviço", code: "SERVICE", provider: "Meta", currency: "BRL", unit: "PER_CONVERSATION", unitPrice: 0.035, source: "seed:whatsapp-oficial", sortOrder: 3 },
];

// Cloudflare (storage/hosting) — conferir em https://www.cloudflare.com/plans/
const CLOUDFLARE_ROWS: SeedRow[] = [
  { category: "STORAGE", name: "Cloudflare R2 — Armazenamento", code: "cloudflare-r2-storage", provider: "Cloudflare", currency: "USD", unit: "PER_GB_MONTH", unitPrice: 0.015, source: "seed:conferir", sortOrder: 0 },
  { category: "HOSTING", name: "Cloudflare Workers Paid", code: "cloudflare-workers-paid", provider: "Cloudflare", currency: "USD", unit: "PER_MONTH", unitPrice: 5, source: "seed:conferir", sortOrder: 0 },
];

// Neon (banco) — conferir em https://neon.com/pricing
const NEON_ROWS: SeedRow[] = [
  { category: "DATABASE", name: "Neon Launch", code: "neon-launch", provider: "Neon", currency: "USD", unit: "PER_MONTH", unitPrice: 19, source: "seed:conferir", sortOrder: 0 },
  { category: "DATABASE", name: "Neon Scale", code: "neon-scale", provider: "Neon", currency: "USD", unit: "PER_MONTH", unitPrice: 69, source: "seed:conferir", sortOrder: 1 },
  { category: "DATABASE", name: "Neon Compute", code: "neon-compute", provider: "Neon", currency: "USD", unit: "PER_COMPUTE_HOUR", unitPrice: 0.16, source: "seed:conferir", sortOrder: 2 },
];

const INFRA_ROWS: SeedRow[] = [
  { category: "INFRA_SERVER", name: "VPS Básico", code: "vps-basico", currency: "BRL", unit: "PER_MONTH", unitPrice: 50, source: "seed:default", sortOrder: 0 },
  { category: "INFRA_SERVER", name: "VPS Intermediário", code: "vps-intermediario", currency: "BRL", unit: "PER_MONTH", unitPrice: 150, source: "seed:default", sortOrder: 1 },
];

const LABOR_ROWS: SeedRow[] = [
  { category: "LABOR", name: "Desenvolvedor", code: "dev-hora", currency: "BRL", unit: "PER_HOUR", unitPrice: 90, source: "seed:default", sortOrder: 0 },
  { category: "LABOR", name: "Designer", code: "designer-hora", currency: "BRL", unit: "PER_HOUR", unitPrice: 75, source: "seed:default", sortOrder: 1 },
  { category: "LABOR", name: "Gerente de Projeto", code: "pm-hora", currency: "BRL", unit: "PER_HOUR", unitPrice: 110, source: "seed:default", sortOrder: 2 },
  { category: "LABOR", name: "Suporte (mensalista)", code: "suporte-mes", currency: "BRL", unit: "PER_MONTH", unitPrice: 3500, source: "seed:default", sortOrder: 3 },
];

export function forgePriceCatalogRows(): SeedRow[] {
  return [
    ...aiModelRows(),
    ...WHATSAPP_ROWS,
    ...CLOUDFLARE_ROWS,
    ...NEON_ROWS,
    ...INFRA_ROWS,
    ...LABOR_ROWS,
  ];
}

export async function seedForgePriceCatalog(
  db: PrismaClient,
  organizationId: string,
): Promise<number> {
  const rows = forgePriceCatalogRows();
  for (const row of rows) {
    const data = {
      category: row.category,
      name: row.name,
      code: row.code,
      provider: row.provider ?? null,
      currency: row.currency,
      unit: row.unit,
      unitPrice: row.unitPrice ?? null,
      inputPer1k: row.inputPer1k ?? null,
      outputPer1k: row.outputPer1k ?? null,
      cachedInputPer1k: row.cachedInputPer1k ?? null,
      metadata: (row.metadata ?? {}) as Prisma.InputJsonValue,
      isSeeded: true,
      source: row.source,
      sortOrder: row.sortOrder ?? 0,
    };
    await db.forgePriceItem.upsert({
      where: {
        organizationId_category_code: {
          organizationId,
          category: row.category,
          code: row.code,
        },
      },
      // Não sobrescreve edições do admin: só completa metadados/flags.
      update: { isSeeded: true },
      create: { organizationId, ...data },
    });
  }
  return rows.length;
}
