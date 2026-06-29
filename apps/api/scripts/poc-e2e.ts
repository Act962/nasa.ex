// PoC ponta a ponta da Fase 3: usa o client oRPC real (mesma type-safety do
// front — RouterClient<typeof router>) contra a API Fastify separada, chamando
// a procedure pública `public.listPlans()`. Prova: client tipado + RPCLink +
// RPCHandler + execução real da procedure (com Prisma) cross-process.
//
// Uso: subir o apps/api e rodar `tsx scripts/poc-e2e.ts`.
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import type { router as AppRouter } from "@/app/router";

const apiBaseUrl = process.env.POC_API_URL ?? "http://localhost:3333";

const link = new RPCLink({ url: `${apiBaseUrl}/api/rpc` });
const client: RouterClient<AppRouter> = createORPCClient(link);

async function main() {
  const result = await client.public.listPlans();

  console.log(`✅ public.listPlans OK — ${result.plans.length} plano(s) via ${apiBaseUrl}`);
  const firstPlan = result.plans[0];
  if (firstPlan) {
    // type-safe: campos vêm do output Zod do router, sem cast.
    console.log(`   exemplo: ${firstPlan.slug} — ${firstPlan.name} (${firstPlan.monthlyStars}★)`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ PoC falhou:", error);
    process.exit(1);
  });
