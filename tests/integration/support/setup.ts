// Roda em cada arquivo de teste de integração, antes dos imports do teste.
// Banco real; sessão, fila, realtime e rede externa ficam fora.

import { afterAll, beforeEach, vi } from "vitest";
import { assertIsTestDatabase } from "./test-database-url";

assertIsTestDatabase(process.env.DATABASE_URL);

// A sessão é definida por teste com `signInAs` (support/session.ts). O que se
// testa aqui é o que cada rota faz com a sessão, não o better-auth.
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(async () => null),
      getFullOrganization: vi.fn(async () => null),
    },
  },
}));

vi.mock("@/inngest/client", () => ({
  inngest: {
    send: vi.fn(async () => ({ ids: [] })),
    createFunction: vi.fn(() => ({})),
  },
}));

vi.mock("@/lib/pusher", () => ({
  pusherServer: {
    trigger: vi.fn(async () => undefined),
    triggerBatch: vi.fn(async () => undefined),
    authorizeChannel: vi.fn(),
  },
}));

// `fetch` nunca sai para a rede. É um `vi.fn` para o teste poder conferir o que o código tentou chamar.
const blockedFetch = vi.fn<typeof fetch>(async (input) => {
  const target = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  throw new Error(`Rede bloqueada nos testes de integração: ${target}`);
});
vi.stubGlobal("fetch", blockedFetch);

beforeEach(async () => {
  const { truncateAllTables } = await import("./database");
  const { signOut } = await import("./session");
  signOut();
  await truncateAllTables();
});

afterAll(async () => {
  const { testPrisma } = await import("./database");
  await testPrisma.$disconnect();
});
