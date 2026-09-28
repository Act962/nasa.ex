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
]);

export default eslintConfig;
