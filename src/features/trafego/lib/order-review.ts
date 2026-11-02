import { z } from "zod";
import { INITIAL_MESSAGE_MAX_CHARS } from "./meta-ad-rules";

/**
 * Avaliação do Claude no pedido antes de publicar (spec 0132). Regras puras: melhorias que o painel
 * aplica, impressão digital da versão avaliada e os textos do painel.
 */

export const REVIEW_SLA_HOURS = 2;

export const orderReviewFixesSchema = z
  .object({
    message: z.string().trim().min(1).max(600).optional(),
    headline: z.string().trim().min(1).max(40).optional(),
    initialMessage: z.string().trim().min(1).max(INITIAL_MESSAGE_MAX_CHARS).optional(),
    audience: z.string().trim().min(3).max(500).optional(),
  })
  .strict()
  .refine((fixes) => Object.values(fixes).some((value) => value !== undefined), "Informe ao menos uma melhoria.");

export type OrderReviewFixes = z.infer<typeof orderReviewFixesSchema>;

/** Leitura tolerante do banco: pacote inválido vira "sem melhorias", nunca quebra a tela. */
export function readOrderReviewFixes(raw: unknown): OrderReviewFixes | null {
  const parsed = orderReviewFixesSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** "Aplicar e aprovar" de uma vez só quando não há observação para o cliente resolver (RF-5). */
export function canApproveByApplyingFixes(params: { fixes: OrderReviewFixes | null; notes: string[] }): boolean {
  return Boolean(params.fixes) && params.notes.length === 0;
}

export function describeReviewFixes(fixes: OrderReviewFixes): string[] {
  const items: string[] = [];
  if (fixes.message) items.push(`Texto do anúncio: "${fixes.message}"`);
  if (fixes.headline) items.push(`Título: "${fixes.headline}"`);
  if (fixes.initialMessage) items.push(`Mensagem inicial do WhatsApp: "${fixes.initialMessage}"`);
  if (fixes.audience) items.push(`Público: ${fixes.audience}`);
  return items;
}

export interface FingerprintOrder {
  adBudgetBrlCents: number;
  durationDays: number;
  desiredStartAt: Date | null;
  targetAudience: string | null;
  initialMessage: string | null;
  creatives: { id: string; fileKey: string; status: string }[];
  copies: { id: string; primaryText: string; headline: string | null; isSelected: boolean }[];
}

/**
 * O que a aprovação cobre (RF-6): criativos ativos, textos escolhidos, mensagem inicial, público, verba e
 * prazo. Status fica de fora: aprovar e publicar não mudam o anúncio.
 */
export function buildOrderFingerprintSource(order: FingerprintOrder): string {
  const creatives = order.creatives
    .filter((creative) => creative.status !== "REJECTED")
    .map((creative) => `${creative.id}:${creative.fileKey}`)
    .sort();
  const copies = order.copies
    .filter((copy) => copy.isSelected)
    .map((copy) => ({ id: copy.id, text: copy.primaryText.trim(), headline: copy.headline?.trim() ?? null }))
    .sort((first, second) => first.id.localeCompare(second.id));
  return JSON.stringify({
    budget: order.adBudgetBrlCents,
    days: order.durationDays,
    start: order.desiredStartAt?.toISOString().slice(0, 10) ?? null,
    audience: order.targetAudience?.trim() ?? null,
    initialMessage: order.initialMessage?.trim() ?? null,
    creatives,
    copies,
  });
}

/** Pedido aprovado, liberado pelo cliente e no dia de começar (RF-7, CB-2). */
export function isReadyToPublish(params: {
  status: string;
  hasReviewFingerprint: boolean;
  isReleasedByClient: boolean;
  hasLinkedCampaign: boolean;
  desiredStartAt: Date | null;
  now?: Date;
}): boolean {
  const now = params.now ?? new Date();
  return (
    params.status === "SCHEDULED" &&
    params.hasReviewFingerprint &&
    params.isReleasedByClient &&
    !params.hasLinkedCampaign &&
    (!params.desiredStartAt || params.desiredStartAt.getTime() <= now.getTime())
  );
}
