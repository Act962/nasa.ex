import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Projeto `unit`: regras puras, sem banco nem rede. O projeto `integration`
// (Postgres real) entra na etapa 4 de docs/architecture/migration-plan.md.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
    ],
  },
});
