/**
 * Seed do NASA Payment para a org "orbita testes" (slug `orbita-teste`).
 *
 * Diferente do seed do Metropolis, este é construído para alimentar também a
 * PROJEÇÃO (spec 0009): gera 8 meses fechados de histórico PAGO — que é o que
 * forma a média da tendência — além de compromissos espalhados pelos 6 meses
 * seguintes. Sem histórico pago, a aba Projeção mostra "sem base histórica" e
 * não dá pra avaliar nada.
 *
 * Idempotente: tudo nasce com o prefixo `orb-` e é apagado antes de recriar,
 * então rodar duas vezes não duplica. Não toca em nada fora desse prefixo.
 *
 * Uso: pnpm exec tsx scripts/seed-payment-orbita.ts
 */
import { config } from "dotenv";
const externalDbUrl = process.env.DATABASE_URL;
config({ path: ".env" });
config({ path: ".env.local", override: true });
if (externalDbUrl) process.env.DATABASE_URL = externalDbUrl;

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { buildProjection } from "../src/features/payment/server/projection/build-projection";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any);

const ORG_ID = "j3ItG8nj0dvXkhbz9TLHUIdrK1lsG8gn"; // orbita testes (orbita-teste)
const OWNER_ID = "ORbAnBsYWctjhAbAl6maZ5xFbloc0Rsp"; // suportetecniconasa@gmail.com
const PREFIX = "orb-";

/** Meses fechados de histórico. 8 cobre com folga a janela de 6 da projeção. */
const HISTORY_MONTHS = 8;
/** Meses à frente com compromissos lançados. */
const FUTURE_MONTHS = 6;

const now = new Date();
const YEAR = now.getFullYear();
const MONTH = now.getMonth();

function dateAt(monthOffset: number, day: number): Date {
  // Dia 0 do mês seguinte = último dia do mês corrente; evita 31/fev.
  const lastDay = new Date(YEAR, MONTH + monthOffset + 1, 0).getDate();
  return new Date(YEAR, MONTH + monthOffset, Math.min(day, lastDay), 12, 0, 0, 0);
}

function reais(value: number): number {
  return Math.round(value * 100);
}

/**
 * Ruído determinístico em [-1, 1]. Random puro faria cada execução gerar
 * números diferentes, e aí "o gráfico mudou" nunca distinguiria mudança de
 * código de mudança de seed.
 */
function wobble(seed: number): number {
  return Math.sin(seed * 12.9898) * 43758.5453 % 1;
}

function vary(base: number, seed: number, spread = 0.18): number {
  return Math.round(base * (1 + wobble(seed) * spread));
}

