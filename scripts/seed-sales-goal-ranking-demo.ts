/**
 * Seed de demonstração do Ranking de Metas (módulo NERP) pra org Metropolis.
 * Uso: pnpm dlx tsx scripts/seed-sales-goal-ranking-demo.ts
 *
 * Replica a planilha "Meta Julho/2026" (Armazém Carvalho) usada como
 * referência de layout, com valores de venda parciais em algumas entries
 * pra já mostrar o pódio/lista com percentuais variados.
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

const ORG_ID = "BlpVqU3raj0n7KWIoBpH1hCWeUt461hJ"; // Metropolis

const PERIOD_START = new Date("2026-07-01T00:00:00.000Z");
const PERIOD_END = new Date("2026-07-31T00:00:00.000Z");

interface SeedEntry {
  externalCode: string;
  sellerName: string;
  goalAmount: number;
  achievedAmount: number | null;
  entryKind: "SELLER" | "BUCKET";
}

interface SeedBranch {
  name: string;
  entries: SeedEntry[];
}

const BRANCHES: SeedBranch[] = [
  {
    name: "CAPITAL",
    entries: [
      { externalCode: "255", sellerName: "CELESTINO ANDERSON ROCHA GOMES", goalAmount: 280000, achievedAmount: 310000, entryKind: "SELLER" },
      { externalCode: "282", sellerName: "WESLEY APOLONIO - SUPORTE NORTE", goalAmount: 280000, achievedAmount: 200000, entryKind: "SELLER" },
      { externalCode: "287", sellerName: "ANTONIO DA SILVA DE SOUSA", goalAmount: 250000, achievedAmount: 260000, entryKind: "SELLER" },
      { externalCode: "305", sellerName: "EDGAR R OLIVEIRA ROCHA", goalAmount: 200000, achievedAmount: 90000, entryKind: "SELLER" },
      { externalCode: "374", sellerName: "RAFAEL FLORINDO CRUZ", goalAmount: 190000, achievedAmount: null, entryKind: "SELLER" },
    ],
  },
  {
    name: "MATRIZ",
    entries: [
      { externalCode: "3", sellerName: "SOCORRINHA", goalAmount: 420000, achievedAmount: 450000, entryKind: "SELLER" },
      { externalCode: "4", sellerName: "NETO", goalAmount: 440000, achievedAmount: 300000, entryKind: "SELLER" },
      { externalCode: "7", sellerName: "CHECK-OUT BOMBONIERE", goalAmount: 1000000, achievedAmount: 950000, entryKind: "BUCKET" },
      { externalCode: "361", sellerName: "DANIELLE", goalAmount: 150000, achievedAmount: 80000, entryKind: "SELLER" },
    ],
  },
  {
    name: "NORTE",
    entries: [
      { externalCode: "77", sellerName: "SHIRLEY MARIA SANTOS COSTA", goalAmount: 160000, achievedAmount: 170000, entryKind: "SELLER" },
      { externalCode: "164", sellerName: "ARAO FERREIRA DA CUNHA", goalAmount: 180000, achievedAmount: 90000, entryKind: "SELLER" },
      { externalCode: "273", sellerName: "JARDEL FARIAS PORTELA", goalAmount: 350000, achievedAmount: 400000, entryKind: "SELLER" },
      { externalCode: "307", sellerName: "EVANDRO LIMA MONTEIRO", goalAmount: 180000, achievedAmount: 120000, entryKind: "SELLER" },
      { externalCode: "346", sellerName: "RICARDO CARVALHO DE SA", goalAmount: 150000, achievedAmount: 60000, entryKind: "SELLER" },
      { externalCode: "355", sellerName: "FRANCISCO DAS CHAGAS RODRIGUES BORGES JR", goalAmount: 150000, achievedAmount: null, entryKind: "SELLER" },
      { externalCode: "376", sellerName: "TREINAMENTO (CASTELO)", goalAmount: 120000, achievedAmount: null, entryKind: "BUCKET" },
      { externalCode: "356", sellerName: "TREINAMENTO (CAMPO MAIOR)", goalAmount: 110000, achievedAmount: null, entryKind: "BUCKET" },
    ],
  },
  {
    name: "SUL",
    entries: [
      { externalCode: "30", sellerName: "IVO TEIXEIRA DOS SANTOS", goalAmount: 300000, achievedAmount: 320000, entryKind: "SELLER" },
      { externalCode: "166", sellerName: "NATANAEL PADUA DA SILVA", goalAmount: 200000, achievedAmount: 150000, entryKind: "SELLER" },
      { externalCode: "324", sellerName: "RAIMUNDO ANTONIO GABRIEL VAZ", goalAmount: 180000, achievedAmount: 90000, entryKind: "SELLER" },
      { externalCode: "358", sellerName: "TREINAMENTO (OEIRAS)", goalAmount: 100000, achievedAmount: null, entryKind: "BUCKET" },
      { externalCode: "367", sellerName: "IARLLY SORIANO SILVA", goalAmount: 100000, achievedAmount: 40000, entryKind: "SELLER" },
      { externalCode: "350", sellerName: "JOAO EDUARDO", goalAmount: 160000, achievedAmount: 170000, entryKind: "SELLER" },
      { externalCode: "240", sellerName: "TREINAMENTO (PIO IX)", goalAmount: 160000, achievedAmount: null, entryKind: "BUCKET" },
      { externalCode: "380", sellerName: "ANDERSON PAES DA SILVA", goalAmount: 200000, achievedAmount: 210000, entryKind: "SELLER" },
    ],
  },
];

async function main() {
  console.log("🏆 Seed do Ranking de Metas — Meta Julho/2026 (Metropolis)\n");

  const period = await prisma.salesGoalPeriod.upsert({
    where: {
      organizationId_periodType_periodStart: {
        organizationId: ORG_ID,
        periodType: "MONTHLY",
        periodStart: PERIOD_START,
      },
    },
    create: {
      organizationId: ORG_ID,
      periodType: "MONTHLY",
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      label: "Meta Julho/2026",
      sourceFileName: "meta-julho-2026-demo.xlsx",
    },
    update: { periodEnd: PERIOD_END, label: "Meta Julho/2026" },
  });
  console.log(`✔ Período ${period.label} (${period.id})`);

  for (const [index, branchSeed] of BRANCHES.entries()) {
    const branch = await prisma.salesGoalBranch.upsert({
      where: { periodId_name: { periodId: period.id, name: branchSeed.name } },
      create: { periodId: period.id, name: branchSeed.name, sortOrder: index },
      update: { sortOrder: index },
    });

    for (const entry of branchSeed.entries) {
      await prisma.salesGoalEntry.upsert({
        where: { branchId_externalCode: { branchId: branch.id, externalCode: entry.externalCode } },
        create: {
          branchId: branch.id,
          externalCode: entry.externalCode,
          sellerName: entry.sellerName,
          goalName: entry.sellerName,
          goalAmount: entry.goalAmount,
          achievedAmount: entry.achievedAmount,
          entryKind: entry.entryKind,
        },
        update: {
          sellerName: entry.sellerName,
          goalName: entry.sellerName,
          goalAmount: entry.goalAmount,
          achievedAmount: entry.achievedAmount,
          entryKind: entry.entryKind,
        },
      });
    }
    console.log(`✔ Filial ${branchSeed.name} (${branchSeed.entries.length} metas)`);
  }

  console.log("\n🚀 Pronto! Abra /nerp/ranking na tab Mensal.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
