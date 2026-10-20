import { describe, expect, it } from "vitest";
import {
  buildFeatureGraph,
  compareWithBaseline,
  countOrpcOutsideHooks,
  countUninvokedErrorThrows,
  findFeatureKnots,
  findMutualFeaturePairs,
  findTenancyCandidates,
  findTierViolations,
  takeSnapshot,
  type BoundarySnapshot,
  type SourceFile,
} from "./feature-boundaries";

const file = (path: string, content: string): SourceFile => ({ path, content });
const importing = (...features: string[]) =>
  features.map((feature) => `import { x } from "@/features/${feature}/lib/x";`).join("\n");

const emptySnapshot: BoundarySnapshot = {
  mutualFeaturePairs: [],
  largestFeatureKnot: 0,
  tierViolations: [],
  orpcOutsideHooks: {},
  uninvokedErrorThrows: {},
  tenancyCandidates: [],
};

describe("buildFeatureGraph", () => {
  it("liga a feature do arquivo às features que ele importa", () => {
    const graph = buildFeatureGraph([
      file("src/features/leads/lib/a.ts", importing("trackings", "tags")),
      file("src/features/leads/components/b.tsx", importing("tags")),
    ]);

    expect([...graph.get("leads")!].sort()).toEqual(["tags", "trackings"]);
  });

  it("reconhece import de tipo, import dinâmico e import só de efeito", () => {
    const graph = buildFeatureGraph([
      file(
        "src/features/leads/lib/a.ts",
        [
          'import type { T } from "@/features/tags/types";',
          'const module = await import("@/features/form/lib/x");',
          'import "@/features/tour/register";',
        ].join("\n"),
      ),
    ]);

    expect([...graph.get("leads")!].sort()).toEqual(["form", "tags", "tour"]);
  });

  it("ignora import da própria feature, arquivos fora de features e testes", () => {
    const graph = buildFeatureGraph([
      file("src/features/leads/lib/a.ts", importing("leads")),
      file("src/app/router/leads/create.ts", importing("tags")),
      file("src/features/leads/lib/a.test.ts", importing("form")),
    ]);

    expect([...graph.keys()]).toEqual(["leads"]);
    expect(graph.get("leads")!.size).toBe(0);
  });
});

describe("findMutualFeaturePairs", () => {
  it("lista só os pares que se importam nos dois sentidos, sem repetir", () => {
    const graph = buildFeatureGraph([
      file("src/features/leads/a.ts", importing("trackings", "tags")),
      file("src/features/trackings/a.ts", importing("leads")),
      file("src/features/tags/a.ts", ""),
    ]);

    expect(findMutualFeaturePairs(graph)).toEqual(["leads<->trackings"]);
  });
});

describe("findFeatureKnots", () => {
  it("encontra ciclo longo que não tem par mútuo", () => {
    const graph = buildFeatureGraph([
      file("src/features/a/x.ts", importing("b")),
      file("src/features/b/x.ts", importing("c")),
      file("src/features/c/x.ts", importing("a")),
      file("src/features/d/x.ts", importing("a")),
    ]);

    expect(findMutualFeaturePairs(graph)).toEqual([]);
    expect(findFeatureKnots(graph)).toEqual([["a", "b", "c"]]);
  });

  it("grafo sem ciclo não tem grupo", () => {
    const graph = buildFeatureGraph([
      file("src/features/a/x.ts", importing("b")),
      file("src/features/b/x.ts", ""),
    ]);

    expect(findFeatureKnots(graph)).toEqual([]);
  });
});

describe("findTierViolations", () => {
  it("núcleo não importa domínio nem orquestrador; domínio não importa orquestrador", () => {
    const graph = buildFeatureGraph([
      file("src/features/stars/x.ts", importing("leads", "astro")),
      file("src/features/leads/x.ts", importing("admin")),
    ]);

    expect(findTierViolations(graph)).toEqual(["leads->admin", "stars->astro", "stars->leads"]);
  });

  it("importar a mesma camada ou uma camada abaixo é permitido", () => {
    const graph = buildFeatureGraph([
      file("src/features/astro/x.ts", importing("leads", "stars", "insights")),
      file("src/features/leads/x.ts", importing("trackings", "tags")),
      file("src/features/stars/x.ts", importing("tour")),
    ]);

    expect(findTierViolations(graph)).toEqual([]);
  });
});

describe("countOrpcOutsideHooks", () => {
  it("conta chamadas por arquivo, fora de hooks, lib e router", () => {
    const counts = countOrpcOutsideHooks([
      file("src/features/leads/components/list.tsx", "orpc.leads.list.queryOptions(); orpc.tags.list"),
      file("src/features/leads/hooks/use-leads.ts", "orpc.leads.list.queryOptions()"),
      file("src/lib/orpc.ts", "orpc.x"),
      file("src/app/router/leads/list.ts", "orpc.x"),
      file("src/features/leads/components/empty.tsx", "const orpcClient = 1;"),
    ]);

    expect(counts).toEqual({ "src/features/leads/components/list.tsx": 2 });
  });
});

