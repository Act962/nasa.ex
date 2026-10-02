import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import { orbitaPlugin } from "./eslint-rules/no-hardcoded-color.mjs";

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
    // O cliente Prisma tem dois tipos, e só eles:
    // - `Prisma.TransactionClient` — "cliente global ou transação" (sem `$transaction`);
    // - `AppPrismaClient` de `@/lib/prisma` — o cliente global, quando precisa de `$transaction`.
    //
    // O tipo público `PrismaClient`, uniões com ele e `Omit`/`Pick` de `typeof prisma`
    // têm genéricos diferentes do `tx`: o TypeScript compara os ~300 models
    // estruturalmente a cada encontro — um arquivo chegou a 63 s e a checagem
    // inteira passava de 12 GB. Ver docs/DEPLOYMENT.md §0.1.
    files: ["src/**/*.ts", "src/**/*.tsx"],
    ignores: ["src/generated/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSTypeReference[typeName.name='PrismaClient']",
          message:
            "Use Prisma.TransactionClient, ou AppPrismaClient (@/lib/prisma) se precisar de $transaction.",
        },
        {
          selector:
            "TSUnionType > TSTypeQuery[exprName.name='prisma'], TSTypeReference[typeName.name=/^(Omit|Pick)$/] > TSTypeParameterInstantiation > TSTypeQuery[exprName.name='prisma']",
          message:
            "Use Prisma.TransactionClient (ou Pick<Prisma.TransactionClient, ...>) — derivar de typeof prisma explode a checagem de tipos.",
        },
      ],
    },
  },
  {
    // Telas usam os tokens do Design System Órbita, não cor fixa: cor fixa não
    // acompanha o modo escuro nem uma troca de tema. Aviso (não erro) enquanto
    // os Apps migram — ver o roadmap em docs/design-system-overview.md.
    // `src/components/ui` define as variações e pode usar cor de propósito.
    files: ["src/**/*.tsx"],
    ignores: ["src/components/ui/**", "src/generated/**"],
    plugins: { orbita: orbitaPlugin },
    rules: {
      "orbita/no-hardcoded-color": "warn",
    },
  },
]);

export default eslintConfig;
