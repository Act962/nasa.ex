/**
 * Checagens sem banco da hierarquia de vinculados (spec 0076).
 *
 *   pnpm tsx scripts/lead-members-qa-check.ts
 */
import {
  buildMemberTree,
  depthUnderParent,
  resolveMemberLabels,
  subtreeHeight,
  wouldCreateCycle,
} from "../src/features/lead-members/lib/member-tree";
import { computeClosing, groupLinesForBilling } from "../src/features/form-records/lib/compute-closing";

let failureCount = 0;
function check(name: string, isPassing: boolean, detail = "") {
  if (!isPassing) failureCount += 1;
  console.log(`[${isPassing ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
}

const members = [
  { id: "a", parentMemberId: null },
  { id: "b", parentMemberId: "a" },
  { id: "c", parentMemberId: "b" },
  { id: "d", parentMemberId: null },
  { id: "orfao", parentMemberId: "apagado" },
];

const tree = buildMemberTree(members);
check("CA-13 três níveis: A → B → C", tree[0]?.id === "a" && tree[0].children[0]?.id === "b" && tree[0].children[0].children[0]?.id === "c", JSON.stringify(tree.map((node) => node.id)));
check("CA-13 nível de cada nó", tree[0].depth === 0 && tree[0].children[0].children[0].depth === 2);
check("vinculado com pai inexistente vira raiz, não some", tree.some((node) => node.id === "orfao"));
check("CA-13 pôr A abaixo de C é ciclo", wouldCreateCycle(members, "a", "c"));
check("CA-13 pôr A abaixo de A é ciclo", wouldCreateCycle(members, "a", "a"));
check("pôr D abaixo de C não é ciclo", !wouldCreateCycle(members, "d", "c"));
check("tirar o pai nunca é ciclo", !wouldCreateCycle(members, "c", null));
check("nível abaixo de C é 4; direto no lead é 1", depthUnderParent(members, "c") === 4 && depthUnderParent(members, null) === 1);
check("altura da subárvore de A é 3", subtreeHeight(members, "a") === 3);
const looped = [
  { id: "x", parentMemberId: "y" },
  { id: "y", parentMemberId: "x" },
];
check("dado já em ciclo não trava a conferência", wouldCreateCycle(looped, "x", "y") === true);
check("nome padrão quando a empresa não definiu", resolveMemberLabels(null).plural === "Vinculados" && resolveMemberLabels({ singular: " Loja ", plural: "" }).singular === "Loja");

// Fechamento por vinculado (spec 0076, CA-4 e CA-5).
const closingRecords = [
  ...Array.from({ length: 3 }, () => ({ leadId: "grupo", leadMemberId: "m1", usageTotalCents: 100, isFinalized: true })),
  { leadId: "grupo", leadMemberId: "m2", usageTotalCents: 100, isFinalized: true },
  { leadId: "simples", leadMemberId: null, usageTotalCents: 100, isFinalized: true },
  { leadId: "simples", usageTotalCents: 100, isFinalized: true },
];
const sharedGroups = [{ id: "g", name: "Insumos", lines: [{ id: "l", description: "", quantity: 1, unit: "un", totalCents: 10_001, date: null }] }];
const leadNameById = new Map([
  ["grupo", "Grupo"],
  ["simples", "Simples"],
]);
const closingWith = (m2BillingMode: "TITULAR" | "PROPRIO") =>
  computeClosing({
    records: closingRecords,
    groups: sharedGroups,
    leadNameById,
    memberInfoById: new Map([
      ["m1", { name: "Filial 1", billingMode: "TITULAR" as const, costCenterId: null }],
      ["m2", { name: "Filial 2", billingMode: m2BillingMode, costCenterId: "cc2" }],
    ]),
  });
const closing = closingWith("TITULAR");
const shareBy = (leadId: string, leadMemberId: string) => closing.lines.find((line) => line.leadId === leadId && line.leadMemberId === leadMemberId)?.sharedCostCents ?? -1;
check(
  "CA-4 rateio 3/6, 1/6, 2/6 fecha com o total, centavo a centavo",
  shareBy("grupo", "m1") + shareBy("grupo", "m2") + shareBy("simples", "") === 10_001 && shareBy("grupo", "m1") >= 5000 && shareBy("grupo", "m2") >= 1666 && shareBy("simples", "") >= 3333,
  `${shareBy("grupo", "m1")}/${shareBy("grupo", "m2")}/${shareBy("simples", "")}`,
);
check("CA-1 cliente sem vinculado continua com uma linha só", closing.lines.filter((line) => line.leadId === "simples").length === 1 && closing.lines.find((line) => line.leadId === "simples")?.recordCount === 2);
check("CA-5 os dois vinculados no titular: 2 contas", groupLinesForBilling(closing.lines).length === 2);
const ownBillingGroups = groupLinesForBilling(closingWith("PROPRIO").lines);
check(
  "CA-5 um vinculado de cobrança própria: 3 contas, a dele com o centro de custo",
  ownBillingGroups.length === 3 && ownBillingGroups.find((billingGroup) => billingGroup.ownMemberName === "Filial 2")?.costCenterId === "cc2",
  `${ownBillingGroups.length} grupo(s)`,
);
check(
  "soma das contas é igual ao total do fechamento",
  ownBillingGroups.reduce((total, billingGroup) => total + billingGroup.totalCents, 0) === closing.totalCents,
);

console.log(failureCount === 0 ? "\nTudo certo." : `\n${failureCount} falha(s).`);
process.exitCode = failureCount === 0 ? 0 : 1;