describe("countUninvokedErrorThrows", () => {
  it("conta o throw sem invocação e ignora a forma correta", () => {
    const counts = countUninvokedErrorThrows([
      file(
        "src/app/router/leads/get.ts",
        "throw errors.NOT_FOUND;\nthrow errors.FORBIDDEN ;\nthrow errors.NOT_FOUND({ message: 'x' });\nthrow errors.BAD_REQUEST();",
      ),
      file("src/app/router/leads/ok.ts", "throw errors.NOT_FOUND();"),
      file("src/app/router/leads/get.test.ts", "throw errors.NOT_FOUND;"),
    ]);

    expect(counts).toEqual({ "src/app/router/leads/get.ts": 2 });
  });
});

describe("findTenancyCandidates", () => {
  it("lista procedure autenticada que não cita empresa nem usa a trava", () => {
    const candidates = findTenancyCandidates([
      file("src/app/router/status/create.ts", "base.use(requiredAuthMiddleware).handler(async () => {})"),
      file("src/app/router/status/list.ts", "base.use(requiredAuthMiddleware).use(requireTenantResource('tracking', x, 'lote-1')).handler("),
      file("src/app/router/tags/list.ts", "base.use(requiredAuthMiddleware).handler(() => where({ organizationId }))"),
      file("src/features/leads/server/get.ts", "base.use(requiredAuthMiddleware).handler(() => 1)"),
      file("src/features/leads/components/a.tsx", "requiredAuthMiddleware .handler("),
      file("src/app/router/public/get.ts", "base.handler(() => 1)"),
      file("src/app/router/status/create.test.ts", "requiredAuthMiddleware .handler("),
    ]);

    expect(candidates).toEqual(["src/app/router/status/create.ts", "src/features/leads/server/get.ts"]);
  });

  it("procedure nova sem conferência é regressão; a que passou a conferir é melhoria", () => {
    const report = compareWithBaseline(
      { ...emptySnapshot, tenancyCandidates: ["src/app/router/novo.ts"] },
      { ...emptySnapshot, tenancyCandidates: ["src/app/router/antigo.ts"] },
    );

    expect(report.regressions).toEqual([
      "S5 procedure autenticada sem conferência de empresa: src/app/router/novo.ts (use requireTenantResource ou filtre pela empresa)",
    ]);
    expect(report.improvements).toEqual(["S5 src/app/router/antigo.ts passou a conferir a empresa"]);
  });
});

describe("compareWithBaseline", () => {
  it("estado igual à baseline não tem regressão nem melhoria", () => {
    const snapshot = takeSnapshot([
      file("src/features/leads/a.tsx", `${importing("trackings")}\norpc.leads.list`),
      file("src/features/trackings/a.ts", importing("leads")),
    ]);

    expect(compareWithBaseline(snapshot, snapshot)).toEqual({ regressions: [], improvements: [] });
  });

  it("acusa ciclo novo, grupo maior, import contra a camada e orpc novo", () => {
    const current: BoundarySnapshot = {
      mutualFeaturePairs: ["form<->leads"],
      largestFeatureKnot: 3,
      tierViolations: ["leads->admin"],
      orpcOutsideHooks: { "src/features/leads/a.tsx": 2 },
      uninvokedErrorThrows: { "src/app/router/leads/get.ts": 1 },
      tenancyCandidates: [],
    };
    const baseline: BoundarySnapshot = {
      ...emptySnapshot,
      largestFeatureKnot: 2,
      orpcOutsideHooks: { "src/features/leads/a.tsx": 1 },
    };

    const report = compareWithBaseline(current, baseline);

    expect(report.regressions).toHaveLength(5);
    expect(report.regressions.join("\n")).toContain("throw errors.X; sem invocar em src/app/router/leads/get.ts");
    expect(report.regressions.join("\n")).toContain("form<->leads");
    expect(report.regressions.join("\n")).toContain("de 2 para 3");
    expect(report.regressions.join("\n")).toContain("leads->admin");
    expect(report.regressions.join("\n")).toContain("1 -> 2");
    expect(report.improvements).toEqual([]);
  });

  it("violação que já estava na baseline não é regressão", () => {
    const snapshot: BoundarySnapshot = {
      mutualFeaturePairs: ["form<->leads"],
      largestFeatureKnot: 2,
      tierViolations: ["leads->admin"],
      orpcOutsideHooks: { "src/features/leads/a.tsx": 2 },
      uninvokedErrorThrows: { "src/app/router/leads/get.ts": 3 },
      tenancyCandidates: [],
    };

    expect(compareWithBaseline(snapshot, snapshot).regressions).toEqual([]);
  });

  it("o que saiu da baseline aparece como melhoria, sem falhar", () => {
    const baseline: BoundarySnapshot = {
      mutualFeaturePairs: ["form<->leads"],
      largestFeatureKnot: 2,
      tierViolations: ["leads->admin"],
      orpcOutsideHooks: { "src/features/leads/a.tsx": 2 },
      uninvokedErrorThrows: { "src/app/router/leads/get.ts": 3 },
      tenancyCandidates: [],
    };

    const report = compareWithBaseline(emptySnapshot, baseline);

    expect(report.regressions).toEqual([]);
    expect(report.improvements).toHaveLength(5);
  });
});
