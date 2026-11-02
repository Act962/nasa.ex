// Conferência das regras puras da spec 0129 (avisos por campo do passo a passo).
//
//   pnpm tsx --conditions=react-server scripts/trafego-0129-qa-check.ts

import {
  checkWizardGuardrails,
  rewritePersonalAttribute,
  type GuardrailInput,
} from "../src/features/trafego/lib/wizard-guardrails";

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

const base: GuardrailInput = {
  platform: "META_ADS",
  objective: "MESSAGES",
  message: "Cirurgia de catarata com acompanhamento completo. Chame no WhatsApp.",
  headline: "",
  audienceChips: [],
  adBudgetBrlCents: 90_000,
  account: { avgCostPerConversationCents: 800, minDailyBudgetCents: 600 },
  creative: { score: 80, verdict: "ready" },
};

const ids = (input: GuardrailInput) => checkWizardGuardrails(input).map((warning) => warning.id);

console.log("\nTexto (CA-5)");
check("CA-5", "pergunta sobre condição pessoal vira aviso", ids({ ...base, message: "Você tem catarata? Agende sua cirurgia" }), ["personal-question"]);
check(
  "CA-5",
  "a frase reescrita fala do serviço",
  rewritePersonalAttribute("Você tem catarata? Agende sua cirurgia"),
  "Conheça o tratamento para catarata. Agende sua cirurgia",
);
check("RF-6", "texto limpo não gera aviso", ids(base), []);
check("RF-6", "primeiro parágrafo com mais de 125 caracteres", ids({ ...base, message: "a".repeat(130) }), ["text-too-long"]);
check(
  "CA-8",
  "atributo pessoal do dicionário barra (bloqueado)",
  checkWizardGuardrails({ ...base, message: "Você sofre de dor nas costas? Chame." }).some((warning) => warning.level === "blocked"),
  true,
);

console.log("\nVerba (CA-6)");
check("CA-6", "R$ 5/dia com custo médio de R$ 8 → atenção", ids({ ...base, adBudgetBrlCents: 15_000, account: { avgCostPerConversationCents: 800, minDailyBudgetCents: 100 } }), ["budget-below-conversation-cost"]);
check("CA-8", "abaixo do mínimo da Meta → bloqueado", checkWizardGuardrails({ ...base, adBudgetBrlCents: 9_000 })[0]?.level, "blocked");
check("CA-10", "conta sem histórico não gera aviso de verba", ids({ ...base, adBudgetBrlCents: 15_000, account: null }), []);

console.log("\nObjetivo, público e criativo (CA-7, RF-6)");
check("CA-7", "Reconhecimento no Meta → atenção", ids({ ...base, objective: "AWARENESS" }), ["objective-not-messages"]);
check("RF-6", "idade 18 a 24 → público estreito", ids({ ...base, audienceChips: [{ dimension: "age", value: "18 a 24 anos" }] }), ["audience-narrow-age"]);
check("RF-6", "idade 25 a 45 → ok", ids({ ...base, audienceChips: [{ dimension: "age", value: "25 a 45 anos" }] }), []);
check("RF-6", "criativo com nota 40 → atenção", ids({ ...base, creative: { score: 40, verdict: "improve" } }), ["creative-weak"]);

console.log(`\n${passes} ok, ${failures} falha(s)\n`);
process.exit(failures > 0 ? 1 : 0);
