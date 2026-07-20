/**
 * Constantes compartilhadas entre `billing` e `stars`.
 *
 * Módulo-folha de propósito: `sync-billing-role-plan-to-orgs` importa o serviço
 * de ciclo de Stars, e o serviço de ciclo precisa destas constantes. Mantê-las
 * aqui — sem nenhum import — quebra o ciclo de dependência entre as features.
 */

export const BILLING_ROLES = ["owner", "admin"] as const;
export type BillingRole = (typeof BILLING_ROLES)[number];

/** Status de assinatura que dão direito a plano ativo e a crédito de Stars. */
export const ACTIVE_SUB_STATUSES = ["active", "trialing"] as const;

/**
 * Status de inadimplência: o plano continua atribuído (o cliente ainda enxerga
 * a org com plano), mas o ciclo NÃO credita. O saldo remanescente é preservado
 * e o grace period — dirigido por saldo — assume quando zerar.
 */
export const DUNNING_SUB_STATUSES = ["past_due", "unpaid", "incomplete"] as const;
