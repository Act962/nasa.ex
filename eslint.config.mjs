import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Cobrança de Stars só nasce no ponto único de cobrança.
    //
    // `debitStars` mexe em saldo direto e não consulta o catálogo de preço:
    // usá-lo fora do módulo é como o preço voltava a ficar espalhado pelo
    // código, e foi assim que 14 ações passaram meses sem cobrar sem ninguém
    // notar. Regressão agora é erro de build, não achado de revisão.
    //
    // Use `meter()` ou `meterOrThrow()` de `@/features/stars/lib/metering`.
    // Ver specs/stars/0020 e docs/BILLING_ARCHITECTURE.md.
    files: ["src/**/*.ts", "src/**/*.tsx"],
    ignores: ["src/features/stars/lib/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/features/stars/lib/star-service",
              importNames: ["debitStars"],
              message:
                "Use meter() ou meterOrThrow() de @/features/stars/lib/metering. " +
                "debitStars ignora o catálogo de preço — ver specs/stars/0020.",
            },
          ],
        },
      ],
    },
  },
  {
    // "Cliente global ou transação" tem um tipo só: `Prisma.TransactionClient`.
    //
    // União com `PrismaClient` ou `Omit`/`Pick` de `typeof prisma` fazem o
    // TypeScript comparar os ~300 models estruturalmente a cada chamada — um
    // único arquivo assim custava 63 s e a checagem inteira passava de 12 GB.
    // Ver docs/DEPLOYMENT.md §0.1.
    files: ["src/**/*.ts", "src/**/*.tsx"],
    ignores: ["src/generated/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "TSUnionType > TSTypeReference[typeName.name='PrismaClient'], TSUnionType > TSTypeQuery[exprName.name='prisma']",
          message:
            "Use Prisma.TransactionClient (aceita o cliente global e o tx) — união com o cliente explode a checagem de tipos.",
        },
        {
          selector:
            "TSTypeReference[typeName.name=/^(Omit|Pick)$/] > TSTypeParameterInstantiation > :matches(TSTypeQuery[exprName.name='prisma'], TSTypeReference[typeName.name='PrismaClient'])",
          message:
            "Use Prisma.TransactionClient (ou Pick<Prisma.TransactionClient, ...>) — Omit/Pick do cliente explode a checagem de tipos.",
        },
      ],
    },
  },
]);

export default eslintConfig;
