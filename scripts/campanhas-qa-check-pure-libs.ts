// QA da spec 0040: funções puras de custo, taxa e lotes (CA-1, CA-2, CA-5).
import { estimateMetaCost } from "../src/features/campanhas/lib/meta-pricing";
import { quoteBroadcastFee } from "../src/features/campanhas/lib/broadcast-fee";
import { planDailyBatches, resolveMessagingLimit } from "../src/features/campanhas/lib/messaging-limits";

let failures = 0;
function check(label: string, isOk: boolean, detail: unknown) {
  if (!isOk) failures++;
  console.log(`${isOk ? "✅" : "❌"} ${label}`, detail);
}

const now = new Date("2026-09-27T12:00:00Z");
const marketing = estimateMetaCost({ recipients: 1000, category: "MARKETING", now });
const utility = estimateMetaCost({ recipients: 1000, category: "UTILITY", now });
check("CA-1 Marketing > Utilidade", marketing.totalBrlCents > utility.totalBrlCents, { marketing: marketing.totalBrlCents, utility: utility.totalBrlCents });
check("CA-1 1.000 contatos no limite 250 = 4 dias", planDailyBatches(1000, resolveMessagingLimit("TIER_250")).days === 4, planDailyBatches(1000, resolveMessagingLimit("TIER_250")));

const cases: [number, number][] = [[5_000, 50], [10_001, 40], [60_000, 35], [300_000, 30], [600_000, 25]];
for (const [metaCost, expectedPercent] of cases) {
  const quote = quoteBroadcastFee({ metaCostBrlCents: metaCost });
  check(`CA-2 faixa ${metaCost} → ${expectedPercent}%`, quote.feePercent === expectedPercent, quote);
}
const small = quoteBroadcastFee({ metaCostBrlCents: 1_000 });
check("CA-2 mínimo em campanha pequena", small.isMinimumApplied && small.serviceFeeBrlCents === 1_990, small);

const batches = planDailyBatches(600, resolveMessagingLimit("TIER_250"));
check("CA-5 600 contatos no nível 250 = 3 lotes", batches.days === 3 && batches.perDay.join() === "250,250,100", batches);
check("Tier desconhecido cai em 250", resolveMessagingLimit(null).dailyUniqueContacts === 250, resolveMessagingLimit(null));
check("TIER_1K antigo vira 2K", resolveMessagingLimit("TIER_1K").dailyUniqueContacts === 2000, resolveMessagingLimit("TIER_1K"));
check("Utilidade na janela grátis até 01/10", estimateMetaCost({ recipients: 100, category: "UTILITY", openWindowRecipients: 40, now }).chargedRecipients === 60, null);
check("Utilidade na janela paga após 01/10", estimateMetaCost({ recipients: 100, category: "UTILITY", openWindowRecipients: 40, now: new Date("2026-10-02T12:00:00Z") }).chargedRecipients === 100, null);

console.log(failures ? `\n${failures} falha(s)` : "\nTudo certo");
process.exit(failures ? 1 : 0);
