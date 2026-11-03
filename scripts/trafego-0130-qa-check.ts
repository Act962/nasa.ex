// Conferência das regras puras da spec 0130 (prompt para o Claude e região obrigatória).
//
//   pnpm tsx --conditions=react-server scripts/trafego-0130-qa-check.ts

import { buildPublishPrompt, type PublishPromptInput } from "../src/features/trafego/lib/publish-prompt";
import { checkWizardGuardrails } from "../src/features/trafego/lib/wizard-guardrails";

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

const complete: PublishPromptInput = {
  code: "TG-0042",
  businessName: "Clínica Tércio Rezende",
  businessNiche: "Saúde",
  objectiveLabel: "Mensagens",
  campaignTypeLabel: "Prospecção",
  targetAudience: "Gênero: Todos · Idade: 45 a 65+ anos · Localização: Teresina",
  adBudgetBrlCents: 90_000,
  durationDays: 30,
  desiredStartAt: "05/11/2026",
  adAccountId: "act_751951975841502",
  page: { id: "678052305650990", name: "Clínica Tércio Rezende", whatsappNumber: "5586999990000", instagramUsername: "clinicaterciorezende" },
  copy: { message: "Cirurgia de catarata com acompanhamento completo. Chame no WhatsApp.", headline: "Avaliação de catarata" },
  initialMessage: "Olá! Vi o anúncio e quero saber da avaliação.",
  creative: { url: "https://r2.example/creative.mp4?sig=abc", kind: "VIDEO", fileName: "catarata.mp4" },
  postLink: null,
  guidance: null,
};

console.log("\nPrompt (CA-5, CA-6, CB-1, CB-4)");
const result = buildPublishPrompt(complete);
check("CA-5", "pedido completo gera o prompt sem pendências", result.ok && result.pending, []);
const text = result.ok ? result.text : "";
check("CA-5", "leva a conta, a regra de pausado e o bloco de recomendações", [
  text.includes("act_751951975841502"),
  text.includes("TUDO PAUSADO"),
  text.includes("RECOMENDAÇÕES PARA O CLIENTE"),
  text.includes("https://r2.example/creative.mp4"),
], [true, true, true, true]);
check("RNF-1", "nenhum token no texto", /access_token|EAA[A-Za-z0-9]{10}/.test(text), false);
check("CA-6", "sem criativo não gera", buildPublishPrompt({ ...complete, creative: null }), { ok: false, missing: ["o criativo (arquivo ou link do post)"] });
const legacy = buildPublishPrompt({ ...complete, targetAudience: null, initialMessage: null, page: null });
check("CB-1", "pedido antigo lista o que confirmar", legacy.ok && legacy.pending.length, 4);
const fromPost = buildPublishPrompt({ ...complete, creative: null, postLink: "https://www.instagram.com/p/abc/" });
check("CB-4", "link do post pede para impulsionar", fromPost.ok && fromPost.text.includes("impulsionar o post existente"), true);

console.log("\nRegião (CA-3)");
const base = {
  platform: "META_ADS" as const,
  objective: "MESSAGES" as const,
  message: "",
  headline: "",
  adBudgetBrlCents: 90_000,
  account: null,
  creative: null,
  requireLocation: true,
};
check("CA-3", "sem região → bloqueado", checkWizardGuardrails({ ...base, audienceChips: [] }).map((warning) => [warning.id, warning.level]), [["audience-no-location", "blocked"]]);
check("CA-3", "com região → ok", checkWizardGuardrails({ ...base, audienceChips: [{ dimension: "location", value: "Teresina" }] }), []);

console.log(`\n${passes} ok, ${failures} falha(s)\n`);
process.exit(failures > 0 ? 1 : 0);
