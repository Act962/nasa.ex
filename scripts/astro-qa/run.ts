import "./load-env";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import prisma from "../../src/lib/prisma";
import { AstroQaSession } from "./astro-session";
import { loadQaOrg, type QaOrgContext } from "./qa-org";
import { clearQaData, seedQaData } from "./seed";
import { loadPhases } from "./phases";
import { removeCreatedSince } from "./cases/qa-helpers";
import { QaAssertionError, type QaCase, type QaPhase } from "./cases/types";

// Bateria de testes do ASTRO (docs/astro-bateria-de-testes.md).
//
//   pnpm tsx --conditions=react-server scripts/astro-qa/run.ts
//   ... --fase F4          roda só uma fase (não vale como aprovação)
//   ... --repeticoes 1     troca as 3 repetições de N2/N3 (não vale como aprovação)
//   ... --sem-seed         não recria a massa antes de cada fase
//
// Fases em ordem, com portão: a primeira fase que não fecha 100% para a bateria.

const DEFAULT_REPETITIONS = 3;
const CASE_TIMEOUT_MS = 180_000;
const REPORTS_DIR = path.resolve(process.cwd(), ".astro-qa-reports");

type CaseVerdict = "PASSOU" | "FALHOU";

interface CaseRunResult {
  caseId: string;
  repetition: number;
  verdict: CaseVerdict;
  durationMs: number;
  failure?: string;
}

interface PhaseResult {
  phaseId: string;
  title: string;
  passed: boolean;
  caseRuns: CaseRunResult[];
  pendingCaseIds: string[];
}

function readFlag(name: string): string | undefined {
  const flagIndex = process.argv.indexOf(name);
  return flagIndex >= 0 ? process.argv[flagIndex + 1] : undefined;
}

async function withTimeout<T>(work: Promise<T>, caseId: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new QaAssertionError(`${caseId} passou de ${CASE_TIMEOUT_MS / 1000}s.`)),
      CASE_TIMEOUT_MS,
    );
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function runCaseOnce(qaOrg: QaOrgContext, qaCase: QaCase, repetition: number): Promise<CaseRunResult> {
  const startedAt = new Date();
  const context = { qaOrg, session: await AstroQaSession.open(qaOrg), startedAt };
  try {
    await withTimeout(qaCase.run(context), qaCase.id);
    return { caseId: qaCase.id, repetition, verdict: "PASSOU", durationMs: Date.now() - startedAt.getTime() };
  } catch (error) {
    const failure =
      error instanceof QaAssertionError
        ? error.message
        : `Erro inesperado: ${error instanceof Error ? error.stack ?? error.message : String(error)}`;
    return { caseId: qaCase.id, repetition, verdict: "FALHOU", durationMs: Date.now() - startedAt.getTime(), failure };
  } finally {
    await (qaCase.cleanup ?? removeCreatedSince)(context).catch((cleanupError) =>
      console.error(`  ! limpeza de ${qaCase.id} falhou:`, cleanupError),
    );
  }
}

async function runPhase(qaOrg: QaOrgContext, phase: QaPhase, repetitionsOverride?: number): Promise<PhaseResult> {
  console.log(`\n━━ ${phase.id} — ${phase.title}`);
  const caseRuns: CaseRunResult[] = [];

  for (const qaCase of phase.cases) {
    const repetitions = repetitionsOverride ?? (qaCase.complexity === "N1" ? 1 : DEFAULT_REPETITIONS);
    for (let repetition = 1; repetition <= repetitions; repetition++) {
      const result = await runCaseOnce(qaOrg, qaCase, repetition);
      caseRuns.push(result);
      const seconds = (result.durationMs / 1000).toFixed(1);
      console.log(`  ${result.verdict === "PASSOU" ? "✅" : "❌"} ${qaCase.id} [${repetition}/${repetitions}] ${qaCase.title} (${seconds}s)`);
      if (result.failure) console.log(`     ↳ ${result.failure.replace(/\s*\n\s*/g, " ⏎ ")}`);
      // Uma repetição que falha já reprova o caso; as outras só gastariam tokens.
      if (result.verdict === "FALHOU") break;
    }
  }

  for (const pendingCaseId of phase.pendingCaseIds) {
    console.log(`  ⏸ ${pendingCaseId} sem automação (BLOQUEADO)`);
  }

  const passed =
    phase.pendingCaseIds.length === 0 && caseRuns.every((caseRun) => caseRun.verdict === "PASSOU");
  return { phaseId: phase.id, title: phase.title, passed, caseRuns, pendingCaseIds: phase.pendingCaseIds };
}

function writeReport(results: PhaseResult[], isPartialRun: boolean): string {
  mkdirSync(REPORTS_DIR, { recursive: true });
  const reportPath = path.join(REPORTS_DIR, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(reportPath, JSON.stringify({ isPartialRun, results }, null, 2));
  return reportPath;
}

async function main() {
  const onlyPhaseId = readFlag("--fase");
  const repetitionsFlag = readFlag("--repeticoes");
  const repetitionsOverride = repetitionsFlag ? Number(repetitionsFlag) : undefined;
  const shouldReseed = !process.argv.includes("--sem-seed");
  const isPartialRun = Boolean(onlyPhaseId || repetitionsOverride);

  const qaOrg = await loadQaOrg();
  const allPhases = loadPhases();
  const phases = onlyPhaseId ? allPhases.filter((phase) => phase.id === onlyPhaseId) : allPhases;
  if (phases.length === 0) throw new Error(`Fase ${onlyPhaseId} não existe no documento.`);

  const results: PhaseResult[] = [];
  for (const phase of phases) {
    if (shouldReseed) {
      await clearQaData(qaOrg.organizationId);
      await seedQaData(qaOrg.organizationId, qaOrg.ownerUserId);
    }
    const result = await runPhase(qaOrg, phase, repetitionsOverride);
    results.push(result);
    if (!result.passed) {
      console.log(`\n⛔ Portão fechado em ${phase.id}: a bateria para aqui.`);
      break;
    }
  }

  const isBatteryApproved =
    !isPartialRun && results.length === allPhases.length && results.every((result) => result.passed);
  const reportPath = writeReport(results, isPartialRun);

  console.log("\n━━ Resumo");
  for (const result of results) {
    const failedCaseIds = [...new Set(result.caseRuns.filter((caseRun) => caseRun.verdict === "FALHOU").map((caseRun) => caseRun.caseId))];
    console.log(
      `  ${result.passed ? "✅" : "⛔"} ${result.phaseId}: ${failedCaseIds.length} falha(s)${failedCaseIds.length ? ` (${failedCaseIds.join(", ")})` : ""}, ${result.pendingCaseIds.length} sem automação`,
    );
  }
  console.log(
    isBatteryApproved
      ? "\nBATERIA APROVADA."
      : `\nBateria NÃO aprovada${isPartialRun ? " (execução parcial não aprova)" : ""}.`,
  );
  console.log(`Relatório: ${reportPath}`);
  process.exitCode = isBatteryApproved ? 0 : 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  // Módulos do app deixam conexões abertas (Pusher, Inngest); sem o exit o
  // processo não termina depois do relatório.
  .finally(async () => {
    await prisma.$disconnect();
    process.exit();
  });
