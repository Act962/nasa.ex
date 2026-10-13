// Regras de fronteira entre features que o dependency-cruiser não expressa bem:
// agregam por feature (não por arquivo) e comparam com uma baseline que só pode cair.
// Lógica pura; a leitura de disco fica em check-feature-boundaries.ts.

import { TIER_RANK, tierOf } from "./feature-tiers";

export type SourceFile = { path: string; content: string };

export type FeatureGraph = Map<string, Set<string>>;

export type BoundarySnapshot = {
  /** R8: pares de features que se importam mutuamente, "a<->b" em ordem alfabética. */
  mutualFeaturePairs: string[];
  /** R8: tamanho do maior grupo de features em que todas alcançam todas. */
  largestFeatureKnot: number;
  /** R11: imports contra a direção das camadas, "origem->destino". */
  tierViolations: string[];
  /** R9: chamadas `orpc.*` fora de hooks, por arquivo. */
  orpcOutsideHooks: Record<string, number>;
  /** A1: `throw errors.X;` sem invocar, por arquivo. Lança a função, e o cliente recebe 500. */
  uninvokedErrorThrows: Record<string, number>;
};

export type BoundaryReport = {
  regressions: string[];
  improvements: string[];
};

const FEATURE_PATH = /^src\/features\/([a-z0-9-]+)\//;
const FEATURE_IMPORT = /(?:from\s+|import\(\s*|import\s+)["']@\/features\/([a-z0-9-]+)/g;
const ORPC_CALL = /\borpc\.[a-zA-Z]/g;
const ORPC_ALLOWED_PATH = /\/hooks\/|^src\/lib\/|^src\/app\/router\//;
const TEST_FILE = /\.test\.tsx?$/;
const UNINVOKED_ERROR_THROW = /\bthrow\s+errors\.[A-Z_]+\s*;/g;

export function buildFeatureGraph(files: readonly SourceFile[]): FeatureGraph {
  const graph: FeatureGraph = new Map();

  for (const file of files) {
    const sourceFeature = FEATURE_PATH.exec(file.path)?.[1];
    if (!sourceFeature || TEST_FILE.test(file.path)) continue;
    if (!graph.has(sourceFeature)) graph.set(sourceFeature, new Set());

    for (const match of file.content.matchAll(FEATURE_IMPORT)) {
      const targetFeature = match[1];
      if (targetFeature !== sourceFeature) graph.get(sourceFeature)?.add(targetFeature);
    }
  }

  return graph;
}

export function findMutualFeaturePairs(graph: FeatureGraph): string[] {
  const pairs: string[] = [];
  for (const [sourceFeature, targets] of graph) {
    for (const targetFeature of targets) {
      const isMutual = graph.get(targetFeature)?.has(sourceFeature) ?? false;
      if (isMutual && sourceFeature < targetFeature) pairs.push(`${sourceFeature}<->${targetFeature}`);
    }
  }
  return pairs.sort();
}

/** Componentes fortemente conectados (Tarjan), só os com mais de uma feature. */
export function findFeatureKnots(graph: FeatureGraph): string[][] {
  type VisitState = { index: number; lowLink: number; isOnStack: boolean };
  const states = new Map<string, VisitState>();
  const stack: string[] = [];
  const knots: string[][] = [];
  let nextIndex = 0;

  function visit(feature: string) {
    const state: VisitState = { index: nextIndex, lowLink: nextIndex, isOnStack: true };
    states.set(feature, state);
    nextIndex += 1;
    stack.push(feature);

    for (const target of graph.get(feature) ?? []) {
      if (!graph.has(target)) continue;
      const targetState = states.get(target);
      if (!targetState) {
        visit(target);
        state.lowLink = Math.min(state.lowLink, states.get(target)!.lowLink);
      } else if (targetState.isOnStack) {
        state.lowLink = Math.min(state.lowLink, targetState.index);
      }
    }

    if (state.lowLink !== state.index) return;
    const knot: string[] = [];
    let member: string;
    do {
      member = stack.pop()!;
      states.get(member)!.isOnStack = false;
      knot.push(member);
    } while (member !== feature);
    if (knot.length > 1) knots.push(knot.sort());
  }

  for (const feature of graph.keys()) {
    if (!states.has(feature)) visit(feature);
  }

  return knots.sort((left, right) => right.length - left.length);
}

export function findTierViolations(graph: FeatureGraph): string[] {
  const violations: string[] = [];
  for (const [sourceFeature, targets] of graph) {
    for (const targetFeature of targets) {
      const importsUpward = TIER_RANK[tierOf(targetFeature)] > TIER_RANK[tierOf(sourceFeature)];
      if (importsUpward) violations.push(`${sourceFeature}->${targetFeature}`);
    }
  }
  return violations.sort();
}

export function countOrpcOutsideHooks(files: readonly SourceFile[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const file of files) {
    if (ORPC_ALLOWED_PATH.test(file.path) || TEST_FILE.test(file.path)) continue;
    const callCount = file.content.match(ORPC_CALL)?.length ?? 0;
    if (callCount > 0) counts[file.path] = callCount;
  }
  return sortByPath(counts);
}

function sortByPath(counts: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

export function countUninvokedErrorThrows(files: readonly SourceFile[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const file of files) {
    if (TEST_FILE.test(file.path)) continue;
    const throwCount = file.content.match(UNINVOKED_ERROR_THROW)?.length ?? 0;
    if (throwCount > 0) counts[file.path] = throwCount;
  }
  return sortByPath(counts);
}

export function takeSnapshot(files: readonly SourceFile[]): BoundarySnapshot {
  const graph = buildFeatureGraph(files);
  return {
    mutualFeaturePairs: findMutualFeaturePairs(graph),
    largestFeatureKnot: findFeatureKnots(graph)[0]?.length ?? 0,
    tierViolations: findTierViolations(graph),
    orpcOutsideHooks: countOrpcOutsideHooks(files),
    uninvokedErrorThrows: countUninvokedErrorThrows(files),
  };
}

function diffLists(current: readonly string[], baseline: readonly string[]) {
  const baselineSet = new Set(baseline);
  const currentSet = new Set(current);
  return {
    added: current.filter((entry) => !baselineSet.has(entry)),
    removed: baseline.filter((entry) => !currentSet.has(entry)),
  };
}

export function compareWithBaseline(
  current: BoundarySnapshot,
  baseline: BoundarySnapshot,
): BoundaryReport {
  const regressions: string[] = [];
  const improvements: string[] = [];

  const mutualPairs = diffLists(current.mutualFeaturePairs, baseline.mutualFeaturePairs);
  for (const pair of mutualPairs.added) {
    regressions.push(`R8 novo ciclo entre features: ${pair}`);
  }
  for (const pair of mutualPairs.removed) improvements.push(`R8 ciclo desfeito: ${pair}`);

  if (current.largestFeatureKnot > baseline.largestFeatureKnot) {
    regressions.push(
      `R8 o maior grupo de features interdependentes cresceu de ${baseline.largestFeatureKnot} para ${current.largestFeatureKnot}`,
    );
  } else if (current.largestFeatureKnot < baseline.largestFeatureKnot) {
    improvements.push(
      `R8 o maior grupo de features interdependentes caiu de ${baseline.largestFeatureKnot} para ${current.largestFeatureKnot}`,
    );
  }

  const tierViolations = diffLists(current.tierViolations, baseline.tierViolations);
  for (const edge of tierViolations.added) {
    regressions.push(`R11 import contra a direção das camadas: ${edge}`);
  }
  for (const edge of tierViolations.removed) improvements.push(`R11 import corrigido: ${edge}`);

  for (const [filePath, callCount] of Object.entries(current.orpcOutsideHooks)) {
    const baselineCount = baseline.orpcOutsideHooks[filePath] ?? 0;
    if (callCount > baselineCount) {
      regressions.push(
        `R9 orpc.* fora de hook em ${filePath}: ${baselineCount} -> ${callCount} (mova a chamada para um hook da feature)`,
      );
    }
  }
  for (const [filePath, baselineCount] of Object.entries(baseline.orpcOutsideHooks)) {
    const callCount = current.orpcOutsideHooks[filePath] ?? 0;
    if (callCount < baselineCount) {
      improvements.push(`R9 ${filePath}: ${baselineCount} -> ${callCount}`);
    }
  }

  const baselineThrows = baseline.uninvokedErrorThrows ?? {};
  for (const [filePath, throwCount] of Object.entries(current.uninvokedErrorThrows)) {
    const baselineCount = baselineThrows[filePath] ?? 0;
    if (throwCount > baselineCount) {
      regressions.push(
        `A1 throw errors.X; sem invocar em ${filePath}: ${baselineCount} -> ${throwCount} (escreva throw errors.X())`,
      );
    }
  }
  for (const [filePath, baselineCount] of Object.entries(baselineThrows)) {
    const throwCount = current.uninvokedErrorThrows[filePath] ?? 0;
    if (throwCount < baselineCount) improvements.push(`A1 ${filePath}: ${baselineCount} -> ${throwCount}`);
  }

  return { regressions, improvements };
}
