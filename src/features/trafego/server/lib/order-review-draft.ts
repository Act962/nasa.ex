import "server-only";

import prisma from "@/lib/prisma";
import { getPresignedReadUrl } from "@/lib/r2-url";
import { CAMPAIGN_TYPE_LABEL, OBJECTIVE_LABEL } from "@/features/trafego/lib/catalog-labels";
import { creativeReviewSchema, trafegoCreativeDraftSchema } from "@/features/trafego/lib/creative-review/schema";
import { META_AD_TEXT_RULES } from "@/features/trafego/lib/meta-ad-rules";
import { loadWizardAccountContext } from "./meta/account-context";
import { OrderReviewError, computeOrderFingerprint } from "./order-review";

/**
 * O pedido inteiro para o Claude avaliar (spec 0132, RF-7, CA-10): o que vai para a Meta, as regras, o
 * histórico da conta e o criativo como imagem. Nunca token.
 */

const CREATIVE_LINK_SECONDS = 24 * 60 * 60;
const MAX_REVIEW_IMAGES = 3;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

type ReviewImage = { data: string; mimeType: string };

async function fetchImageAsBase64(url: string): Promise<ReviewImage | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    const mimeType = response.headers.get("content-type")?.split(";")[0] ?? "";
    if (!response.ok || !mimeType.startsWith("image/")) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > MAX_IMAGE_BYTES) return null;
    return { data: bytes.toString("base64"), mimeType };
  } catch {
    return null;
  }
}

function readAstroNotes(raw: unknown) {
  const parsed = creativeReviewSchema.safeParse(raw);
  if (!parsed.success) return null;
  return {
    score: parsed.data.score,
    verdict: parsed.data.verdict,
    summary: parsed.data.summary,
    textInCreative: parsed.data.readText,
    points: parsed.data.items.map((item) => `${item.level} · ${item.label}: ${item.fix}`),
  };
}

export async function loadOrderForReview(orderId: string): Promise<{ data: Record<string, unknown>; images: ReviewImage[] }> {
  const order = await prisma.trafegoOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      code: true,
      status: true,
      organizationId: true,
      businessName: true,
      businessNiche: true,
      objective: true,
      campaignType: true,
      targetAudience: true,
      adBudgetBrlCents: true,
      durationDays: true,
      desiredStartAt: true,
      materialsProfileLink: true,
      organization: { select: { name: true } },
      pendingPurchase: { select: { briefing: true } },
      creatives: {
        where: { status: { not: "REJECTED" } },
        orderBy: { position: "asc" },
        take: 10,
        select: { kind: true, fileKey: true, fileName: true, astroReview: true },
      },
      copies: {
        where: { isSelected: true },
        orderBy: { position: "asc" },
        select: { headline: true, primaryText: true, complianceLevel: true },
      },
    },
  });
  if (!order) throw new OrderReviewError("Pedido não encontrado.");

  const draft = trafegoCreativeDraftSchema.safeParse(((order.pendingPurchase?.briefing ?? {}) as Record<string, unknown>).creativeDraft);
  const [account, fingerprint] = await Promise.all([loadWizardAccountContext(order.organizationId), computeOrderFingerprint(order.id)]);

  const creatives = await Promise.all(
    order.creatives.map(async (creative) => ({
      kind: creative.kind,
      fileName: creative.fileName,
      url: await getPresignedReadUrl(creative.fileKey, CREATIVE_LINK_SECONDS),
      astro: readAstroNotes(creative.astroReview),
    })),
  );
  const images = (
    await Promise.all(
      creatives
        .filter((creative) => creative.kind === "IMAGE")
        .slice(0, MAX_REVIEW_IMAGES)
        .map((creative) => fetchImageAsBase64(creative.url)),
    )
  ).filter((image): image is ReviewImage => image !== null);

  return {
    data: {
      code: order.code,
      status: order.status,
      fingerprint,
      company: order.organization.name,
      business: { name: order.businessName, niche: order.businessNiche },
      campaign: {
        objective: OBJECTIVE_LABEL[order.objective],
        type: CAMPAIGN_TYPE_LABEL[order.campaignType],
        audience: order.targetAudience,
        budgetBrl: order.adBudgetBrlCents / 100,
        durationDays: order.durationDays,
        desiredStartAt: order.desiredStartAt?.toISOString().slice(0, 10) ?? null,
      },
      texts: order.copies.map((copy) => ({ message: copy.primaryText, headline: copy.headline, policyCheck: copy.complianceLevel })),
      initialWhatsappMessage: draft.success ? (draft.data.initialMessage ?? null) : null,
      instagramPostLink: (draft.success ? draft.data.postLink : null) ?? order.materialsProfileLink,
      astroGuidance: draft.success ? (draft.data.guidance ?? null) : null,
      creatives,
      imagesAttached: images.length,
      accountHistory: account.promptText ?? "A conta ainda não tem histórico de anúncios.",
      rules: [
        ...META_AD_TEXT_RULES,
        "Vídeo: você vê o texto lido e a nota do Astro, não o vídeo; diga isso no resumo.",
        "fixes só com o que o painel aplica sozinho: message, headline, initialMessage, audience. Trocar criativo ou oferta vai em notes.",
      ],
    },
    images,
  };
}
