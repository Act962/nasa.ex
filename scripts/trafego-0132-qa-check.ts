// Conferência das regras puras da spec 0132 (impressão digital do pedido, melhorias, liberar e publicar).
//
//   pnpm tsx --conditions=react-server scripts/trafego-0132-qa-check.ts

import {
  buildOrderFingerprintSource,
  canApproveByApplyingFixes,
  isReadyToPublish,
  orderReviewFixesSchema,
  type FingerprintOrder,
} from "../src/features/trafego/lib/order-review";
import { describeTeamActions } from "../src/features/trafego/lib/team-actions";

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

const order: FingerprintOrder = {
  adBudgetBrlCents: 30_000,
  durationDays: 30,
  desiredStartAt: new Date("2026-11-10T12:00:00Z"),
  targetAudience: "Teresina, 40 a 65 anos",
  initialMessage: "Olá! Vi o anúncio e quero saber da avaliação.",
  creatives: [
    { id: "c1", fileKey: "a.jpg", status: "UPLOADED" },
    { id: "c2", fileKey: "b.jpg", status: "REJECTED" },
  ],
  copies: [
    { id: "t1", primaryText: "Avaliação de catarata em Teresina.", headline: "Agende", isSelected: true },
    { id: "t2", primaryText: "Outro texto", headline: null, isSelected: false },
  ],
};
const base = buildOrderFingerprintSource(order);

console.log("Impressão digital do pedido (RF-6)");
check("CA-6", "texto escolhido mudou → muda", buildOrderFingerprintSource({ ...order, copies: [{ ...order.copies[0], primaryText: "Novo" }, order.copies[1]] }) !== base, true);
check("RF-6", "criativo novo → muda", buildOrderFingerprintSource({ ...order, creatives: [...order.creatives, { id: "c3", fileKey: "c.jpg", status: "UPLOADED" }] }) !== base, true);
check("RF-6", "mensagem inicial mudou → muda", buildOrderFingerprintSource({ ...order, initialMessage: "Oi" }) !== base, true);
check("RF-6", "público mudou → muda", buildOrderFingerprintSource({ ...order, targetAudience: "Piauí" }) !== base, true);
check("RF-6", "verba mudou → muda", buildOrderFingerprintSource({ ...order, adBudgetBrlCents: 40_000 }) !== base, true);
check("RF-6", "prazo mudou → muda", buildOrderFingerprintSource({ ...order, durationDays: 15 }) !== base, true);
check("RF-6", "criativo recusado não conta", buildOrderFingerprintSource({ ...order, creatives: [order.creatives[0]] }), base);
check("RF-6", "texto não escolhido não conta", buildOrderFingerprintSource({ ...order, copies: [order.copies[0]] }), base);

console.log("Melhorias (RF-5, RF-7)");
check("RF-7", "melhoria vazia é recusada", orderReviewFixesSchema.safeParse({}).success, false);
check("RF-7", "campo fora da lista é recusado", orderReviewFixesSchema.safeParse({ budget: 100 }).success, false);
check("RF-7", "mensagem inicial acima de 160 caracteres é recusada", orderReviewFixesSchema.safeParse({ initialMessage: "x".repeat(161) }).success, false);
const textFix = orderReviewFixesSchema.parse({ message: "Agende sua avaliação pelo WhatsApp.", initialMessage: "Olá! Quero agendar." });
check("CA-4", "só melhorias aplicáveis → aplica e aprova", canApproveByApplyingFixes({ fixes: textFix, notes: [] }), true);
check("CA-5", "com observação → não aprova direto", canApproveByApplyingFixes({ fixes: textFix, notes: ["Troque a foto"] }), false);
check("CA-5", "só observação → não aprova direto", canApproveByApplyingFixes({ fixes: null, notes: ["Troque a foto"] }), false);

console.log("Pronto para publicar (RF-7, CB-2, CA-8)");
const ready = { status: "SCHEDULED", hasReviewFingerprint: true, isReleasedByClient: true, hasLinkedCampaign: false, desiredStartAt: null };
check("CA-3", "aprovado e liberado → publicar", isReadyToPublish(ready), true);
check("CA-8", "sem liberação do cliente → não publica", isReadyToPublish({ ...ready, isReleasedByClient: false }), false);
check("CB-2", "data de início no futuro → espera", isReadyToPublish({ ...ready, desiredStartAt: new Date("2026-12-01"), now: new Date("2026-11-02") }), false);
check("RF-7", "já com campanha → não repete", isReadyToPublish({ ...ready, hasLinkedCampaign: true }), false);
check("CA-11", "fora do fluxo (sem avaliação) → não entra", isReadyToPublish({ ...ready, hasReviewFingerprint: false }), false);

console.log("Ações da equipe (RF-7)");
const actions = describeTeamActions({
  status: "SCHEDULED",
  hasCreative: true,
  hasCopy: true,
  hasLinkedCampaign: false,
  hasPendingApproval: false,
  hasApprovalToPublish: false,
  isReadyToPublish: true,
  lastActivityAt: new Date(),
}).actions;
check("RF-7", "pedido liberado aparece para publicar", actions[0], "Cliente liberou: publicar pela Meta e chamar trafego_mark_published");

console.log(`\n${passes} ok, ${failures} falha(s)`);
if (failures > 0) process.exit(1);
