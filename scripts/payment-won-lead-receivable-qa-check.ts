// Conferência da spec 0074 (lead ganho vira conta a receber): regras puras,
// sem banco. Não há runner de testes no projeto (CLAUDE.md, regra 20).
//
//   pnpm tsx scripts/payment-won-lead-receivable-qa-check.ts

import {
  buildWonLeadReceivableDescription,
  decideWonLeadReceivable,
  toSaoPauloDateInput,
} from "../src/features/payment/lib/won-lead-receivable";

const failures: string[] = [];

function check(criterion: string, description: string, isOk: boolean) {
  console.log(`  ${isOk ? "✅" : "❌"} ${criterion} — ${description}`);
  if (!isOk) failures.push(`${criterion} — ${description}`);
}

const created = decideWonLeadReceivable({
  leadAmountCents: 1_200_000,
  hasLinkedReceivable: false,
  hasActor: true,
});
check(
  "CA-1",
  "lead com R$ 12.000,00 e sem lançamento gera A receber de 1.200.000 centavos",
  created.shouldCreate && created.amountCents === 1_200_000,
);

const zeroAmount = decideWonLeadReceivable({
  leadAmountCents: 0,
  hasLinkedReceivable: false,
  hasActor: true,
});
check(
  "CA-3",
  "lead com valor zero não gera lançamento",
  !zeroAmount.shouldCreate && zeroAmount.reason === "no_amount",
);

const alreadyLinked = decideWonLeadReceivable({
  leadAmountCents: 1_200_000,
  hasLinkedReceivable: true,
  hasActor: true,
});
check(
  "CA-4 / CB-1 / CB-2 / CB-4",
  "lead que já tem A receber vinculado não gera outro",
  !alreadyLinked.shouldCreate && alreadyLinked.reason === "already_linked",
);

const noActor = decideWonLeadReceivable({
  leadAmountCents: 1_200_000,
  hasLinkedReceivable: false,
  hasActor: false,
});
check(
  "CB-6",
  "sem autor possível não gera lançamento",
  !noActor.shouldCreate && noActor.reason === "no_actor",
);

const fractional = decideWonLeadReceivable({
  leadAmountCents: 1999.6,
  hasLinkedReceivable: false,
  hasActor: true,
});
check(
  "CB-9",
  "valor fracionado é arredondado para centavos inteiros",
  fractional.shouldCreate && fractional.amountCents === 2000,
);

check(
  "CB-11",
  "ganho às 22h de Brasília vence no dia de Brasília, não no dia UTC",
  toSaoPauloDateInput(new Date("2026-10-08T01:00:00.000Z")) === "2026-10-07",
);

check(
  "RF-3",
  "descrição usa o nome do lead e tem saída para lead sem nome",
  buildWonLeadReceivableDescription(" Weydson Lima ") === "Venda — Weydson Lima" &&
    buildWonLeadReceivableDescription("  ") === "Venda — lead sem nome",
);

if (failures.length > 0) {
  console.error(`\n${failures.length} falha(s):\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("\nTudo certo.");
