// Cobrança de Stars do Astro pelo WhatsApp (spec 0019) — espelha a rota
// in-app `/api/astro/chat`: stake fixo antes, tokens depois.
import "server-only";
import type { UserWhatsappBinding } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import { meter } from "@/features/stars/lib/metering";

// O preço por token mora no catálogo, na ação `astro_tokens`. Antes era a
// constante STARS_PER_1K_TOKENS, duplicada aqui e na rota in-app.

export interface BotStakeCharge {
  hasBalance: boolean;
  starsCharged: number;
  /** Org do trafeGO não paga Astro (taxa de serviço cobre) — igual in-app. */
  isExempt: boolean;
}

async function isTrafegoOrganization(organizationId: string): Promise<boolean> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { appScope: true },
  });
  return organization?.appScope === "trafego";
}

export async function chargeBotPromptStake(
  binding: UserWhatsappBinding,
): Promise<BotStakeCharge> {
  try {
    if (await isTrafegoOrganization(binding.organizationId)) {
      return { hasBalance: true, starsCharged: 0, isExempt: true };
    }
    const charge = await chargeStarsByAction(binding.organizationId, "astro_prompt", {
      userId: binding.userId,
      description: "Astro pelo WhatsApp — prompt (stake)",
      appSlug: "astro",
    });
    if (charge.skipped) return { hasBalance: true, starsCharged: 0, isExempt: false };
    if (!charge.success) return { hasBalance: false, starsCharged: 0, isExempt: false };
    return { hasBalance: true, starsCharged: charge.cost, isExempt: false };
  } catch (chargeError) {
    // Paridade com a rota in-app: falha de infraestrutura na cobrança não
    // bloqueia a resposta.
    console.error("[astro-bot/stars-billing] stake charge failed (continuing)", chargeError);
    return { hasBalance: true, starsCharged: 0, isExempt: false };
  }
}

/** Debita os tokens consumidos e devolve quantas Stars realmente saíram. */
export async function debitBotTokenUsage(
  binding: UserWhatsappBinding,
  totalTokens: number,
  modelId?: string,
): Promise<number> {
  if (totalTokens <= 0) return 0;
  try {
    const charge = await meter({
      organizationId: binding.organizationId,
      action: "astro_tokens",
      userId: binding.userId,
      quantity: { unit: "token", amount: totalTokens },
      appSlug: "astro",
      description: `Astro pelo WhatsApp — ${totalTokens.toLocaleString("pt-BR")} tokens`,
      feature: "astro.whatsapp",
      cost: {
        kind: "LLM",
        provider: "openai",
        modelId,
        tokens: { totalTokens },
      },
    });
    return charge.charged && charge.success ? charge.cost : 0;
  } catch (debitError) {
    console.warn("[astro-bot/stars-billing] token charge failed", debitError);
    return 0;
  }
}
