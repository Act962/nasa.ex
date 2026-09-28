/**
 * Seed do NASA Payment para a org "João Gabriel" (slug `joao-gabriel`).
 *
 * Objetivo: dar volume suficiente para testar a paginação, a busca e os
 * somatórios agregados das abas Receita e Despesa. A página é de 25 itens,
 * então cada tipo recebe registros o bastante para render várias páginas.
 *
 * O que o volume exercita:
 *   - paginação nas abas Receita e Despesa (várias páginas por tipo);
 *   - busca por descrição, contato, documento e categoria;
 *   - "Buscar em todo o histórico" — parte dos lançamentos cai fora do mês
 *     corrente, então só aparecem com o filtro de período estendido;
 *   - "Total pendente" / "Total do filtro", que agora somam o filtro inteiro
 *     e não a página;
 *   - datas de vencimento no dia 1 e no último dia do mês, que é onde o bug
 *     de fuso aparecia (o lançamento caía no dia anterior);
 *   - parcelamento a partir do dia 31, que transbordava de mês.
 *
 * Idempotente: tudo nasce com o prefixo `jg-seed-` e é apagado antes de
 * recriar. Rodar duas vezes não duplica, e os lançamentos que já existiam na
 * org (sem o prefixo) não são tocados.
 *
 * Uso:
 *   pnpm exec tsx scripts/seed-payment-joao-gabriel.ts
 *   pnpm exec tsx scripts/seed-payment-joao-gabriel.ts --clean   (só remove)
 */
import { config } from "dotenv";

const externalDbUrl = process.env.DATABASE_URL;
config({ path: ".env" });
config({ path: ".env.local", override: true });
if (externalDbUrl) process.env.DATABASE_URL = externalDbUrl;

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any);

const ORG_ID = "hMxVF4NVlrD6zuM1M6vhjJTchSeIfyd8"; // João Gabriel (joao-gabriel)
const OWNER_ID = "UYvcc2Wn6SnlbtAuD6LotHDAm6tZt03y"; // joaogabriel9633@gmail.com
const PREFIX = "jg-seed-";

const RECEIVABLES_CURRENT_MONTH = 70;
const PAYABLES_CURRENT_MONTH = 70;
/** Meses anteriores com lançamentos, para testar a busca fora do período. */
const HISTORY_MONTHS = 4;
const PER_HISTORY_MONTH = 12;

const now = new Date();
const YEAR = now.getFullYear();
const MONTH = now.getMonth();

/**
 * Data de vencimento ao meio-dia UTC — o mesmo formato que a aplicação grava
 * depois da correção de fuso. Gravar em horário local aqui reintroduziria o
 * off-by-one justamente nos dados de teste.
 */
