// Visual da proposta pública (spec 0150): modelo, cores, seções e formas de pagamento. Regras puras, usadas no servidor e na tela.
import { z } from "zod";

export const PROPOSAL_TEMPLATES = [
  { id: "modern", name: "Moderno", description: "Faixa da marca no topo e cartões arredondados." },
  { id: "classic", name: "Clássico", description: "Cabeçalho reto e tabela de itens, com cara de documento." },
  { id: "compact", name: "Compacto", description: "Uma coluna, sem imagens, para propostas curtas." },
] as const;
export type ProposalTemplateId = (typeof PROPOSAL_TEMPLATES)[number]["id"];
export const DEFAULT_PROPOSAL_TEMPLATE: ProposalTemplateId = "modern";

export const PROPOSAL_SECTIONS = [
  { id: "client", label: "Dados do cliente" },
  { id: "description", label: "Descrição" },
  { id: "items", label: "Itens" },
  { id: "totals", label: "Totais" },
  { id: "payment", label: "Formas de pagamento" },
  { id: "terms", label: "Condições comerciais" },
  { id: "responsible", label: "Responsável" },
  { id: "cta", label: "Vamos fechar negócio?" },
] as const;
export type ProposalSectionId = (typeof PROPOSAL_SECTIONS)[number]["id"];
export interface ProposalSectionSetting {
  id: ProposalSectionId;
  enabled: boolean;
}
export const DEFAULT_PROPOSAL_SECTIONS: ProposalSectionSetting[] = PROPOSAL_SECTIONS.map((section) => ({ id: section.id, enabled: true }));

export const PAYMENT_METHOD_OPTIONS = [
  { method: "PIX", label: "PIX", hint: "Pagamento à vista com confirmação imediata" },
  { method: "CREDITO", label: "Cartão de crédito", hint: "" },
  { method: "DEBITO", label: "Cartão de débito", hint: "" },
  { method: "BOLETO", label: "Boleto", hint: "" },
  { method: "TRANSFERENCIA", label: "Transferência bancária", hint: "" },
  { method: "DINHEIRO", label: "Dinheiro", hint: "" },
] as const;
export type ProposalPaymentMethodId = (typeof PAYMENT_METHOD_OPTIONS)[number]["method"];
export interface ProposalPaymentMethod {
  method: ProposalPaymentMethodId;
  installments?: number | null;
  note?: string | null;
}

export const DEFAULT_BRAND_COLOR = "#4f39d8";
export const DEFAULT_ACCENT_COLOR = "#16a34a";
const MAX_INSTALLMENTS = 24;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

const sectionIds = PROPOSAL_SECTIONS.map((section) => section.id) as [ProposalSectionId, ...ProposalSectionId[]];
const paymentIds = PAYMENT_METHOD_OPTIONS.map((option) => option.method) as [ProposalPaymentMethodId, ...ProposalPaymentMethodId[]];
const templateIds = PROPOSAL_TEMPLATES.map((template) => template.id) as [ProposalTemplateId, ...ProposalTemplateId[]];

/** O que a tela de configurações grava. Validado no servidor para o Json não virar depósito (spec 0150, D-3). */
export const proposalLookInputSchema = z.object({
  proposalTemplate: z.enum(templateIds),
  brandColor: z.string().regex(HEX_COLOR).nullable(),
  accentColor: z.string().regex(HEX_COLOR).nullable(),
  proposalSections: z.array(z.object({ id: z.enum(sectionIds), enabled: z.boolean() })).max(PROPOSAL_SECTIONS.length),
  paymentMethods: z
    .array(
      z.object({
        method: z.enum(paymentIds),
        installments: z.number().int().min(1).max(MAX_INSTALLMENTS).nullable().optional(),
        note: z.string().trim().max(120).nullable().optional(),
      }),
    )
    .max(PAYMENT_METHOD_OPTIONS.length),
  commercialTerms: z.string().trim().max(1500).nullable(),
});
export type ProposalLookInput = z.infer<typeof proposalLookInputSchema>;

