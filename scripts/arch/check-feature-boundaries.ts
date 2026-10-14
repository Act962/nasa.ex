// Confere as fronteiras entre features contra a baseline (regras R8, R9, R11, A1 e S5).
// Uso: pnpm arch:features            falha se alguma regra piorou
//      pnpm arch:features --update   regrava a baseline com o estado atual

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  compareWithBaseline,
  takeSnapshot,
  type BoundarySnapshot,
  type SourceFile,
} from "./feature-boundaries";

const PROJECT_ROOT = process.cwd();
const SOURCE_ROOT = path.join(PROJECT_ROOT, "src");
const BASELINE_PATH = path.join(PROJECT_ROOT, "scripts", "arch", "feature-boundaries.baseline.json");
const IGNORED_DIRECTORIES = new Set(["generated", "node_modules"]);

function readSourceFiles(directory: string): SourceFile[] {
  return readdirSync(directory).flatMap((entry) => {
    const entryPath = path.join(directory, entry);
    if (statSync(entryPath).isDirectory()) {
      return IGNORED_DIRECTORIES.has(entry) ? [] : readSourceFiles(entryPath);
    }
    if (!/\.tsx?$/.test(entry)) return [];
    const relativePath = path.relative(PROJECT_ROOT, entryPath).split(path.sep).join("/");
    return [{ path: relativePath, content: readFileSync(entryPath, "utf8") }];
  });
}

function totalOrpcCalls(snapshot: BoundarySnapshot): number {
  return Object.values(snapshot.orpcOutsideHooks).reduce((sum, callCount) => sum + callCount, 0);
}

function totalUninvokedThrows(snapshot: BoundarySnapshot): number {
  return Object.values(snapshot.uninvokedErrorThrows ?? {}).reduce((sum, throwCount) => sum + throwCount, 0);
}

function printSummary(label: string, snapshot: BoundarySnapshot) {
  console.log(
    `${label}: ${snapshot.mutualFeaturePairs.length} ciclos entre features (R8), ` +
      `maior grupo interdependente com ${snapshot.largestFeatureKnot} features, ` +
      `${snapshot.tierViolations.length} imports contra as camadas (R11), ` +
      `${totalOrpcCalls(snapshot)} orpc.* fora de hook em ${Object.keys(snapshot.orpcOutsideHooks).length} arquivos (R9), ` +
      `${totalUninvokedThrows(snapshot)} throw errors.X; sem invocar (A1), ` +
      `${(snapshot.tenancyCandidates ?? []).length} procedures sem conferência de empresa (S5)`,
  );
}

const current = takeSnapshot(readSourceFiles(SOURCE_ROOT));
const shouldUpdate = process.argv.includes("--update");

if (shouldUpdate || !existsSync(BASELINE_PATH)) {
  writeFileSync(BASELINE_PATH, `${JSON.stringify(current, null, 2)}\n`);
  printSummary("Baseline gravada", current);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as BoundarySnapshot;
const report = compareWithBaseline(current, baseline);

printSummary("Baseline", baseline);
printSummary("Atual   ", current);

if (report.improvements.length > 0) {
  console.log(`\n${report.improvements.length} melhoria(s) em relação à baseline:`);
  for (const improvement of report.improvements) console.log(`  + ${improvement}`);
  console.log("Rode `pnpm arch:features --update` e commite a baseline para travar o ganho.");
}

if (report.regressions.length > 0) {
  console.error(`\n${report.regressions.length} regressão(ões) de fronteira:`);
  for (const regression of report.regressions) console.error(`  - ${regression}`);
  console.error("\nVer docs/architecture/target-state.md §3. A baseline só pode cair.");
  process.exit(1);
}

console.log("\nFronteiras entre features: sem regressão.");
