import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const fromRoot = (relativePath: string) => fileURLToPath(new URL(relativePath, import.meta.url));

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL || "postgresql://docker:docker@localhost:5433/nasa_test";

// `unit`: regras puras, sem banco nem rede.
// `integration`: rotas e casos de uso contra Postgres real (docker-compose.test.yml).
export default defineConfig({
  resolve: {
    alias: {
      "@": fromRoot("./src"),
      // O pacote real lança erro fora de Server Components.
      "server-only": fromRoot("./tests/integration/support/server-only-stub.ts"),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts", "scripts/arch/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["tests/integration/support/global-setup.ts"],
          setupFiles: ["tests/integration/support/setup.ts"],
          // Um banco só: arquivos em série, senão um truncate apaga os dados do outro.
          fileParallelism: false,
          clearMocks: true,
          testTimeout: 20_000,
          hookTimeout: 30_000,
          env: {
            DATABASE_URL: TEST_DATABASE_URL,
            DIRECT_URL: TEST_DATABASE_URL,
            BETTER_AUTH_SECRET: "segredo-somente-de-teste-com-32-caracteres",
            BETTER_AUTH_URL: "http://localhost:3000",
            AI_SECRETS_KEY: "chave-somente-de-teste-com-32-caracteres",
            NEXT_PUBLIC_APP_URL: "http://localhost:3000",
          },
        },
      },
    ],
  },
});
