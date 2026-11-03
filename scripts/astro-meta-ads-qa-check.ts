// Conferência das regras puras da spec 0125 (Astro com o MCP oficial da Meta).
// Não há runner de testes no projeto (CLAUDE.md, regra 20): cada CA-n vira uma asserção aqui.
// Nenhuma chamada à Meta.
//
//   pnpm tsx --conditions=react-server scripts/astro-meta-ads-qa-check.ts

import { execSync } from "node:child_process";
import {
  buildWriteSummary,
  checkAdTextPolicy,
  checkBudgetCap,
  injectOrgAccount,
  isMetaMcpReadTool,
  isMetaMcpWriteTool,
  resolveSafetyOp,
  stripServerFilledArgs,
  truncateForModel,
} from "../src/features/astro-meta-ads/lib/mcp-guards";
import { evaluateAstroAvailability } from "../src/features/integrations/lib/meta-connection-check";

let passes = 0;
let failures = 0;

function check(caseId: string, description: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passes++;
    console.log(`  ✓ ${caseId} — ${description}`);
  } else {
    failures++;
    console.log(`  ✗ ${caseId} — ${description}\n      esperado: ${JSON.stringify(expected)}\n      obtido:   ${JSON.stringify(actual)}`);
  }
}

console.log("\nRemoção do MCP de mentira (CA-1)");
const leftovers = execSync(
  'grep -rln "META_MCP_SERVER_CMD\\|server-spawn\\|spawnMetaMcpServer\\|createMetaMcpClient\\|@/lib/meta-mcp" src || true',
  { encoding: "utf8" },
).trim();
check("CA-1", "nenhuma referência sobrou em src/", leftovers, "");

console.log("\nLista aprovada e conta da org (CA-3)");
check("CA-3", "apagar público não está liberado", [isMetaMcpReadTool("ads_delete_custom_audience"), isMetaMcpWriteTool("ads_delete_custom_audience")], [false, false]);
check("CA-3", "ler campanhas está liberado", isMetaMcpReadTool("ads_get_ad_entities"), true);
check(
  "CA-3",
  "outra conta pedida pelo modelo é recusada",
  injectOrgAccount({ ad_account_id: "999" }, "act_1415429507225658", "abcdefghij0123456789").ok,
  false,
);
const injected = injectOrgAccount({ entity_id: "1", client_model: "x" }, "act_1415429507225658", "abcdefghij0123456789");
check(
  "CA-3",
  "a conta é sempre a da org, sem act_",
  injected.ok ? [injected.args.ad_account_id, "client_model" in injected.args] : null,
  ["1415429507225658", false],
);
check(
  "RNF-2",
  "o modelo não vê ad_account_id nem client_conversation_id",
  Object.keys(
    (stripServerFilledArgs({ properties: { ad_account_id: {}, client_conversation_id: {}, entity_id: {} }, required: ["ad_account_id", "entity_id"] }) as {
      properties: Record<string, unknown>;
    }).properties,
  ),
  ["entity_id"],
);

console.log("\nOperação e verba (CA-4, CA-6, CA-7)");
check("CA-4", "pausar só com status é pause", resolveSafetyOp("ads_update_entity", { fields: '{"status":"PAUSED"}' }), "pause");
check("CA-4", "mudar verba é update", resolveSafetyOp("ads_update_entity", { fields: { daily_budget: 5000 } }), "update");
check("CA-7", "ativar é resume", resolveSafetyOp("ads_activate_entity", {}), "resume");
check(
  "CA-6",
  "R$ 800/dia passa do teto de R$ 500/dia",
  checkBudgetCap({ toolName: "ads_create_campaign", args: { campaign_daily_budget: 80_000 }, maxDailyReais: 500 })?.error,
  "budget_exceeded",
);
check(
  "CA-6",
  "R$ 300/dia dentro do teto",
  checkBudgetCap({ toolName: "ads_update_entity", args: { fields: '{"daily_budget":30000}' }, maxDailyReais: 500 }),
  null,
);
check(
  "CA-7",
  "cartão de ativação fala que a Meta começa a gastar",
  buildWriteSummary("ads_activate_entity", { entity_id: "1", entity_type: "campaign" }, "TG-0001 — Teste").includes("começa a gastar"),
  true,
);
check(
  "CA-4",
  "cartão de pausa em português",
  buildWriteSummary("ads_update_entity", { entity_id: "1", entity_type: "campaign", fields: '{"status":"PAUSED"}' }, "Campanha X"),
  'Pausar campanha "Campanha X".',
);

console.log("\nPolítica de texto (CA-10)");
check(
  "CA-10",
  '"Você sofre de…?" no criativo é bloqueado',
  checkAdTextPolicy("ads_create_creative", { object_story_spec: { link_data: { message: "Você sofre de dor nas costas?" } } })?.error,
  "policy_blocked",
);
check("CA-10", "texto neutro passa", checkAdTextPolicy("ads_create_creative", { message: "Tratamento para dor nas costas." }), null);

console.log("\nDisponibilidade do Astro (CA-8)");
check(
  "CA-8",
  "sem ads_mcp_management não libera",
  evaluateAstroAvailability({ grantedPermissions: ["ads_read"], canRead: true, isAccountMcpEnabled: true }).canUseAstro,
  false,
);
check(
  "CA-8",
  "conta sem MCP liberado não libera",
  evaluateAstroAvailability({ grantedPermissions: ["ads_read", "ads_mcp_management"], canRead: true, isAccountMcpEnabled: false }).canUseAstro,
  false,
);
check(
  "CA-8",
  "permissão + conta liberada libera",
  evaluateAstroAvailability({ grantedPermissions: ["ads_read", "ads_mcp_management"], canRead: true, isAccountMcpEnabled: true }).canUseAstro,
  true,
);

console.log("\nContexto do modelo (RNF-4)");
check("RNF-4", "resposta grande é cortada", (truncateForModel("x".repeat(20_000)) as { truncated: boolean }).truncated, true);

console.log(`\n${passes} ok, ${failures} falha(s)\n`);
process.exit(failures > 0 ? 1 : 0);
