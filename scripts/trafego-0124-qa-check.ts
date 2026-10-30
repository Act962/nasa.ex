// Conferência das regras puras da spec 0124 (campanha de WhatsApp pelo painel).
// Não há runner de testes no projeto (CLAUDE.md, regra 20): cada CA-n vira uma asserção aqui.
// Nenhuma chamada à Meta: só a montagem dos payloads e as regras.
//
//   pnpm tsx scripts/trafego-0124-qa-check.ts

import {
  buildAdPayload,
  buildAdSetPayload,
  buildCampaignName,
  buildCampaignPayload,
  buildCreativePayload,
  extractDraftKey,
  generateDraftKey,
  isValidDraftKey,
  readAudienceFromTargeting,
} from "../src/features/trafego/lib/campaign-builder/build-meta-payloads";
import {
  buildEndTimeIso,
  countCampaignDays,
  estimateBudgetComplement,
  isBelowMinDailyBudget,
  isCampaignBuilderStatus,
  pickSuggestionAdSet,
} from "../src/features/trafego/lib/campaign-builder/builder-rules";
import { prescreenAdContent } from "../src/features/trafego/lib/ad-policies";
import { encodeMetaPayload } from "../src/http/meta/ads-builder";

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

const audience = { cityKey: "251767", cityName: "Teresina", radiusKm: 17, ageMin: 16, ageMax: 70, gender: "all" as const };

console.log("\nCampanha (CA-3)");
const campaign = buildCampaignPayload({ name: "TG-0002 — Clínica — Mensagens #abc123", lifetimeBudgetCents: 30_000 });
check("CA-3", "objetivo de engajamento", campaign.objective, "OUTCOME_ENGAGEMENT");
check("CA-3", "nasce pausada", campaign.status, "PAUSED");
check("CA-3", "orçamento total na campanha", campaign.lifetime_budget, 30_000);
check("CA-3", "lance explícito", campaign.bid_strategy, "LOWEST_COST_WITHOUT_CAP");
check("CA-3", "sem categoria especial", campaign.special_ad_categories, []);

console.log("\nConjunto e público (CA-3)");
const adset = buildAdSetPayload({
  name: "TG-0002 — Público",
  campaignId: "1",
  pageId: "99",
  audience,
  endTimeIso: "2026-11-15T23:59:00-03:00",
});
const targeting = adset.targeting as Record<string, unknown>;
check("CA-3", "destino WhatsApp", adset.destination_type, "WHATSAPP");
check("CA-3", "otimiza para conversas", adset.optimization_goal, "CONVERSATIONS");
check("CA-3", "cobra por impressão", adset.billing_event, "IMPRESSIONS");
check("CA-3", "página no promoted_object", adset.promoted_object, { page_id: "99" });
check("CA-3", "tem data de fim", adset.end_time, "2026-11-15T23:59:00-03:00");
check("CA-3", "só Facebook e Instagram", targeting.publisher_platforms, ["facebook", "instagram"]);
check("CA-3", "sem explore", (targeting.instagram_positions as string[]).includes("explore"), false);
check("CA-3", "idade mínima nunca abaixo de 18", targeting.age_min, 18);
check("CA-3", "idade máxima no teto de 65", targeting.age_max, 65);
check("CA-3", "advantage_audience explícito", targeting.targeting_automation, { advantage_audience: 0 });
check("CA-3", "todos os gêneros não manda genders", "genders" in targeting, false);
check(
  "RF-10",
  "público relido do conjunto",
  readAudienceFromTargeting(targeting),
  { cityKey: "251767", cityName: null, radiusKm: 17, ageMin: 18, ageMax: 65, gender: "all" },
);