async function main() {
  console.log('💰 Seed Payment — org "orbita testes"\n');

  // ── 1. Contas bancárias ────────────────────────────────────────────────
  const accounts = [
    {
      id: `${PREFIX}acc-bb`,
      name: "Banco do Brasil PJ",
      bankName: "Banco do Brasil",
      bankCode: "001",
      agency: "1234",
      account: "56789-0",
      type: "CHECKING" as const,
      balance: reais(38_400),
      isDefault: true,
      color: "#FBBF24",
    },
    {
      id: `${PREFIX}acc-inter`,
      name: "Inter Empresas",
      bankName: "Banco Inter",
      bankCode: "077",
      agency: "0001",
      account: "11223-4",
      type: "DIGITAL" as const,
      balance: reais(15_750),
      isDefault: false,
      color: "#FF7A00",
    },
    {
      id: `${PREFIX}acc-reserva`,
      name: "Reserva de emergência",
      bankName: "Nubank",
      bankCode: "260",
      agency: "0001",
      account: "99887-6",
      type: "SAVINGS" as const,
      balance: reais(52_000),
      isDefault: false,
      color: "#8A05BE",
    },
  ];

  for (const account of accounts) {
    await prisma.paymentBankAccount.upsert({
      where: { id: account.id },
      create: { ...account, organizationId: ORG_ID },
      update: account,
    });
  }
  const openingBalance = accounts.reduce((total, a) => total + a.balance, 0);
  console.log(`✔ ${accounts.length} contas bancárias — saldo total R$ ${(openingBalance / 100).toLocaleString("pt-BR")}`);

  // ── 2. Categorias ──────────────────────────────────────────────────────
  const categories = [
    { id: `${PREFIX}cat-mensalidade`, name: "Mensalidades", type: "REVENUE" as const, color: "#22C55E", icon: "🔁" },
    { id: `${PREFIX}cat-projetos`, name: "Projetos", type: "REVENUE" as const, color: "#10B981", icon: "🚀" },
    { id: `${PREFIX}cat-trafego`, name: "Gestão de Tráfego", type: "REVENUE" as const, color: "#059669", icon: "📈" },
    { id: `${PREFIX}cat-folha`, name: "Folha de Pagamento", type: "EXPENSE" as const, color: "#EF4444", icon: "👥" },
    { id: `${PREFIX}cat-aluguel`, name: "Aluguel e Condomínio", type: "EXPENSE" as const, color: "#F97316", icon: "🏢" },
    { id: `${PREFIX}cat-software`, name: "Softwares e Assinaturas", type: "EXPENSE" as const, color: "#6366F1", icon: "💻" },
    { id: `${PREFIX}cat-anuncios`, name: "Verba de Anúncios", type: "COST" as const, color: "#A855F7", icon: "📣" },
    { id: `${PREFIX}cat-impostos`, name: "Impostos", type: "EXPENSE" as const, color: "#DC2626", icon: "🧾" },
    { id: `${PREFIX}cat-infra`, name: "Infraestrutura", type: "COST" as const, color: "#0EA5E9", icon: "☁️" },
  ];

  for (const category of categories) {
    await prisma.paymentCategory.upsert({
      where: { id: category.id },
      create: { ...category, organizationId: ORG_ID },
      update: category,
    });
  }
  console.log(`✔ ${categories.length} categorias`);

  // ── 3. Centros de custo ────────────────────────────────────────────────
  const costCenters = [
    { id: `${PREFIX}cc-operacao`, name: "Operação", description: "Custos recorrentes da operação" },
    { id: `${PREFIX}cc-comercial`, name: "Comercial", description: "Aquisição e retenção de clientes" },
    { id: `${PREFIX}cc-produto`, name: "Produto", description: "Desenvolvimento e infraestrutura" },
  ];

  for (const costCenter of costCenters) {
    await prisma.paymentCostCenter.upsert({
      where: { id: costCenter.id },
      create: { ...costCenter, organizationId: ORG_ID },
      update: costCenter,
    });
  }
  console.log(`✔ ${costCenters.length} centros de custo`);

  // ── 4. Contatos ────────────────────────────────────────────────────────
  const contacts = [
    { id: `${PREFIX}con-plastlima`, name: "Plastlima Esperantina", document: "12.345.678/0001-90", email: "financeiro@plastlima.com.br", phone: "5586999990001", contactType: "CUSTOMER", creditLimit: reais(60_000) },
    { id: `${PREFIX}con-parnaiba`, name: "Plastlima Parnaíba", document: "12.345.678/0002-71", email: "parnaiba@plastlima.com.br", phone: "5586999990002", contactType: "CUSTOMER", creditLimit: reais(45_000) },
    { id: `${PREFIX}con-piripiri`, name: "Plastlima Piripiri", document: "12.345.678/0003-52", email: "piripiri@plastlima.com.br", phone: "5586999990003", contactType: "CUSTOMER", creditLimit: reais(30_000) },
    { id: `${PREFIX}con-duascaras`, name: "Duas Caras Studio", document: "23.456.789/0001-01", email: "contato@duascaras.com.br", phone: "5586999990004", contactType: "CUSTOMER", creditLimit: reais(25_000) },
    { id: `${PREFIX}con-meta`, name: "Meta Platforms Brasil", document: "34.567.890/0001-12", email: "billing@meta.com", phone: "5511900000001", contactType: "SUPPLIER", creditLimit: 0 },
    { id: `${PREFIX}con-vercel`, name: "Vercel Inc.", document: "45.678.901/0001-23", email: "billing@vercel.com", phone: "5511900000002", contactType: "SUPPLIER", creditLimit: 0 },
    { id: `${PREFIX}con-imobiliaria`, name: "Imobiliária Centro", document: "56.789.012/0001-34", email: "locacao@imobcentro.com.br", phone: "5586999990005", contactType: "SUPPLIER", creditLimit: 0 },
    { id: `${PREFIX}con-contabilidade`, name: "Contabilidade Silva", document: "67.890.123/0001-45", email: "contato@contsilva.com.br", phone: "5586999990006", contactType: "SUPPLIER", creditLimit: 0 },
  ];

  for (const contact of contacts) {
    await prisma.paymentContact.upsert({
      where: { id: contact.id },
      create: { ...contact, organizationId: ORG_ID },
      update: contact,
    });
  }
  console.log(`✔ ${contacts.length} contatos`);

  // ── 5. Lançamentos ─────────────────────────────────────────────────────
  await prisma.paymentEntry.deleteMany({
    where: { organizationId: ORG_ID, id: { startsWith: `${PREFIX}ent-` } },
  });

  type EntrySeed = {
    id: string;
    type: "RECEIVABLE" | "PAYABLE";
    status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" | "PENDING_APPROVAL";
    description: string;
    amount: number;
    paidAmount?: number;
    dueDate: Date;
    paidAt?: Date | null;
    categoryId: string;
    contactId: string;
    accountId: string;
    costCenterId?: string;
    documentNumber?: string;
    installmentTotal?: number;
    installmentCurrent?: number;
    installmentGroupId?: string;
  };

  const entries: EntrySeed[] = [];
  let sequence = 0;
  const nextId = () => `${PREFIX}ent-${String(++sequence).padStart(3, "0")}`;

  /** Lançamento já quitado: pago é sempre o valor cheio, então não se repete. */
  function pushPaid(entry: Omit<EntrySeed, "id" | "status" | "paidAmount">) {
    entries.push({ ...entry, id: nextId(), status: "PAID", paidAmount: entry.amount });
  }

  // ── 5a. Histórico fechado e PAGO — base da tendência da projeção ───────
  // Receita crescendo devagar mês a mês; despesa quase estável. Assim a
  // média da projeção fica próxima do patamar recente, e o gráfico do DRE
  // mostra evolução em vez de uma linha reta.
  for (let offset = -HISTORY_MONTHS; offset <= -1; offset++) {
    const monthIndex = HISTORY_MONTHS + offset; // 0..7, cresce com o tempo
    const growth = 1 + monthIndex * 0.04;

    pushPaid({
      type: "RECEIVABLE",
      description: "Mensalidade — Plastlima Esperantina",
      amount: vary(reais(8_500 * growth), monthIndex + 1),
      dueDate: dateAt(offset, 5),
      paidAt: dateAt(offset, 5),
      categoryId: `${PREFIX}cat-mensalidade`,
      contactId: `${PREFIX}con-plastlima`,
      accountId: `${PREFIX}acc-bb`,
      costCenterId: `${PREFIX}cc-operacao`,
    });

    pushPaid({
      type: "RECEIVABLE",
      description: "Gestão de tráfego — Plastlima Parnaíba",
      amount: vary(reais(4_200 * growth), monthIndex + 20),
      dueDate: dateAt(offset, 10),
      paidAt: dateAt(offset, 12),
      categoryId: `${PREFIX}cat-trafego`,
      contactId: `${PREFIX}con-parnaiba`,
      accountId: `${PREFIX}acc-inter`,
      costCenterId: `${PREFIX}cc-comercial`,
    });

    pushPaid({
      type: "RECEIVABLE",
      description: "Projeto sob demanda — Duas Caras Studio",
      amount: vary(reais(6_000 * growth), monthIndex + 40, 0.4),
      dueDate: dateAt(offset, 20),
      paidAt: dateAt(offset, 22),
      categoryId: `${PREFIX}cat-projetos`,
      contactId: `${PREFIX}con-duascaras`,
      accountId: `${PREFIX}acc-bb`,
      costCenterId: `${PREFIX}cc-produto`,
    });

    pushPaid({
      type: "PAYABLE",
      description: "Folha de pagamento",
      amount: vary(reais(7_800), monthIndex + 60, 0.06),
      dueDate: dateAt(offset, 5),
      paidAt: dateAt(offset, 5),
      categoryId: `${PREFIX}cat-folha`,
      contactId: `${PREFIX}con-contabilidade`,
      accountId: `${PREFIX}acc-bb`,
      costCenterId: `${PREFIX}cc-operacao`,
    });

    pushPaid({
      type: "PAYABLE",
      description: "Aluguel do escritório",
      amount: reais(2_400),
      paidAmount: reais(2_400),
      dueDate: dateAt(offset, 10),
      paidAt: dateAt(offset, 9),
      categoryId: `${PREFIX}cat-aluguel`,
      contactId: `${PREFIX}con-imobiliaria`,
      accountId: `${PREFIX}acc-bb`,
      costCenterId: `${PREFIX}cc-operacao`,
    });

    entries.push({
      id: nextId(),
      type: "PAYABLE",
      status: "PAID",
      description: "Verba de anúncios — Meta Ads",
      amount: vary(reais(3_500 * growth), monthIndex + 80, 0.3),
      dueDate: dateAt(offset, 15),
      paidAt: dateAt(offset, 15),
      categoryId: `${PREFIX}cat-anuncios`,
      contactId: `${PREFIX}con-meta`,
      accountId: `${PREFIX}acc-inter`,
      costCenterId: `${PREFIX}cc-comercial`,
    });

    pushPaid({
      type: "PAYABLE",
      description: "Infraestrutura — Vercel",
      amount: vary(reais(680), monthIndex + 100, 0.15),
      dueDate: dateAt(offset, 18),
      paidAt: dateAt(offset, 18),
      categoryId: `${PREFIX}cat-infra`,
      contactId: `${PREFIX}con-vercel`,
      accountId: `${PREFIX}acc-inter`,
      costCenterId: `${PREFIX}cc-produto`,
    });

    pushPaid({
      type: "PAYABLE",
      description: "Impostos (Simples Nacional)",
      amount: vary(reais(2_100 * growth), monthIndex + 120, 0.1),
      dueDate: dateAt(offset, 20),
      paidAt: dateAt(offset, 20),
      categoryId: `${PREFIX}cat-impostos`,
      contactId: `${PREFIX}con-contabilidade`,
      accountId: `${PREFIX}acc-bb`,
      costCenterId: `${PREFIX}cc-operacao`,
    });
  }

  // ── 5b. Mês corrente: pago, pendente e parcial ─────────────────────────
  entries.push(
    {
      id: nextId(),
      type: "RECEIVABLE",
      status: "PAID",
      description: "Mensalidade — Plastlima Esperantina",
      amount: reais(11_900),
      paidAmount: reais(11_900),
      dueDate: dateAt(0, 5),
      paidAt: dateAt(0, 5),
      categoryId: `${PREFIX}cat-mensalidade`,
      contactId: `${PREFIX}con-plastlima`,
      accountId: `${PREFIX}acc-bb`,
      costCenterId: `${PREFIX}cc-operacao`,
    },
    {
      id: nextId(),
      type: "RECEIVABLE",
      status: "PARTIAL",
      description: "Projeto e-commerce — Duas Caras Studio",
      amount: reais(9_000),
      paidAmount: reais(3_600),
      dueDate: dateAt(0, 18),
      paidAt: dateAt(0, 12),
      categoryId: `${PREFIX}cat-projetos`,
      contactId: `${PREFIX}con-duascaras`,
      accountId: `${PREFIX}acc-bb`,
      costCenterId: `${PREFIX}cc-produto`,
      documentNumber: "NF-2026-0841",
    },
    {
      id: nextId(),
      type: "RECEIVABLE",
      status: "PENDING",
      description: "Gestão de tráfego — Plastlima Piripiri",
      amount: reais(3_800),
      dueDate: dateAt(0, 28),
      categoryId: `${PREFIX}cat-trafego`,
      contactId: `${PREFIX}con-piripiri`,
      accountId: `${PREFIX}acc-inter`,
      costCenterId: `${PREFIX}cc-comercial`,
    },
    {
      id: nextId(),
      type: "PAYABLE",
      status: "PAID",
      description: "Folha de pagamento",
      amount: reais(8_200),
      paidAmount: reais(8_200),
      dueDate: dateAt(0, 5),
      paidAt: dateAt(0, 5),
      categoryId: `${PREFIX}cat-folha`,
      contactId: `${PREFIX}con-contabilidade`,
      accountId: `${PREFIX}acc-bb`,
      costCenterId: `${PREFIX}cc-operacao`,
    },
    {
      id: nextId(),
      type: "PAYABLE",
      status: "PENDING",
      description: "Verba de anúncios — Meta Ads",
      amount: reais(5_200),
      dueDate: dateAt(0, 25),
      categoryId: `${PREFIX}cat-anuncios`,
      contactId: `${PREFIX}con-meta`,
      accountId: `${PREFIX}acc-inter`,
      costCenterId: `${PREFIX}cc-comercial`,
    },
  );

  // ── 5c. Vencidos em aberto — a projeção joga tudo no mês 1 (RF-7) ──────
  entries.push(
    {
      id: nextId(),
      type: "RECEIVABLE",
      status: "OVERDUE",
      description: "Mensalidade atrasada — Plastlima Piripiri",
      amount: reais(3_400),
      dueDate: dateAt(-1, 15),
      categoryId: `${PREFIX}cat-mensalidade`,
      contactId: `${PREFIX}con-piripiri`,
      accountId: `${PREFIX}acc-bb`,
      costCenterId: `${PREFIX}cc-operacao`,
    },
    {
      id: nextId(),
      type: "PAYABLE",
      status: "OVERDUE",
      description: "Honorários contábeis (2 competências)",
      amount: reais(1_800),
      dueDate: dateAt(-1, 20),
      categoryId: `${PREFIX}cat-impostos`,
      contactId: `${PREFIX}con-contabilidade`,
      accountId: `${PREFIX}acc-bb`,
      costCenterId: `${PREFIX}cc-operacao`,
    },
  );

  // ── 5d. Compromissos futuros — o "firme" da projeção ───────────────────
  for (let offset = 1; offset <= FUTURE_MONTHS; offset++) {
    entries.push({
      id: nextId(),
      type: "RECEIVABLE",
      status: "PENDING",
      description: "Mensalidade — Plastlima Esperantina",
      amount: reais(11_900),
      dueDate: dateAt(offset, 5),
      categoryId: `${PREFIX}cat-mensalidade`,
      contactId: `${PREFIX}con-plastlima`,
      accountId: `${PREFIX}acc-bb`,
      costCenterId: `${PREFIX}cc-operacao`,
    });

    entries.push({
      id: nextId(),
      type: "PAYABLE",
      status: "PENDING",
      description: "Aluguel do escritório",
      amount: reais(2_400),
      dueDate: dateAt(offset, 10),
      categoryId: `${PREFIX}cat-aluguel`,
      contactId: `${PREFIX}con-imobiliaria`,
      accountId: `${PREFIX}acc-bb`,
      costCenterId: `${PREFIX}cc-operacao`,
    });
  }

  // Parcelamento em 6x de um equipamento — exercita installmentGroupId e
  // aparece atravessando todo o horizonte da projeção.
  const installmentGroupId = `${PREFIX}grupo-equipamento`;
  for (let parcela = 1; parcela <= 6; parcela++) {
    entries.push({
      id: nextId(),
      type: "PAYABLE",
      status: "PENDING",
      description: `Equipamento de estúdio (${parcela}/6)`,
      amount: reais(1_450),
      dueDate: dateAt(parcela, 12),
      categoryId: `${PREFIX}cat-infra`,
      contactId: `${PREFIX}con-vercel`,
      accountId: `${PREFIX}acc-inter`,
      costCenterId: `${PREFIX}cc-produto`,
      installmentTotal: 6,
      installmentCurrent: parcela,
      installmentGroupId,
    });
  }

  // Saída grande e pontual — cria o "vale" no gráfico da projeção, que é o
  // caso que a tela precisa saber mostrar (CA-8).
  entries.push({
    id: nextId(),
    type: "PAYABLE",
    status: "PENDING_APPROVAL",
    description: "Renovação anual de licenças de software",
    amount: reais(28_000),
    dueDate: dateAt(4, 15),
    categoryId: `${PREFIX}cat-software`,
    contactId: `${PREFIX}con-vercel`,
    accountId: `${PREFIX}acc-bb`,
    costCenterId: `${PREFIX}cc-produto`,
    documentNumber: "PROP-2026-114",
  });

  // Entrada grande contratada — contrapeso da saída acima.
  entries.push({
    id: nextId(),
    type: "RECEIVABLE",
    status: "PENDING",
    description: "Projeto anual — Plastlima (rede completa)",
    amount: reais(36_000),
    dueDate: dateAt(3, 20),
    categoryId: `${PREFIX}cat-projetos`,
    contactId: `${PREFIX}con-plastlima`,
    accountId: `${PREFIX}acc-bb`,
    costCenterId: `${PREFIX}cc-comercial`,
    documentNumber: "CTR-2026-0009",
  });

  for (const entry of entries) {
    const { paidAmount, paidAt, ...rest } = entry;
    await prisma.paymentEntry.create({
      data: {
        ...rest,
        organizationId: ORG_ID,
        createdById: OWNER_ID,
        paidAmount: paidAmount ?? 0,
        paidAt: paidAt ?? null,
        competenceDate: entry.dueDate,
      },
    });
  }

  const paidCount = entries.filter((entry) => entry.status === "PAID").length;
  const futureCount = entries.filter((entry) => entry.dueDate > now).length;
  console.log(
    `✔ ${entries.length} lançamentos — ${paidCount} pagos (histórico), ${futureCount} futuros (projeção)`,
  );

  // ── Resumo ─────────────────────────────────────────────────────────────
  const receivableOpen = entries
    .filter((entry) => entry.type === "RECEIVABLE" && entry.status !== "PAID")
    .reduce((total, entry) => total + entry.amount - (entry.paidAmount ?? 0), 0);
  const payableOpen = entries
    .filter((entry) => entry.type === "PAYABLE" && entry.status !== "PAID")
    .reduce((total, entry) => total + entry.amount - (entry.paidAmount ?? 0), 0);

  const brl = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  console.log("\n── Resumo ──────────────────────────────────────────────");
  console.log(`saldo em conta:      ${brl(openingBalance)}`);
  console.log(`a receber em aberto: ${brl(receivableOpen)}`);
  console.log(`a pagar em aberto:   ${brl(payableOpen)}`);
  console.log(`histórico:           ${HISTORY_MONTHS} meses fechados`);

  // ── Autoverificação: roda a projeção sobre o que acabou de ser gravado ──
  // Sem isto, "o seed rodou" não diz se os dados de fato produzem uma
  // projeção com sentido — que é o motivo de o seed existir.
  const persisted = await prisma.paymentEntry.findMany({
    where: { organizationId: ORG_ID, status: { not: "CANCELLED" } },
    select: { type: true, status: true, amount: true, paidAmount: true, dueDate: true, paidAt: true },
  });
  const projection = buildProjection({
    entries: persisted,
    openingBalance,
    horizonMonths: 6,
    trendWindowMonths: 6,
    today: now,
  });

  console.log("\n── Projeção resultante (6 meses) ───────────────────────");
  console.log(
    `média histórica: entrada ${brl(projection.monthlyAverageIn)} / saída ${brl(projection.monthlyAverageOut)}` +
    `  |  base válida: ${projection.hasTrendBasis ? "sim" : "não"}`,
  );
  console.log("mês        entradas         saídas         saldo projetado   confiança");
  for (const month of projection.months) {
    const totalIn = month.committedIn + month.estimatedIn;
    const totalOut = month.committedOut + month.estimatedOut;
    console.log(
      month.label.padEnd(9) +
      brl(totalIn).padStart(13) +
      brl(totalOut).padStart(15) +
      brl(month.projectedBalance).padStart(19) +
      `${Math.round(month.confidence * 100)}%`.padStart(11),
    );
  }
  const lowest = projection.months.reduce((a, b) => (b.projectedBalance < a.projectedBalance ? b : a));
  console.log(`menor saldo: ${brl(lowest.projectedBalance)} em ${lowest.label}`);

  console.log("\nAbra /payment → aba Projeção pra ver o resultado.");
}

main()
  .catch((error) => {
    console.error("Seed falhou:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
