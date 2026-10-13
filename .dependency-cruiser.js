// Regras de fronteira de src/modules (R1–R7 de docs/arquitetura-evolucao-overview.md §6.2).
// As regras que agregam por feature (R8, R9, R11) ficam em scripts/arch/.
// Violações anteriores às regras estão em .dependency-cruiser-known-violations.json
// e são ignoradas com --ignore-known; a lista só pode diminuir.

// O segundo padrão cobre o CI, onde o cliente gerado não existe e o import fica sem resolver.
const PRISMA_PATHS = ["^src/lib/prisma", "^(src|@)/generated/prisma"];

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "r1-dominio-puro",
      severity: "error",
      comment:
        "domain/ só importa o próprio domain/ e os contratos de modules/shared. " +
        "Nada de Prisma, Zod, Next, React ou outra camada: é o que mantém a regra testável sem I/O.",
      from: { path: "^src/modules/([^/]+)/domain/", pathNot: "\\.test\\.ts$" },
      to: { pathNot: ["^src/modules/$1/domain/", "^src/modules/shared/(domain|ports)/"] },
    },
    {
      name: "r2-aplicacao-sem-infra",
      severity: "error",
      comment:
        "application/ orquestra domínio e ports. Adapter, Prisma e rota entram por parâmetro, " +
        "montados no index.ts do módulo.",
      from: { path: "^src/modules/[^/]+/application/" },
      to: { path: ["^src/modules/[^/]+/infra/", "^src/app/", ...PRISMA_PATHS] },
    },
    {
      name: "r3-modulo-sem-framework",
      severity: "error",
      comment: "src/modules não conhece Next nem React.",
      from: { path: "^src/modules/" },
      to: { path: "node_modules/(next|react|react-dom)/" },
    },
    {
      name: "r4-infra-so-pela-raiz-do-modulo",
      severity: "error",
      comment:
        "Fora do módulo, importe de src/modules/<módulo> (index.ts), domain/, ports/ ou application/. " +
        "infra/ é detalhe interno.",
      from: { pathNot: "^src/modules/" },
      to: { path: "^src/modules/[^/]+/infra/" },
    },
    {
      name: "r5-sem-ciclo-em-modulos",
      severity: "error",
      comment: "Ciclo de imports dentro de src/modules.",
      from: { path: "^src/modules/" },
      to: { circular: true },
    },
    {
      name: "r6-ui-primitiva-sem-dominio",
      severity: "error",
      comment: "components/ui é UI primitiva: não importa features nem o client oRPC.",
      from: { path: "^src/components/ui/" },
      to: { path: ["^src/features/", "^src/lib/orpc"] },
    },
    {
      name: "r7-prisma-so-em-infra",
      severity: "error",
      comment: "Dentro de src/modules, o Prisma (cliente e tipos gerados) só aparece em infra/.",
      from: { path: "^src/modules/", pathNot: "^src/modules/[^/]+/infra/" },
      to: { path: PRISMA_PATHS },
    },
  ],
  options: {
    doNotFollow: { path: ["node_modules", "^src/generated"] },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
    },
  },
};
