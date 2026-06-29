import prisma from "@/lib/prisma";
import { debitStars } from "./star-service";

/**
 * Cobra Stars por uma ação cujo custo está catalogado em `AppStarCost`
 * (regras globais editáveis pelo system admin em `/admin/stars > Regras`).
 *
 * Convenção: cada AÇÃO vira uma linha em `AppStarCost` onde:
 *  - `appSlug` = chave da ação (ex: "astro_prompt")
 *  - `monthlyCost` = custo em ★
 *  - `category` = "action" (distingue de linhas legado com `category="app"`
 *    que representam o custo mensal/setup do plano por app)
 *
 * Quando a regra não existe ou tem custo 0, a operação **não é cobrada**
 * (retorna `{ skipped: true }`) — permite que o admin "desligue" uma
 * cobrança sem precisar mexer no código que a dispara.
 */
export async function chargeStarsByAction(
  organizationId: string,
  action: string,
  ctx: {
    userId?: string;
    description?: string;
    /**
     * Slug do app pra rastrear em `StarTransaction.appSlug` (alimenta
     * o agregado "Uso do plano por app"). Se omitido, deriva da primeira
     * parte do action key (ex: "astro_prompt" → "astro").
     */
    appSlug?: string;
    /** Cobrança proibida de usar starsBonusBalance? Default false. */
    disallowBonus?: boolean;
  } = {},
): Promise<
  | { success: true; skipped?: false; cost: number; newBalance: number; newBonusBalance: number }
  | { success: false; skipped?: false; cost: number; newBalance: number; newBonusBalance: number }
  | { success: true; skipped: true; cost: 0 }
> {
  const rule = await prisma.appStarCost.findUnique({
    where: { appSlug: action },
    select: { monthlyCost: true, displayName: true, category: true },
  });

  if (!rule || rule.monthlyCost <= 0) {
    return { success: true, skipped: true, cost: 0 };
  }

  const appSlug = ctx.appSlug ?? action.split("_")[0] ?? action;
  const description = ctx.description ?? rule.displayName ?? action;

  const result = await debitStars(
    organizationId,
    rule.monthlyCost,
    "APP_CHARGE",
    description,
    appSlug,
    ctx.userId,
    ctx.disallowBonus ? { allowBonus: false } : undefined,
  );

  return {
    success: result.success,
    skipped: false,
    cost: rule.monthlyCost,
    newBalance: result.newBalance,
    newBonusBalance: result.newBonusBalance,
  };
}