function dueDateAt(monthOffset: number, day: number): Date {
  const lastDay = new Date(Date.UTC(YEAR, MONTH + monthOffset + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(YEAR, MONTH + monthOffset, Math.min(day, lastDay), 12, 0, 0, 0),
  );
}

function reais(value: number): number {
  return Math.round(value * 100);
}

/**
 * Ruído determinístico em [-1, 1]. Com `Math.random` cada execução geraria
 * valores diferentes e "o total mudou" deixaria de distinguir mudança de
 * código de mudança de seed.
 */
function wobble(seed: number): number {
  return (Math.sin(seed * 12.9898) * 43758.5453) % 1;
}

function vary(base: number, seed: number, spread = 0.35): number {
  return Math.max(reais(10), Math.round(base * (1 + wobble(seed) * spread)));
}

function pick<T>(items: readonly T[], seed: number): T {
  const index = Math.abs(Math.round(wobble(seed) * 1000)) % items.length;
  return items[index]!;
}

// ── Catálogos ──────────────────────────────────────────────────────────────

interface CategorySeed {
  slug: string;
  name: string;
  color: string;
}

interface ContactSeed {
  slug: string;
  name: string;
  document: string;
}

const REVENUE_CATEGORIES: readonly CategorySeed[] = [
  { slug: "mensalidade", name: "Mensalidade", color: "#22C55E" },
  { slug: "consultoria", name: "Consultoria", color: "#3B82F6" },
  { slug: "trafego-pago", name: "Tráfego Pago", color: "#A855F7" },
  { slug: "infoproduto", name: "Infoproduto", color: "#F59E0B" },
  { slug: "manutencao", name: "Manutenção", color: "#06B6D4" },
] as const;

const EXPENSE_CATEGORIES: readonly CategorySeed[] = [
  { slug: "folha", name: "Folha de Pagamento", color: "#EF4444" },
  { slug: "ferramentas", name: "Ferramentas e SaaS", color: "#8B5CF6" },
  { slug: "infra", name: "Infraestrutura", color: "#0EA5E9" },
  { slug: "marketing", name: "Marketing", color: "#EC4899" },
  { slug: "administrativo", name: "Administrativo", color: "#64748B" },
  { slug: "impostos", name: "Impostos", color: "#F97316" },
] as const;

const CUSTOMERS: readonly ContactSeed[] = [
  { slug: "padaria-estrela", name: "Padaria Estrela do Norte", document: "12.345.678/0001-90" },
  { slug: "clinica-vida", name: "Clínica Vida Plena", document: "23.456.789/0001-01" },
  { slug: "auto-pecas-silva", name: "Auto Peças Silva", document: "34.567.890/0001-12" },
  { slug: "escola-horizonte", name: "Escola Horizonte", document: "45.678.901/0001-23" },
  { slug: "mercado-bom-preco", name: "Mercado Bom Preço", document: "56.789.012/0001-34" },
  { slug: "studio-pilates", name: "Studio Pilates Corpo Livre", document: "67.890.123/0001-45" },
  { slug: "adv-associados", name: "Andrade Advogados Associados", document: "78.901.234/0001-56" },
  { slug: "pet-shop-amigo", name: "Pet Shop Melhor Amigo", document: "89.012.345/0001-67" },
] as const;

const SUPPLIERS: readonly ContactSeed[] = [
  { slug: "cloud-brasil", name: "Cloud Brasil Hospedagem", document: "90.123.456/0001-78" },
  { slug: "contabil-precisa", name: "Contábil Precisa", document: "01.234.567/0001-89" },
  { slug: "papelaria-central", name: "Papelaria Central", document: "11.222.333/0001-44" },
  { slug: "energia-luz", name: "Companhia de Energia", document: "22.333.444/0001-55" },
  { slug: "telecom-fibra", name: "Telecom Fibra Óptica", document: "33.444.555/0001-66" },
  { slug: "agencia-criativa", name: "Agência Criativa Parceira", document: "44.555.666/0001-77" },
] as const;

const REVENUE_DESCRIPTIONS = [
  "Mensalidade do plano Gold",
  "Mensalidade do plano Prata",
  "Consultoria de posicionamento",
  "Gestão de tráfego pago",
  "Criação de landing page",
  "Setup de CRM",
  "Treinamento de equipe comercial",
  "Licença anual da plataforma",
  "Manutenção mensal do site",
  "Produção de conteúdo",
  "Assinatura do curso High Ticket",
  "Diagnóstico de funil",
] as const;

const EXPENSE_DESCRIPTIONS = [
  "Salário da equipe",
  "Assinatura Figma",
  "Assinatura Google Workspace",
  "Servidor de aplicação",
  "Anúncios Meta Ads",
  "Anúncios Google Ads",
  "Honorários contábeis",
  "Conta de energia",
  "Internet fibra",
  "Material de escritório",
  "Simples Nacional",
  "Freelancer de design",
] as const;

const STATUS_CYCLE = ["PENDING", "PAID", "PARTIAL", "OVERDUE", "PENDING", "PAID"] as const;
type EntryStatus = (typeof STATUS_CYCLE)[number];

interface EntrySeed {
  id: string;
  type: "RECEIVABLE" | "PAYABLE";
  description: string;
  amount: number;
  dueDate: Date;
  status: EntryStatus;
  paidAmount: number;
  paidAt: Date | null;
  categoryId: string;
  contactId: string;
  documentNumber: string;
  notes: string | null;
  installmentTotal?: number;
  installmentCurrent?: number;
  installmentGroupId?: string;
}

function buildEntry(params: {
  index: number;
  type: "RECEIVABLE" | "PAYABLE";
  monthOffset: number;
  day: number;
  baseAmount: number;
}): EntrySeed {
  const { index, type, monthOffset, day, baseAmount } = params;
  const isRevenue = type === "RECEIVABLE";

  const descriptions = isRevenue ? REVENUE_DESCRIPTIONS : EXPENSE_DESCRIPTIONS;
  const categories = isRevenue ? REVENUE_CATEGORIES : EXPENSE_CATEGORIES;
  const contacts = isRevenue ? CUSTOMERS : SUPPLIERS;

  const description = pick(descriptions, index * 1.7);
  const category = pick(categories, index * 2.3);
  const contact = pick(contacts, index * 3.1);
  const amount = vary(baseAmount, index * 4.7);

  // Lançamento futuro nunca nasce pago; passado alterna entre os status.
  const dueDate = dueDateAt(monthOffset, day);
  const isPast = dueDate.getTime() < Date.now();
  const status: EntryStatus = isPast
    ? STATUS_CYCLE[index % STATUS_CYCLE.length]!
    : "PENDING";

  const paidAmount =
    status === "PAID" ? amount : status === "PARTIAL" ? Math.round(amount * 0.4) : 0;
  const paidAt = status === "PAID" || status === "PARTIAL" ? dueDate : null;

  return {
    id: `${PREFIX}${type.toLowerCase()}-${String(index).padStart(3, "0")}`,
    type,
    description: `${description} — ${contact.name.split(" ")[0]}`,
    amount,
    dueDate,
    status,
    paidAmount,
    paidAt,
    categoryId: `${PREFIX}cat-${category.slug}`,
    contactId: `${PREFIX}contact-${contact.slug}`,
    documentNumber: `${isRevenue ? "NF" : "DOC"}-${String(1000 + index)}`,
    notes: index % 5 === 0 ? `Observação de referência ${index}` : null,
  };
}

async function removeSeed() {
  const deletedEntries = await prisma.paymentEntry.deleteMany({
    where: { organizationId: ORG_ID, id: { startsWith: PREFIX } },
  });
  const deletedContacts = await prisma.paymentContact.deleteMany({
    where: { organizationId: ORG_ID, id: { startsWith: PREFIX } },
  });
  const deletedCategories = await prisma.paymentCategory.deleteMany({
    where: { organizationId: ORG_ID, id: { startsWith: PREFIX } },
  });
  return {
    entries: deletedEntries.count,
    contacts: deletedContacts.count,
    categories: deletedCategories.count,
  };
}

async function main() {
  const cleanOnly = process.argv.includes("--clean");

  const org = await prisma.organization.findUnique({
    where: { id: ORG_ID },
    select: { name: true, slug: true },
  });
  if (!org) throw new Error(`Organização ${ORG_ID} não encontrada`);

  console.log(`\n💰 Seed Payment — org "${org.name}" (${org.slug})\n`);

  // ── Limpeza do que a execução anterior criou ─────────────────────────────
  const removed = await removeSeed();
  console.log(
    `🧹 Removido do seed anterior: ${removed.entries} lançamentos, ` +
      `${removed.contacts} contatos, ${removed.categories} categorias`,
  );

  if (cleanOnly) {
    console.log("\n✅ Limpeza concluída (--clean). Nada foi recriado.\n");
    await prisma.$disconnect();
    return;
  }

  // ── Categorias ───────────────────────────────────────────────────────────
  await prisma.paymentCategory.createMany({
    data: [
      ...REVENUE_CATEGORIES.map((category) => ({
        id: `${PREFIX}cat-${category.slug}`,
        organizationId: ORG_ID,
        name: category.name,
        type: "REVENUE" as const,
        color: category.color,
      })),
      ...EXPENSE_CATEGORIES.map((category) => ({
        id: `${PREFIX}cat-${category.slug}`,
        organizationId: ORG_ID,
        name: category.name,
        type: "EXPENSE" as const,
        color: category.color,
      })),
    ],
  });
  console.log(
    `📁 ${REVENUE_CATEGORIES.length + EXPENSE_CATEGORIES.length} categorias criadas`,
  );

  // ── Contatos ─────────────────────────────────────────────────────────────
  await prisma.paymentContact.createMany({
    data: [
      ...CUSTOMERS.map((customer) => ({
        id: `${PREFIX}contact-${customer.slug}`,
        organizationId: ORG_ID,
        name: customer.name,
        document: customer.document,
        email: `financeiro@${customer.slug}.com.br`,
        phone: "(86) 99999-0000",
        contactType: "CUSTOMER",
      })),
      ...SUPPLIERS.map((supplier) => ({
        id: `${PREFIX}contact-${supplier.slug}`,
        organizationId: ORG_ID,
        name: supplier.name,
        document: supplier.document,
        email: `contato@${supplier.slug}.com.br`,
        phone: "(86) 98888-0000",
        contactType: "SUPPLIER",
      })),
    ],
  });
  console.log(`👥 ${CUSTOMERS.length + SUPPLIERS.length} contatos criados`);

  // ── Lançamentos ──────────────────────────────────────────────────────────
  const entries: EntrySeed[] = [];

  // Mês corrente: o volume que faz a paginação aparecer nas duas abas.
  // O dia percorre 1..28 e volta, garantindo o dia 1 e o último dia do mês —
  // as bordas onde o bug de fuso se manifestava.
  for (let i = 0; i < RECEIVABLES_CURRENT_MONTH; i++) {
    entries.push(
      buildEntry({
        index: i,
        type: "RECEIVABLE",
        monthOffset: 0,
        day: (i % 28) + 1,
        baseAmount: reais(1_800),
      }),
    );
  }
  for (let i = 0; i < PAYABLES_CURRENT_MONTH; i++) {
    entries.push(
      buildEntry({
        index: i,
        type: "PAYABLE",
        monthOffset: 0,
        day: (i % 28) + 1,
        baseAmount: reais(950),
      }),
    );
  }

  // Bordas explícitas do mês: dia 1 e último dia, com descrição reconhecível.
  const lastDay = new Date(Date.UTC(YEAR, MONTH + 1, 0)).getUTCDate();
  entries.push({
    ...buildEntry({ index: 900, type: "RECEIVABLE", monthOffset: 0, day: 1, baseAmount: reais(4_200) }),
    id: `${PREFIX}borda-primeiro-dia`,
    description: "Borda — vence no primeiro dia do mês",
    status: "PENDING",
    paidAmount: 0,
    paidAt: null,
  });
  entries.push({
    ...buildEntry({ index: 901, type: "PAYABLE", monthOffset: 0, day: lastDay, baseAmount: reais(3_100) }),
    id: `${PREFIX}borda-ultimo-dia`,
    description: "Borda — vence no último dia do mês",
    status: "PENDING",
    paidAmount: 0,
    paidAt: null,
  });

  // Parcelamento nascido no dia 31: nenhuma parcela pode pular de mês.
  const installmentGroupId = `${PREFIX}grupo-parcelas`;
  const installmentTotal = 6;
  for (let i = 0; i < installmentTotal; i++) {
    const due = dueDateAt(i, 31);
    entries.push({
      id: `${PREFIX}parcela-${i + 1}`,
      type: "RECEIVABLE",
      description: `Implantação parcelada — Clínica Vida Plena (${i + 1}/${installmentTotal})`,
      amount: reais(1_500),
      dueDate: due,
      status: due.getTime() < Date.now() ? "PAID" : "PENDING",
      paidAmount: due.getTime() < Date.now() ? reais(1_500) : 0,
      paidAt: due.getTime() < Date.now() ? due : null,
      categoryId: `${PREFIX}cat-consultoria`,
      contactId: `${PREFIX}contact-clinica-vida`,
      documentNumber: `NF-9${i + 1}`,
      notes: null,
      installmentTotal,
      installmentCurrent: i + 1,
      installmentGroupId,
    });
  }

  // Meses anteriores: só aparecem com "Buscar em todo o histórico".
  for (let month = 1; month <= HISTORY_MONTHS; month++) {
    for (let i = 0; i < PER_HISTORY_MONTH; i++) {
      const index = 1000 + month * 100 + i;
      const type = i % 2 === 0 ? "RECEIVABLE" : "PAYABLE";
      entries.push(
        buildEntry({
          index,
          type,
          monthOffset: -month,
          day: (i % 28) + 1,
          baseAmount: type === "RECEIVABLE" ? reais(1_600) : reais(880),
        }),
      );
    }
  }

  await prisma.paymentEntry.createMany({
    data: entries.map((entry) => ({
      id: entry.id,
      organizationId: ORG_ID,
      createdById: OWNER_ID,
      type: entry.type,
      status: entry.status,
      description: entry.description,
      amount: entry.amount,
      paidAmount: entry.paidAmount,
      dueDate: entry.dueDate,
      paidAt: entry.paidAt,
      competenceDate: entry.dueDate,
      documentNumber: entry.documentNumber,
      notes: entry.notes,
      categoryId: entry.categoryId,
      contactId: entry.contactId,
      installmentTotal: entry.installmentTotal ?? null,
      installmentCurrent: entry.installmentCurrent ?? null,
      installmentGroupId: entry.installmentGroupId ?? null,
    })),
  });

  // ── Resumo ───────────────────────────────────────────────────────────────
  const receivables = entries.filter((entry) => entry.type === "RECEIVABLE");
  const payables = entries.filter((entry) => entry.type === "PAYABLE");
  const currentMonth = entries.filter(
    (entry) =>
      entry.dueDate.getUTCFullYear() === YEAR && entry.dueDate.getUTCMonth() === MONTH,
  );
  const PAGE_SIZE = 25;
  const receivablesThisMonth = currentMonth.filter((e) => e.type === "RECEIVABLE").length;
  const payablesThisMonth = currentMonth.filter((e) => e.type === "PAYABLE").length;

  console.log(`\n📊 ${entries.length} lançamentos criados`);
  console.log(`   Receitas: ${receivables.length}   Despesas: ${payables.length}`);
  console.log(`   No mês corrente: ${currentMonth.length}`);
  console.log(`   Fora do mês (só com "todo o histórico"): ${entries.length - currentMonth.length}`);
  console.log(
    `\n📄 Paginação esperada (${PAGE_SIZE} por página, no mês corrente):` +
      `\n   Receita: ${Math.ceil(receivablesThisMonth / PAGE_SIZE)} páginas (${receivablesThisMonth} itens)` +
      `\n   Despesa: ${Math.ceil(payablesThisMonth / PAGE_SIZE)} páginas (${payablesThisMonth} itens)`,
  );
  console.log(`\n✅ Pronto. Para desfazer: pnpm exec tsx ${process.argv[1]?.split(/[\\/]/).pop()} --clean\n`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("\n❌ Falhou:", err);
  await prisma.$disconnect();
  process.exit(1);
});
