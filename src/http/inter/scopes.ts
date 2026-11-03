// Escopos OAuth do Inter usados pelo ÓRBITA (RF-2 da spec 0130). O token pede só estes;
// escopo que move dinheiro nunca entra no pedido, mesmo que a integração o tenha.

export const INTER_CHARGE_SCOPES = [
  "cobv.read",
  "cobv.write",
  "pix.read",
  "webhook.read",
  "webhook.write",
] as const;

/** Pagamento simulado do sandbox exige `pix.write`; só vale lá. */
export const INTER_SANDBOX_EXTRA_SCOPES = ["pix.write"] as const;

const MONEY_MOVING_SCOPE_PATTERNS = [/^pix\.write$/, /^pagamento-/];

/** Escopos da integração que permitem tirar dinheiro da conta — a tela avisa em vermelho. */
export function findMoneyMovingScopes(grantedScopes: readonly string[]): string[] {
  return grantedScopes.filter((scope) => MONEY_MOVING_SCOPE_PATTERNS.some((pattern) => pattern.test(scope)));
}
