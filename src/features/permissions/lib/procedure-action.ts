import type { PermissionAction } from "./app-permission-catalog";

// Deduz a ação da matriz pelo nome da procedure (último trecho do path).
// Nome que não casa com nenhum verbo conhecido cai em "Editar" — na dúvida,
// exigir mais é o lado seguro.
const ACTION_PATTERNS: [RegExp, PermissionAction][] = [
  [/^(delete|remove|destroy|archive|revoke|disconnect|purge|clear|unlink)/i, "canDelete"],
  [/^(create|add|new|insert|import|duplicate|clone|upload|send|generate|install|publish|invite|start|request|submit|post)/i, "canCreate"],
  [/^(list|get|find|search|count|stats|check|preview|export|download|fetch|read|view|overview|summary|status|metrics|history|dashboard|by)/i, "canView"],
];

export function resolveProcedureAction(procedureName: string): PermissionAction {
  for (const [pattern, action] of ACTION_PATTERNS) {
    if (pattern.test(procedureName)) return action;
  }
  return "canEdit";
}
