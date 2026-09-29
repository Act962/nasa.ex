// Pré-compila no `next dev` as rotas mais usadas, uma por vez, para a primeira abertura não esperar o Turbopack.
// Uso: `pnpm dev:warm` (com o `pnpm dev` rodando) ou `pnpm dev:warm /rota-a /rota-b`.

const BASE_URL = process.env.WARM_BASE_URL ?? "http://localhost:3000";
const SERVER_WAIT_MS = 120_000;
const ROUTE_TIMEOUT_MS = 180_000;

// Enxuta de propósito: numa máquina de 8 GB cada rota a mais custa minutos. Passe outras como argumento.
const DEFAULT_ROUTES = [
  "/api/auth/get-session",
  "/tracking-chat",
  "/tracking",
  "/campanhas",
  "/home",
];

const routes = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_ROUTES;

async function requestRoute(route, timeoutMs) {
  const response = await fetch(`${BASE_URL}${route}`, {
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs),
  });
  await response.arrayBuffer();
  return response.status;
}

async function waitForServer() {
  const deadline = Date.now() + SERVER_WAIT_MS;
  while (Date.now() < deadline) {
    try {
      await requestRoute("/favicon.ico", 5_000);
      return true;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  }
  return false;
}

if (!(await waitForServer())) {
  console.error(`Servidor não respondeu em ${BASE_URL}. Rode \`pnpm dev\` antes.`);
  process.exit(1);
}

const startedAt = Date.now();
// Em sequência de propósito: compilar várias rotas em paralelo estoura a memória do `next dev`.
for (const route of routes) {
  const routeStartedAt = Date.now();
  try {
    const status = await requestRoute(route, ROUTE_TIMEOUT_MS);
    const seconds = ((Date.now() - routeStartedAt) / 1000).toFixed(1);
    // 404 em rota catch-all é o bug do Turbopack de índice perdido (CLAUDE.md, regra 11).
    const warning = status === 404 && route.startsWith("/api/auth") ? "  ⚠ 404 — toque o route.ts catch-all" : "";
    console.log(`${String(status).padEnd(4)} ${seconds.padStart(6)}s  ${route}${warning}`);
  } catch (error) {
    console.log(`ERRO          ${route}  ${error instanceof Error ? error.message : String(error)}`);
  }
}
console.log(`Pronto em ${((Date.now() - startedAt) / 1000).toFixed(0)}s.`);