export interface ProposalLook {
  template: ProposalTemplateId;
  brandColor: string;
  accentColor: string;
  sections: ProposalSectionSetting[];
  paymentMethods: ProposalPaymentMethod[];
  commercialTerms: string | null;
}

/**
 * Lista salva → lista válida: some o que deixou de existir, entra no fim (ligado) o que é novo, e itens e totais
 * não ficam os dois desligados (spec 0150, casos de borda).
 */
export function normalizeProposalSections(stored: unknown): ProposalSectionSetting[] {
  const known = new Set<string>(sectionIds);
  const seen = new Set<string>();
  const result: ProposalSectionSetting[] = [];
  if (Array.isArray(stored)) {
    for (const entry of stored) {
      const candidate = entry as { id?: unknown; enabled?: unknown } | null;
      if (!candidate || typeof candidate.id !== "string" || !known.has(candidate.id) || seen.has(candidate.id)) continue;
      seen.add(candidate.id);
      result.push({ id: candidate.id as ProposalSectionId, enabled: candidate.enabled !== false });
    }
  }
  for (const id of sectionIds) if (!seen.has(id)) result.push({ id, enabled: true });
  const items = result.find((section) => section.id === "items");
  const totals = result.find((section) => section.id === "totals");
  if (items && totals && !items.enabled && !totals.enabled) totals.enabled = true;
  return result;
}

export function normalizePaymentMethods(stored: unknown): ProposalPaymentMethod[] {
  const parsed = proposalLookInputSchema.shape.paymentMethods.safeParse(stored);
  if (!parsed.success) return [];
  const seen = new Set<string>();
  return parsed.data.filter((entry) => (seen.has(entry.method) ? false : (seen.add(entry.method), true)));
}

function validHexOr(value: string | null | undefined, fallback: string): string {
  return value && HEX_COLOR.test(value) ? value.toLowerCase() : fallback;
}

/** Configurações salvas (ou nenhuma) → visual pronto para desenhar. Empresa sem configuração recebe o padrão (CA-1). */
export function resolveProposalLook(settings: {
  proposalTemplate?: string | null;
  brandColor?: string | null;
  accentColor?: string | null;
  proposalSections?: unknown;
  paymentMethods?: unknown;
  commercialTerms?: string | null;
} | null): ProposalLook {
  const template = templateIds.includes(settings?.proposalTemplate as ProposalTemplateId)
    ? (settings?.proposalTemplate as ProposalTemplateId)
    : DEFAULT_PROPOSAL_TEMPLATE;
  return {
    template,
    brandColor: validHexOr(settings?.brandColor, DEFAULT_BRAND_COLOR),
    accentColor: validHexOr(settings?.accentColor, DEFAULT_ACCENT_COLOR),
    sections: normalizeProposalSections(settings?.proposalSections),
    paymentMethods: normalizePaymentMethods(settings?.paymentMethods),
    commercialTerms: settings?.commercialTerms?.trim() || null,
  };
}

/** Texto legível sobre a cor: claro em cor escura, escuro em cor clara (spec 0150, D-5). */
export function readableTextOn(hex: string): string {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  const [red, green, blue] = channels.map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  const contrastWithWhite = 1.05 / (luminance + 0.05);
  const contrastWithInk = (luminance + 0.05) / (0.0175 + 0.05);
  return contrastWithWhite >= contrastWithInk ? "#ffffff" : "#14142b";
}

export function describePaymentMethod(entry: ProposalPaymentMethod): { label: string; detail: string } {
  const option = PAYMENT_METHOD_OPTIONS.find((candidate) => candidate.method === entry.method);
  const label = option?.label ?? entry.method;
  const installmentsText = entry.method === "CREDITO" && entry.installments && entry.installments > 1 ? `Em até ${entry.installments}x` : "";
  const detail = [installmentsText, entry.note?.trim() || ""].filter(Boolean).join(" · ") || option?.hint || "";
  return { label, detail };
}

