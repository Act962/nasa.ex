// Conferência das regras puras da campanha de sorteio do STAR FRIENDS contra os critérios de
// aceite da spec 0102. Não há runner de testes no projeto (CLAUDE.md, regra 20).
//
//   pnpm tsx scripts/star-friends-campaign-check.ts

import {
  buildReceiptFingerprint,
  computeLuckyNumbers,
  correctMisreadYear,
  findReceiptsToVoid,
  isIssuerAccepted,
  isSamePhone,
  parseIssuedAt,
  receiptFlagsOf,
  startOfBrasiliaDay,
  toBrasiliaDay,
  rulesVersionOf,
  toAccessKey,
  toValidCnpj,
  type ReceiptReading,
} from "../src/features/star-friends/utils/campaign";

let failures = 0;
function check(label: string, isOk: boolean) {
  if (!isOk) failures++;
  console.log(`${isOk ? "✅" : "❌"} ${label}`);
}

const reading = (overrides: Partial<ReceiptReading> = {}): ReceiptReading => ({
  issuerDocument: "12345678000190",
  receiptNumber: "000123",
  accessKey: null,
  issuedAt: "2026-10-20T14:32",
  totalCents: 15_000,
  isFiscal: true,
  confidence: 0.95,
  ...overrides,
});

// CA-1: R$ 150 e depois R$ 60 → 1 número, 1 número, sobra de R$ 10.
const first = computeLuckyNumbers({ carryOverCents: 0, totalCents: 15_000, amountPerNumberCents: 10_000 });
const second = computeLuckyNumbers({ carryOverCents: first.carryOverCents, totalCents: 6_000, amountPerNumberCents: 10_000 });
check("CA-1 primeiro cupom de R$ 150 rende 1 número e guarda R$ 50", first.numbers === 1 && first.carryOverCents === 5_000);
check("CA-1 segundo cupom de R$ 60 rende 1 número e guarda R$ 10", second.numbers === 1 && second.carryOverCents === 1_000);
check("CB-6 cupom de R$ 40 rende 0 números e vai para a sobra", computeLuckyNumbers({ carryOverCents: 0, totalCents: 4_000, amountPerNumberCents: 10_000 }).numbers === 0);
check("RF-7 cupom de R$ 300 rende 3 números", computeLuckyNumbers({ carryOverCents: 0, totalCents: 30_000, amountPerNumberCents: 10_000 }).numbers === 3);

// CA-3: a mesma compra lida em duas fotos diferentes gera a mesma impressão digital.
check(
  "CA-3 impressão digital igual para a mesma compra, com zeros à esquerda e hora diferentes",
  buildReceiptFingerprint(reading()) === buildReceiptFingerprint(reading({ receiptNumber: "123", issuedAt: "2026-10-20T14:33" })),
);
check("CA-3 impressão digital muda quando o total muda", buildReceiptFingerprint(reading()) !== buildReceiptFingerprint(reading({ totalCents: 15_001 })));
check("RF-6 sem número do cupom não há impressão digital (fica para a varredura)", buildReceiptFingerprint(reading({ receiptNumber: null })) === null);
const printedAccessKey = "2226 1023 1985 2200 0145 6500 3000 0335 1298 0950 0664";
check("RF-6 chave de acesso só vale com 44 dígitos e verificador certo", toAccessKey("1234") === null && toAccessKey(printedAccessKey)?.length === 44);
check("RF-6 chave de acesso com um dígito trocado não vale", toAccessKey(printedAccessKey.replace("1985", "1986")) === null);
check("RF-9 CNPJ com verificador certo é aceito como lido", toValidCnpj("23.198.522/0001-45") === "23198522000145");
check(
  "RF-9 CNPJ com dígito trocado ou engolido conta como não lido",
  toValidCnpj("23198522000148") === null && toValidCnpj("2319852200145") === null && toValidCnpj("231988522000145") === null,
);

// CA-4: dois cupons sem número, mesmo emissor, minuto e total → o mais novo é anulado.
const issuedAt = new Date("2026-10-20T17:32:00Z");
const sweep = findReceiptsToVoid([
  { id: "old", issuerDocument: "12345678000190", receiptNumber: null, issuedAt, totalCents: 15_000 },
  { id: "other", issuerDocument: "12345678000190", receiptNumber: null, issuedAt, totalCents: 9_900 },
  { id: "new", issuerDocument: "12345678000190", receiptNumber: null, issuedAt, totalCents: 15_000 },
]);
check("CA-4 varredura anula só o cupom mais novo do grupo", sweep.size === 1 && sweep.get("new") === "old");
const sweepByNumber = findReceiptsToVoid([
  { id: "a", issuerDocument: "12345678000190", receiptNumber: "123", issuedAt, totalCents: 15_000 },
  { id: "b", issuerDocument: "12345678000190", receiptNumber: "123", issuedAt: null, totalCents: 15_100 },
]);
check("RF-10 varredura pega o mesmo número de cupom com valor lido diferente", sweepByNumber.get("b") === "a");
const withoutTime = new Date("2026-10-20T03:00:00Z");
const threeHoursLater = new Date("2026-10-20T20:32:00Z");
const sweepByDay = findReceiptsToVoid([
  { id: "timed", issuerDocument: "12345678000190", receiptNumber: null, issuedAt, totalCents: 4_500 },
  { id: "untimed", issuerDocument: "12345678000190", receiptNumber: null, issuedAt: withoutTime, totalCents: 4_500 },
]);
check("RF-10 hora não lida num dos cupons: mesmo dia e total ainda é a mesma compra", sweepByDay.get("untimed") === "timed");
const sweepDistinct = findReceiptsToVoid([
  { id: "morning", issuerDocument: "12345678000190", receiptNumber: null, issuedAt, totalCents: 4_500 },
  { id: "evening", issuerDocument: "12345678000190", receiptNumber: null, issuedAt: threeHoursLater, totalCents: 4_500 },
  { id: "numbered-a", issuerDocument: "12345678000190", receiptNumber: "10", issuedAt, totalCents: 8_000 },
  { id: "numbered-b", issuerDocument: "12345678000190", receiptNumber: "11", issuedAt, totalCents: 8_000 },
]);
check("RF-10 mesmo total em horas diferentes, ou com números de cupom diferentes, não é anulado", sweepDistinct.size === 0);

