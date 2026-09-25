/**
 * Escopo de tenant. Repositório não opera sem ele — é dependência de
 * construtor, não parâmetro opcional de query (ver
 * `docs/arquitetura-evolucao-overview.md` §5.3).
 *
 * Esquecer de filtrar por organização deixa de ser possível por omissão:
 * sem `TenantScope` o repositório não instancia.
 */
export type TenantScope = {
  readonly organizationId: string;
};

export function tenantScope(organizationId: string): TenantScope {
  if (!organizationId) {
    throw new Error("TenantScope exige organizationId não vazio");
  }
  return Object.freeze({ organizationId });
}
