import { meter } from "./metering/meter";

/**
 * Cobra Stars por uma ação catalogada.
 *
 * Desde a spec 0020 esta função é uma fachada sobre `meter()`, o ponto único de
 * cobrança. A assinatura e o formato de retorno foram preservados de propósito:
 * os ~62 pontos que já a chamam não precisaram mudar nenhuma linha.
 *
 * Para cobrança por quantidade (tokens, MB, segundos) ou por variante de modelo,
 * chame `meter()` diretamente — esta fachada só cobre custo fixo por evento.
 *
 * Diferença de comportamento em relação ao que existia antes: ação sem preço em
 * nenhuma camada deixou de ser silenciosamente gratuita. Continua sem cobrar,
 * mas agora avisa no log e entra no relatório de ações sem preço.
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
  const result = await meter({
    organizationId,
    action,
    userId: ctx.userId,
    description: ctx.description,
    appSlug: ctx.appSlug,
    disallowBonus: ctx.disallowBonus,
  });

  if (!result.charged) {
    return { success: true, skipped: true, cost: 0 };
  }

  return {
    success: result.success,
    skipped: false,
    cost: result.cost,
    newBalance: result.newBalance,
    newBonusBalance: result.newBonusBalance,
  };
}
