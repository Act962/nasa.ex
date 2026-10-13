// Endereço do banco dos testes de integração e a trava que impede a suíte de
// rodar (e truncar tabelas) contra qualquer outro banco.

export const DEFAULT_TEST_DATABASE_URL = "postgresql://docker:docker@localhost:5433/nasa_test";

export function resolveTestDatabaseUrl(): string {
  return process.env.TEST_DATABASE_URL || DEFAULT_TEST_DATABASE_URL;
}

export function assertIsTestDatabase(databaseUrl: string | undefined): void {
  const databaseName = databaseUrl ? new URL(databaseUrl).pathname.replace(/^\//, "") : "";
  if (!databaseName.endsWith("_test")) {
    throw new Error(
      `Testes de integração só rodam em banco cujo nome termina em "_test" (recebido: "${databaseName || "vazio"}"). ` +
        "A suíte trunca todas as tabelas.",
    );
  }
}
