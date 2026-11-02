// Conferência das regras puras da spec 0131 (o que precisa de ação e código do pedido).
//
//   pnpm tsx --conditions=react-server scripts/trafego-0131-qa-check.ts

import { describeTeamActions, normalizeOrderCode, type TeamActionInput } from "../src/features/trafego/lib/team-actions";

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

const now = new Date("2026-11-02T12:00:00Z");
const base: TeamActionInput = {
  status: "IN_REVIEW",
  hasCreative: true,
  hasCopy: true,
  hasLinkedCampaign: false,
  hasPendingApproval: false,
  hasApprovalToPublish: false,
  lastActivityAt: new Date("2026-11-02T10:00:00Z"),
  now,
};

console.log("\nCódigo do pedido (CB-3)");
check("CB-3", "tg-0042 → TG-0042", normalizeOrderCode("tg-0042"), "TG-0042");
check("CB-3", "42 → TG-0042", normalizeOrderCode(" 42 "), "TG-0042");
check("CB-3", "código DEMO passa em maiúsculas", normalizeOrderCode("demo-ins-rptek3-009"), "DEMO-INS-RPTEK3-009");

console.log("\nO que precisa de ação (CA-4)");
check("CA-4", "material completo e sem campanha → montar", describeTeamActions(base).actions, ["Montar a campanha na Meta"]);
check("CA-4", "sem criativo → falta criativo", describeTeamActions({ ...base, hasCreative: false }).actions, ["Falta criativo do cliente"]);
check("CA-4", "recomendação aberta → esperando o cliente, sem ação da equipe", describeTeamActions({ ...base, hasPendingApproval: true }), {
  actions: [],
  waitingOn: "Esperando o cliente aprovar a recomendação",
  idleDays: 0,
});
check(
  "CA-4",
  "cliente aprovou e campanha vinculada → publicar",
  describeTeamActions({ ...base, hasLinkedCampaign: true, hasApprovalToPublish: true }).actions,
  ["Cliente aprovou a recomendação: seguir com a publicação"],
);
check(
  "RF-4",
  "parado há 4 dias entra na lista",
  describeTeamActions({ ...base, lastActivityAt: new Date("2026-10-29T10:00:00Z") }).actions,
  ["Montar a campanha na Meta", "Parado há 4 dias"],
);
check("RF-4", "campanha no ar e vinculada → nada a fazer", describeTeamActions({ ...base, status: "RUNNING", hasLinkedCampaign: true }).actions, []);

console.log(`\n${passes} ok, ${failures} falha(s)\n`);
process.exit(failures > 0 ? 1 : 0);
