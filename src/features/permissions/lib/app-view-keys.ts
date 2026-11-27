// App da tela (id do card em /apps ou chave do item do menu lateral) → chaves da matriz de
// Permissões que liberam o "Ver" (spec 0153). Basta UMA das chaves com "Ver" ligado.
// App fora daqui nunca some por permissão. Lido no menu, no lançador, na página Apps e no
// bloqueio por URL (`require-app-view.ts`).
export const APP_VIEW_KEYS = {
  tracking: ["tracking"],
  workspaces: ["workspace"],
  demand: ["workspace"],
  cosmic: ["formularios"],
  nasachat: ["chat"],
  campanhas: ["campanhas"],
  spacetime: ["spacetime"],
  insights: ["insights"],
  contatos: ["contatos"],
  nbox: ["nbox"],
  "nasa-planner": ["nasa-planner"],
  forge: ["forge", "forge-contracts"],
  "star-friends": ["star-friends"],
  payment: ["financeiro"],
  linnker: ["linnker"],
  "nasa-route": ["nasa-route"],
  "nasa-pages": ["nasa-pages"],
  "space-station": ["space-station"],
  trafego: ["trafego"],
  integrations: ["integrations"],
  astro: ["astro"],
  "astro-chat": ["astro-chat"],
  comments: ["comments"],
  nerp: ["nerp"],
  flowastro: ["flowastro"],
  // Mesmo critério do painel de Gatilhos (`automations-hub/overview.ts`).
  gatilhos: ["tracking-automacoes", "workspace-automacoes", "comments", "astro"],
} as const satisfies Record<string, readonly string[]>;

export type AppViewId = keyof typeof APP_VIEW_KEYS;

export function isAppViewAllowed(viewId: string, canViewAppKey: (appKey: string) => boolean): boolean {
  const appKeys: readonly string[] | undefined = APP_VIEW_KEYS[viewId as AppViewId];
  if (!appKeys) return true;
  return appKeys.some(canViewAppKey);
}