const sweepLeadingZeros = findReceiptsToVoid([
  { id: "padded", issuerDocument: "12345678000190", receiptNumber: "000123", issuedAt, totalCents: 15_000 },
  { id: "plain", issuerDocument: "12345678000190", receiptNumber: "123", issuedAt: null, totalCents: 15_100 },
]);
check("RF-10 zeros à esquerda não fazem o mesmo número de cupom parecer outro", sweepLeadingZeros.get("plain") === "padded");

// CA-7 e CA-10: datas no horário de Brasília, com o servidor em UTC.
check("CA-7 data do cupom com segundos é interpretada", parseIssuedAt("2026-10-20T14:32:05")?.toISOString() === "2026-10-20T17:32:00.000Z");
check("CA-7 data do cupom sem hora vale como início do dia em Brasília", parseIssuedAt("2026-10-20")?.toISOString() === "2026-10-20T03:00:00.000Z");
check("CA-7 data ilegível não vira data", parseIssuedAt("20/10/2026") === null && parseIssuedAt(null) === null);
check("CA-10 o dia do limite vira à meia-noite de Brasília, não às 21h", startOfBrasiliaDay(new Date("2026-10-21T01:30:00Z")).toISOString() === "2026-10-20T03:00:00.000Z");
check("RF-1 fim da campanha (23:59 de Brasília) aparece no mesmo dia na tela", toBrasiliaDay(new Date("2026-10-31T23:59:59-03:00")) === "2026-10-31");

// CB-17: a leitura erra o ano e acerta o dia.
const campaignPeriod = { startsAt: new Date("2026-10-12T03:00:00Z"), endsAt: new Date("2026-11-07T02:59:59Z") };
check("CB-17 ano lido errado (2023) com dia dentro do período é corrigido", correctMisreadYear(new Date("2023-10-13T03:00:00Z"), campaignPeriod) === "2026-10-13T00:00");
check("CB-17 data dentro do período não é mexida", correctMisreadYear(new Date("2026-10-13T19:35:00Z"), campaignPeriod) === null);
check("CA-7 dia fora do período continua fora, em qualquer ano", correctMisreadYear(new Date("2026-09-30T15:00:00Z"), campaignPeriod) === null);

// CA-5 e CB-8: o número digitado só é comparado com o de quem escreve.
check("CA-5 número diferente é recusado", !isSamePhone("86 99999-0000", "558698221810"));
check("CB-8 mesmo número sem 55 é aceito", isSamePhone("(86) 99822-1810", "5586998221810"));
check("CB-8 mesmo número sem o nono dígito é aceito", isSamePhone("86 9822-1810", "5586998221810"));
check("CB-8 remetente sem o nono dígito e digitado com ele é aceito", isSamePhone("86998221810", "558698221810"));
check("CA-5 texto que não é telefone é recusado", !isSamePhone("meu número", "5586998221810"));

// CA-7: CNPJ fora da lista é recusado; ilegível entra com alerta.
check("CA-7 CNPJ de outra loja é recusado", !isIssuerAccepted("99999999000199", ["12.345.678/0001-90"]));
check("CA-7 CNPJ da loja é aceito com máscara", isIssuerAccepted("12345678000190", ["12.345.678/0001-90"]));
check("RF-9 CNPJ ilegível não reprova", isIssuerAccepted(null, ["12.345.678/0001-90"]));
check("RF-9 cupom sem número e sem chave recebe alerta", receiptFlagsOf(reading({ receiptNumber: null })).length === 1);
check("RF-9 cupom completo não recebe alerta", receiptFlagsOf(reading()).length === 0);
check("RF-9 comprovante não fiscal com baixa confiança recebe dois alertas", receiptFlagsOf(reading({ isFiscal: false, confidence: 0.4 })).length === 2);

check("aceite guarda a versão do texto: muda quando as regras mudam", rulesVersionOf("regras A", null) !== rulesVersionOf("regras B", null));

if (failures > 0) {
  console.error(`\n${failures} verificação(ões) falharam.`);
  process.exit(1);
}
console.log("\nTudo certo.");
