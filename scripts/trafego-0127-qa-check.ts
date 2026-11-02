// Conferência das regras puras da spec 0127 (anúncios no ar ao mesmo tempo por faixa de verba).
//
//   pnpm tsx --conditions=react-server scripts/trafego-0127-qa-check.ts

import { countRunningAds, resolveIncludedAds } from "../src/features/trafego/lib/creative-limits";

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

console.log("\nFaixas de verba (CA-1)");
check("CA-1", "R$ 500 → 3", resolveIncludedAds(50_000), 3);
check("CA-1", "R$ 501 → 5", resolveIncludedAds(50_100), 5);
check("CA-1", "R$ 2.000 → 5", resolveIncludedAds(200_000), 5);
check("CA-1", "R$ 2.001 → 8", resolveIncludedAds(200_100), 8);

console.log("\nAnúncios no ar (CA-2, CA-3, CB-2)");
const campaigns = [
  { id: "a", status: "ACTIVE", ads: [{ status: "ACTIVE" }, { status: "ACTIVE" }, { status: "PAUSED" }] },
  { id: "b", status: "PAUSED", ads: [{ status: "ACTIVE" }] },
  { id: "c", status: "ACTIVE", ads: [{ status: "ACTIVE" }] },
];
check("CA-3", "pausado (anúncio ou campanha) não conta", countRunningAds(campaigns), 3);
check("CA-2", "a campanha sendo publicada fica fora da conta", countRunningAds(campaigns, { excludeCampaignId: "c" }), 2);
check("CB-2", "2 no ar + 2 novos cabe em limite 4", countRunningAds(campaigns, { excludeCampaignId: "c" }) + 2 <= 4, true);

console.log(`\n${passes} ok, ${failures} falha(s)\n`);
process.exit(failures > 0 ? 1 : 0);
