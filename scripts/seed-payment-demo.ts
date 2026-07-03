/**
 * Seed idempotente do NASA Payment pra org Metropolis (Duas-Caras).
 * Popula: 3 contas bancárias, 8 categorias, 6 contatos e ~30 lançamentos
 * variados — alguns pagos, outros pendentes, vencidos e futuros — pra o
 * dashboard mostrar KPIs, gráficos e drill-downs com dados reais.
 *
 * Uso: pnpm dlx tsx scripts/seed-payment-demo.ts
 */
import { config } from "dotenv";
const externalDbUrl = process.env.DATABASE_URL;
config({ path: ".env" });
config({ path: ".env.local", override: true });
if (externalDbUrl) process.env.DATABASE_URL = externalDbUrl;

import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any);

const ORG_ID = "BlpVqU3raj0n7KWIoBpH1hCWeUt461hJ"; // Metropolis
const OWNER_ID = "9ce0d7aa-c18a-49d3-9dec-7fd7526fb185"; // Duas-Caras

// Helpers de data
const now = new Date();
const YEAR = now.getFullYear();
const MONTH = now.getMonth(); // 0-based
function d(year: number, month0: number, day: number): Date {
  return new Date(year, month0, day, 12, 0, 0, 0);
}
function todayPlus(days: number): Date {
  const t = new Date(now);
  t.setDate(t.getDate() + days);
  t.setHours(12, 0, 0, 0);
  return t;
}
function reais(value: number): number {
  return Math.round(value * 100);
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("💰 Seed Payment (Metropolis)\n");

  // 1. Contas bancárias ───────────────────────────────────────────────────
  const accounts = [
    {
      id: "seed-acc-itau",
      name: "Itaú Empresarial",
      bankName: "Itaú",
      bankCode: "341",
      agency: "0001",
      account: "12345-6",
      type: "CHECKING" as const,
      balance: reais(45000),
      isDefault: true,
      color: "#EC7000",
    },
    {
      id: "seed-acc-nubank",
      name: "Nubank PJ",
      bankName: "Nubank",
      bankCode: "260",
      agency: "0001",
      account: "98765-4",
      type: "DIGITAL" as const,
      balance: reais(12500),
      isDefault: false,
      color: "#8A05BE",
    },
    {
      id: "seed-acc-caixa",
      name: "Caixa Reserva",
      bankName: "Caixa Econômica",
      bankCode: "104",
      agency: "0033",
      account: "44321-0",
      type: "SAVINGS" as const,
      balance: reais(80000),
      isDefault: false,
      color: "#005CA9",
    },
  ];
  for (const acc of accounts) {
    await prisma.paymentBankAccount.upsert({
      where: { id: acc.id },
      create: { ...acc, organizationId: ORG_ID },
      update: acc,
    });
  }
  console.log(`✔ ${accounts.length} contas bancárias`);

  // 2. Categorias ─────────────────────────────────────────────────────────
  const categories = [
    { id: "seed-cat-vendas", name: "Vendas", type: "REVENUE" as const, color: "#22C55E", icon: "💰" },
    { id: "seed-cat-servicos", name: "Serviços", type: "REVENUE" as const, color: "#10B981", icon: "🔧" },
    { id: "seed-cat-consultoria", name: "Consultoria", type: "REVENUE" as const, color: "#059669", icon: "📊" },
    { id: "seed-cat-folha", name: "Folha de Pagamento", type: "EXPENSE" as const, color: "#EF4444", icon: "👥" },
    { id: "seed-cat-aluguel", name: "Aluguel", type: "EXPENSE" as const, color: "#F97316", icon: "🏢" },
    { id: "seed-cat-marketing", name: "Marketing", type: "EXPENSE" as const, color: "#EAB308", icon: "📣" },
    { id: "seed-cat-fornecedores", name: "Fornecedores", type: "COST" as const, color: "#A855F7", icon: "📦" },
    { id: "seed-cat-impostos", name: "Impostos", type: "EXPENSE" as const, color: "#DC2626", icon: "🧾" },
  ];
  for (const cat of categories) {
    await prisma.paymentCategory.upsert({
      where: { id: cat.id },
      create: { ...cat, organizationId: ORG_ID },
      update: cat,
    });
  }
  console.log(`✔ ${categories.length} categorias`);

  // 3. Contatos ───────────────────────────────────────────────────────────
  const contacts = [
    {
      id: "seed-con-wayne",
      name: "Wayne Enterprises",
      document: "12.345.678/0001-90",
      email: "financeiro@wayne.com",
      phone: "5511988887777",
      contactType: "CUSTOMER",
      creditLimit: reais(100000),
    },
    {
      id: "seed-con-lex",
      name: "LexCorp",
      document: "23.456.789/0001-01",
      email: "contato@lexcorp.com",
      phone: "5511977776666",
      contactType: "CUSTOMER",
      creditLimit: reais(50000),
    },
    {
      id: "seed-con-daily",
      name: "Daily Planet",
      document: "34.567.890/0001-12",
      email: "billing@dailyplanet.com",
      phone: "5511966665555",
      contactType: "CUSTOMER",
      creditLimit: reais(20000),
    },
    {
      id: "seed-con-acme",
      name: "ACME Supplies",
      document: "45.678.901/0001-23",
      email: "vendas@acme.com",
      phone: "5511955554444",
      contactType: "SUPPLIER",
      creditLimit: reais(0),
    },
    {
      id: "seed-con-luthor",
      name: "Luthor Consultoria",
      document: "56.789.012/0001-34",
      email: "faturamento@luthor.com",
      phone: "5511944443333",
      contactType: "SUPPLIER",
      creditLimit: reais(0),
    },
    {
      id: "seed-con-prf",
      name: "Prefeitura de Metropolis",
      document: "67.890.123/0001-45",
      email: "iss@metropolis.gov",
      phone: null,
      contactType: "SUPPLIER",
      creditLimit: reais(0),
    },
  ];
  for (const contact of contacts) {
    await prisma.paymentContact.upsert({
      where: { id: contact.id },
      create: { ...contact, organizationId: ORG_ID },
      update: contact,
    });
  }
  console.log(`✔ ${contacts.length} contatos`);

  // 4. Lançamentos ─────────────────────────────────────────────────────────
  // Limpa entries antigos com prefixo seed pra reset limpo
  await prisma.paymentEntry.deleteMany({
    where: { organizationId: ORG_ID, id: { startsWith: "seed-ent-" } },
  });

  type EntrySeed = {
    id: string;
    type: "RECEIVABLE" | "PAYABLE";
    status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
    description: string;
    amount: number; // centavos
    paidAmount?: number;
    dueDate: Date;
    paidAt?: Date;
    categoryId: string;
    contactId: string;
    accountId: string;
  };

  const entries: EntrySeed[] = [
    // ── PAGAS no mês atual (viram "Recebido" e "Pago") ────────────────────
    {
      id: "seed-ent-01",
      type: "RECEIVABLE",
      status: "PAID",
      description: "Venda de licenças SaaS — Wayne Enterprises",
      amount: reais(15000),
      paidAmount: reais(15000),
      dueDate: d(YEAR, MONTH, 5),
      paidAt: d(YEAR, MONTH, 5),
      categoryId: "seed-cat-vendas",
      contactId: "seed-con-wayne",
      accountId: "seed-acc-itau",
    },
    {
      id: "seed-ent-02",
      type: "RECEIVABLE",
      status: "PAID",
      description: "Consultoria estratégica — LexCorp",
      amount: reais(8500),
      paidAmount: reais(8500),
      dueDate: d(YEAR, MONTH, 10),
      paidAt: d(YEAR, MONTH, 10),
      categoryId: "seed-cat-consultoria",
      contactId: "seed-con-lex",
      accountId: "seed-acc-nubank",
    },
    {
      id: "seed-ent-03",
      type: "RECEIVABLE",
      status: "PARTIAL",
      description: "Manutenção mensal — Daily Planet",
      amount: reais(3500),
      paidAmount: reais(1750),
      dueDate: d(YEAR, MONTH, 8),
      paidAt: d(YEAR, MONTH, 8),
      categoryId: "seed-cat-servicos",
      contactId: "seed-con-daily",
      accountId: "seed-acc-itau",
    },
    // ── A RECEBER no mês (PENDING) ────────────────────────────────────────
    {
      id: "seed-ent-04",
      type: "RECEIVABLE",
      status: "PENDING",
      description: "Projeto de integração — Wayne Enterprises",
      amount: reais(22000),
      dueDate: todayPlus(3),
      categoryId: "seed-cat-servicos",
      contactId: "seed-con-wayne",
      accountId: "seed-acc-itau",
    },
    {
      id: "seed-ent-05",
      type: "RECEIVABLE",
      status: "PENDING",
      description: "Consultoria — LexCorp (2ª parcela)",
      amount: reais(8500),
      dueDate: todayPlus(5),
      categoryId: "seed-cat-consultoria",
      contactId: "seed-con-lex",
      accountId: "seed-acc-nubank",
    },
    {
      id: "seed-ent-06",
      type: "RECEIVABLE",
      status: "PENDING",
      description: "Assinatura anual — Daily Planet",
      amount: reais(12000),
      dueDate: todayPlus(12),
      categoryId: "seed-cat-vendas",
      contactId: "seed-con-daily",
      accountId: "seed-acc-itau",
    },
    {
      id: "seed-ent-07",
      type: "RECEIVABLE",
      status: "PENDING",
      description: "Serviço de suporte — Wayne Enterprises",
      amount: reais(4500),
      dueDate: todayPlus(20),
      categoryId: "seed-cat-servicos",
      contactId: "seed-con-wayne",
      accountId: "seed-acc-itau",
    },
    // ── VENCIDAS (Inadimplência) ──────────────────────────────────────────
    {
      id: "seed-ent-08",
      type: "RECEIVABLE",
      status: "OVERDUE",
      description: "Consultoria atrasada — LexCorp",
      amount: reais(6000),
      dueDate: todayPlus(-15),
      categoryId: "seed-cat-consultoria",
      contactId: "seed-con-lex",
      accountId: "seed-acc-itau",
    },
    {
      id: "seed-ent-09",
      type: "RECEIVABLE",
      status: "OVERDUE",
      description: "Suporte — Daily Planet",
      amount: reais(2200),
      dueDate: todayPlus(-30),
      categoryId: "seed-cat-servicos",
      contactId: "seed-con-daily",
      accountId: "seed-acc-nubank",
    },
    {
      id: "seed-ent-10",
      type: "RECEIVABLE",
      status: "OVERDUE",
      description: "Nota antiga — Wayne Enterprises",
      amount: reais(3800),
      dueDate: todayPlus(-8),
      categoryId: "seed-cat-vendas",
      contactId: "seed-con-wayne",
      accountId: "seed-acc-itau",
    },
    // ── PAGAS (contas já quitadas no mês) ─────────────────────────────────
    {
      id: "seed-ent-11",
      type: "PAYABLE",
      status: "PAID",
      description: "Folha de pagamento — mês corrente",
      amount: reais(24000),
      paidAmount: reais(24000),
      dueDate: d(YEAR, MONTH, 5),
      paidAt: d(YEAR, MONTH, 5),
      categoryId: "seed-cat-folha",
      contactId: "seed-con-acme",
      accountId: "seed-acc-itau",
    },
    {
      id: "seed-ent-12",
      type: "PAYABLE",
      status: "PAID",
      description: "Aluguel do escritório",
      amount: reais(8500),
      paidAmount: reais(8500),
      dueDate: d(YEAR, MONTH, 5),
      paidAt: d(YEAR, MONTH, 5),
      categoryId: "seed-cat-aluguel",
      contactId: "seed-con-luthor",
      accountId: "seed-acc-itau",
    },
    {
      id: "seed-ent-13",
      type: "PAYABLE",
      status: "PAID",
      description: "Google Ads — campanha do mês",
      amount: reais(3200),
      paidAmount: reais(3200),
      dueDate: d(YEAR, MONTH, 10),
      paidAt: d(YEAR, MONTH, 10),
      categoryId: "seed-cat-marketing",
      contactId: "seed-con-acme",
      accountId: "seed-acc-nubank",
    },
    // ── A PAGAR no mês (PENDING) ──────────────────────────────────────────
    {
      id: "seed-ent-14",
      type: "PAYABLE",
      status: "PENDING",
      description: "ISS — Prefeitura Metropolis",
      amount: reais(1800),
      dueDate: todayPlus(2),
      categoryId: "seed-cat-impostos",
      contactId: "seed-con-prf",
      accountId: "seed-acc-itau",
    },
    {
      id: "seed-ent-15",
      type: "PAYABLE",
      status: "PENDING",
      description: "Suprimentos escritório",
      amount: reais(1450),
      dueDate: todayPlus(4),
      categoryId: "seed-cat-fornecedores",
      contactId: "seed-con-acme",
      accountId: "seed-acc-nubank",
    },
    {
      id: "seed-ent-16",
      type: "PAYABLE",
      status: "PENDING",
      description: "Facebook Ads — próxima campanha",
      amount: reais(4200),
      dueDate: todayPlus(9),
      categoryId: "seed-cat-marketing",
      contactId: "seed-con-acme",
      accountId: "seed-acc-nubank",
    },
    {
      id: "seed-ent-17",
      type: "PAYABLE",
      status: "PENDING",
      description: "Consultoria jurídica",
      amount: reais(5500),
      dueDate: todayPlus(15),
      categoryId: "seed-cat-fornecedores",
      contactId: "seed-con-luthor",
      accountId: "seed-acc-itau",
    },
    {
      id: "seed-ent-18",
      type: "PAYABLE",
      status: "PENDING",
      description: "Software SaaS — assinatura anual",
      amount: reais(9800),
      dueDate: todayPlus(22),
      categoryId: "seed-cat-fornecedores",
      contactId: "seed-con-acme",
      accountId: "seed-acc-nubank",
    },
    // ── VENCIDAS a pagar (aparecem como OVERDUE) ──────────────────────────
    {
      id: "seed-ent-19",
      type: "PAYABLE",
      status: "OVERDUE",
      description: "Fornecedor atrasado — ACME",
      amount: reais(3300),
      dueDate: todayPlus(-6),
      categoryId: "seed-cat-fornecedores",
      contactId: "seed-con-acme",
      accountId: "seed-acc-itau",
    },
    {
      id: "seed-ent-20",
      type: "PAYABLE",
      status: "OVERDUE",
      description: "INSS folha — mês anterior",
      amount: reais(6100),
      dueDate: todayPlus(-3),
      categoryId: "seed-cat-impostos",
      contactId: "seed-con-prf",
      accountId: "seed-acc-itau",
    },
    // ── PRÓX. 7 DIAS (uma extra pra ver o KPI variar) ────────────────────
    {
      id: "seed-ent-21",
      type: "RECEIVABLE",
      status: "PENDING",
      description: "Cobrança pontual — LexCorp",
      amount: reais(1900),
      dueDate: todayPlus(6),
      categoryId: "seed-cat-vendas",
      contactId: "seed-con-lex",
      accountId: "seed-acc-itau",
    },
    // ── PRÓX. 30 DIAS (algumas parcelas futuras) ─────────────────────────
    {
      id: "seed-ent-22",
      type: "PAYABLE",
      status: "PENDING",
      description: "Aluguel — próximo mês",
      amount: reais(8500),
      dueDate: todayPlus(28),
      categoryId: "seed-cat-aluguel",
      contactId: "seed-con-luthor",
      accountId: "seed-acc-itau",
    },
    {
      id: "seed-ent-23",
      type: "PAYABLE",
      status: "PENDING",
      description: "Folha — próximo mês",
      amount: reais(24000),
      dueDate: todayPlus(30),
      categoryId: "seed-cat-folha",
      contactId: "seed-con-acme",
      accountId: "seed-acc-itau",
    },
    {
      id: "seed-ent-24",
      type: "RECEIVABLE",
      status: "PENDING",
      description: "Contrato mensal — Wayne (próximo ciclo)",
      amount: reais(15000),
      dueDate: todayPlus(25),
      categoryId: "seed-cat-servicos",
      contactId: "seed-con-wayne",
      accountId: "seed-acc-itau",
    },
    // ── HISTÓRICO nos últimos meses (pra gráfico Receitas x Despesas) ────
    ...[1, 2, 3, 4, 5].flatMap((offset) => {
      const past = new Date(YEAR, MONTH - offset, 15);
      return [
        {
          id: `seed-ent-hist-r-${offset}`,
          type: "RECEIVABLE" as const,
          status: "PAID" as const,
          description: `Receita histórica ${offset}m atrás`,
          amount: reais(20000 + offset * 1500),
          paidAmount: reais(20000 + offset * 1500),
          dueDate: past,
          paidAt: past,
          categoryId: "seed-cat-vendas",
          contactId: "seed-con-wayne",
          accountId: "seed-acc-itau",
        },
        {
          id: `seed-ent-hist-p-${offset}`,
          type: "PAYABLE" as const,
          status: "PAID" as const,
          description: `Despesa histórica ${offset}m atrás`,
          amount: reais(14000 + offset * 800),
          paidAmount: reais(14000 + offset * 800),
          dueDate: past,
          paidAt: past,
          categoryId: "seed-cat-folha",
          contactId: "seed-con-acme",
          accountId: "seed-acc-itau",
        },
      ];
    }),
  ];

  for (const entry of entries) {
    await prisma.paymentEntry.create({
      data: {
        id: entry.id,
        organizationId: ORG_ID,
        type: entry.type,
        status: entry.status,
        description: entry.description,
        amount: entry.amount,
        paidAmount: entry.paidAmount ?? 0,
        dueDate: entry.dueDate,
        paidAt: entry.paidAt ?? null,
        categoryId: entry.categoryId,
        contactId: entry.contactId,
        accountId: entry.accountId,
        createdById: OWNER_ID,
        isRecurring: false,
      },
    });
  }
  console.log(`✔ ${entries.length} lançamentos criados\n`);

  const summary = await prisma.paymentEntry.groupBy({
    by: ["type", "status"],
    where: { organizationId: ORG_ID },
    _count: true,
    _sum: { amount: true },
  });
  console.log("Resumo:");
  for (const row of summary) {
    const value = ((row._sum.amount ?? 0) / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    console.log(`  ${row.type} / ${row.status}: ${row._count} → ${value}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