export interface ProposalLineInput {
  quantity: number;
  unitValue: number;
  discount: number;
}
export interface ProposalLineSummary {
  fullTotal: number;
  finalTotal: number;
  finalUnitValue: number;
  /** Porcentagem do desconto da linha, arredondada; 0 sem desconto. */
  discountPercent: number;
}

export function summarizeProposalLine(line: ProposalLineInput): ProposalLineSummary {
  const fullTotal = line.quantity * line.unitValue;
  const discount = Math.min(Math.max(line.discount, 0), fullTotal);
  const finalTotal = fullTotal - discount;
  return {
    fullTotal,
    finalTotal,
    finalUnitValue: line.quantity > 0 ? finalTotal / line.quantity : line.unitValue,
    discountPercent: fullTotal > 0 && discount > 0 ? Math.max(1, Math.round((discount / fullTotal) * 100)) : 0,
  };
}

/** Totais da proposta: valor cheio, desconto (itens + proposta), total e economia em % (spec 0150, RF-7). */
export function summarizeProposalTotals(
  lines: ProposalLineInput[],
  proposalDiscount: { value: number; type: string | null },
) {
  const summaries = lines.map(summarizeProposalLine);
  const fullTotal = summaries.reduce((sum, line) => sum + line.fullTotal, 0);
  const itemsNet = summaries.reduce((sum, line) => sum + line.finalTotal, 0);
  const proposalDiscountAmount =
    proposalDiscount.value > 0
      ? Math.min(proposalDiscount.type === "PERCENTUAL" ? itemsNet * (proposalDiscount.value / 100) : proposalDiscount.value, itemsNet)
      : 0;
  const total = itemsNet - proposalDiscountAmount;
  const discountTotal = fullTotal - total;
  return {
    fullTotal,
    discountTotal,
    total,
    savingsPercent: fullTotal > 0 && discountTotal > 0 ? Math.round((discountTotal / fullTotal) * 100) : 0,
  };
}

function hexToChannels(hex: string): [number, number, number] {
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16)) as [number, number, number];
}

function channelsToHex(channels: number[]): string {
  return `#${channels.map((channel) => Math.round(Math.min(255, Math.max(0, channel))).toString(16).padStart(2, "0")).join("")}`;
}

function relativeLuminance(hex: string): number {
  const [red, green, blue] = hexToChannels(hex)
    .map((channel) => channel / 255)
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** Mistura a cor com outra (0 = original, 1 = a outra). */
export function mixHex(hex: string, target: string, ratio: number): string {
  const from = hexToChannels(hex);
  const to = hexToChannels(target);
  return channelsToHex(from.map((channel, index) => channel + (to[index] - channel) * ratio));
}

/** A cor escurecida até ler bem sobre branco (4,5:1), para texto colorido na página (RNF-5). */
export function textColorOnWhite(hex: string): string {
  let color = hex;
  for (let step = 0; step < 20 && 1.05 / (relativeLuminance(color) + 0.05) < 4.5; step++) color = mixHex(color, "#000000", 0.12);
  return color;
}

/** Variáveis de cor do documento: marca, destaque, texto legível sobre cada uma e fundos suaves. */
export function proposalColorVariables(look: Pick<ProposalLook, "brandColor" | "accentColor">): Record<string, string> {
  return {
    "--brand": look.brandColor,
    "--brand-ink": readableTextOn(look.brandColor),
    "--brand-text": textColorOnWhite(look.brandColor),
    "--brand-soft": mixHex(look.brandColor, "#ffffff", 0.9),
    "--accent": look.accentColor,
    "--accent-ink": readableTextOn(look.accentColor),
    "--accent-strong": textColorOnWhite(look.accentColor),
    "--accent-soft": mixHex(look.accentColor, "#ffffff", 0.85),
  };
}