console.log("\nCriativo e anúncio (CA-3)");
const postCreative = buildCreativePayload({
  name: "TG-0002 — Criativo",
  pageId: "99",
  instagramUserId: "1784",
  source: { kind: "instagram_post", mediaId: "555" },
});
check("CA-3", "post do Instagram por source_instagram_media_id", postCreative, {
  name: "TG-0002 — Criativo",
  object_id: "99",
  instagram_user_id: "1784",
  source_instagram_media_id: "555",
  call_to_action: { type: "WHATSAPP_MESSAGE", value: { app_destination: "WHATSAPP" } },
});
const ad = buildAdPayload({ name: "TG-0002 — Anúncio", adsetId: "2", creativeId: "3" });
check("CA-3", "anúncio pausado com o criativo", [ad.status, ad.creative], ["PAUSED", { creative_id: "3" }]);
check(
  "CA-3",
  "objetos viram JSON no corpo",
  encodeMetaPayload({ promoted_object: { page_id: "99" }, status: "PAUSED", ignored: undefined }).toString(),
  "promoted_object=%7B%22page_id%22%3A%2299%22%7D&status=PAUSED",
);

console.log("\nChave do rascunho (CA-4)");
const draftKey = generateDraftKey(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
check("CA-4", "chave gerada é válida", isValidDraftKey(draftKey), true);
const name = buildCampaignName({ orderCode: "TG-0002", businessName: "Clínica #1\nTércio", draftKey });
check("CA-4", "a chave volta do nome", extractDraftKey(name), draftKey);
check("CA-4", "nome tem o código do pedido", name.startsWith("TG-0002 — Clínica 1 Tércio — Mensagens #"), true);

console.log("\nAtributos pessoais (CA-6)");
check(
  "CA-6",
  "\"Você sofre de…?\" é bloqueado",
  prescreenAdContent({ platform: "META_ADS", texts: ["Você sofre de dor nas costas?"] }).level,
  "BLOCKED",
);
check(
  "CA-6",
  "falar do serviço passa",
  prescreenAdContent({ platform: "META_ADS", texts: ["Tratamento para dor nas costas com especialista."] }).level,
  "OK",
);

console.log("\nVerba (CA-11, RF-6)");
check(
  "CA-11",
  "acima do saldo pede confirmação com 30% do excedente",
  estimateBudgetComplement({ budgetBrlCents: 100_000, declaredBudgetBrlCents: 30_000, spentBrlCents: 0 }),
  { remainingDeclaredBrlCents: 30_000, excessBrlCents: 70_000, estimatedComplementBrlCents: 21_000, needsConfirmation: true },
);
check(
  "CA-11",
  "dentro do saldo não pede",
  estimateBudgetComplement({ budgetBrlCents: 20_000, declaredBudgetBrlCents: 30_000, spentBrlCents: 5_000 }).needsConfirmation,
  false,
);
check("RF-6", "dias contam os dois extremos", countCampaignDays("2026-11-01", "2026-11-07"), 7);
check(
  "RF-6",
  "abaixo do mínimo diário",
  isBelowMinDailyBudget({ budgetBrlCents: 3_000, days: 7, minDailyBudgetCents: 600 }),
  true,
);
check("RF-6", "fim do dia com o fuso explícito", buildEndTimeIso("2026-11-15", "America/Sao_Paulo"), "2026-11-15T23:59:00-03:00");

console.log("\nGuarda e sugestão (RF-1, RF-4)");
check("RF-1", "pedido cancelado não cria", isCampaignBuilderStatus("CANCELLED"), false);
check("RF-1", "pedido no ar cria", isCampaignBuilderStatus("RUNNING"), true);
check(
  "RF-4",
  "melhor conjunto = menor custo por conversa com R$ 30+ gastos",
  pickSuggestionAdSet([
    { adsetId: "a", spendCents: 2_000, conversations: 10 },
    { adsetId: "b", spendCents: 10_000, conversations: 10 },
    { adsetId: "c", spendCents: 9_000, conversations: 15 },
  ])?.adsetId,
  "c",
);

console.log(`\n${passes} ok, ${failures} falha(s)\n`);
process.exit(failures > 0 ? 1 : 0);
