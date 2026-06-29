import prisma from "@/lib/prisma";

/**
 * Validações de segurança aplicadas ANTES de qualquer operação Meta MCP
 * persistir uma `MetaAdsPendingAction` ou executar.
 *
 * Princípio: defesa em profundidade — mesmo que o LLM "alucine" payload
 * fora do permitido, essas checagens param a operação no backend.
 */

export type SafetyConfig = {
  /** Operações permitidas pela org. Default conservador: read + pause/resume. */
  allowedOps: ("read" | "pause" | "resume" | "create" | "update" | "delete" | "catalog")[];
  /** Orçamento máx (em centavos? em reais? — manter R$ pra simplificar) */
  maxBudgetPerCampaign: number;
};

export const DEFAULT_SAFETY_CONFIG: SafetyConfig = {
  allowedOps: ["read", "pause", "resume"],
  maxBudgetPerCampaign: 500,
};

/**
 * Carrega config de segurança do `PlatformIntegration.config` da org.
 * Usa defaults conservadores se faltar.
 */
export async function loadSafetyConfig(organizationId: string): Promise<SafetyConfig> {
  const integration = await prisma.platformIntegration.findUnique({
    where: { organizationId_platform: { organizationId, platform: "META" } },
    select: { config: true },
  });
  const config = (integration?.config ?? {}) as Record<string, unknown>;

  const allowedOps = Array.isArray(config.mcpAllowedOps)
    ? (config.mcpAllowedOps as SafetyConfig["allowedOps"])
    : DEFAULT_SAFETY_CONFIG.allowedOps;

  const maxBudget =
    typeof config.mcpMaxBudgetPerCampaign === "number"
      ? config.mcpMaxBudgetPerCampaign
      : DEFAULT_SAFETY_CONFIG.maxBudgetPerCampaign;

  return { allowedOps, maxBudgetPerCampaign: maxBudget };
}

/**
 * Resultado padrão para retornar do tool quando uma validação falha.
 * Frontend renderiza o erro como texto no chat.
 */
export type SafetyError = {
  ok: false;
  error: "operation_not_allowed" | "budget_exceeded" | "invalid_id" | "campaign_not_found";
  message: string;
};

export type SafetyOk<T> = { ok: true; data: T };

export type SafetyResult<T> = SafetyOk<T> | SafetyError;

/**
 * Verifica se uma operação está na whitelist da org.
 */
export function checkOpAllowed(
  config: SafetyConfig,
  op: SafetyConfig["allowedOps"][number],
): SafetyError | null {
  if (!config.allowedOps.includes(op)) {
    return {
      ok: false,
      error: "operation_not_allowed",
      message: `A operação "${op}" não está habilitada para esta organização. Peça ao Master ou Moderador para habilitá-la em Integrações → Meta → Astro + IA → Operações permitidas.`,
    };
  }
  return null;
}

/**
 * Verifica se um orçamento proposto está dentro do limite da org.
 */
export function checkBudget(
  config: SafetyConfig,
  budget: number,
): SafetyError | null {
  if (budget > config.maxBudgetPerCampaign) {
    return {
      ok: false,
      error: "budget_exceeded",
      message: `Orçamento R$ ${budget.toFixed(2)}/dia excede o limite da organização (R$ ${config.maxBudgetPerCampaign.toFixed(2)}/dia). Master ou Moderador pode aumentar em Integrações → Meta → Astro + IA → Geral.`,
    };
  }
  return null;
}

/**
 * Sanidade básica de ID Meta (campanha/adset/ad).
 * Meta IDs são numéricos longos (typicamente 10-20 dígitos).
 */
export function isValidMetaId(id: string): boolean {
  return /^\d{8,25}$/.test(id);
}

/**
 * Verifica se a campanha existe e pertence à org.
 */
export async function checkCampaignBelongsToOrg(
  organizationId: string,
  metaCampaignId: string,
): Promise<SafetyError | null> {
  const campaign = await prisma.metaAdCampaign.findFirst({
    where: { organizationId, metaCampaignId },
    select: { id: true },
  });
  if (!campaign) {
    return {
      ok: false,
      error: "campaign_not_found",
      message: `A campanha ${metaCampaignId} não foi encontrada na sua organização. Use a listagem para ver as disponíveis.`,
    };
  }
  return null;
}
