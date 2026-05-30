/**
 * Seed do preset "Comercial — Menu Interativo".
 *
 * Idempotente: INSERT … ON CONFLICT (slug) DO UPDATE — re-rodar atualiza
 * o spec/metadata.
 *
 * USO:
 *   pnpm tsx scripts/seed-comercial-preset.ts
 *
 * Aplica o preset num tracking:
 *   1. Abrir a UI em Padrões de Tracking
 *   2. Escolher "Comercial — Menu Interativo"
 *   3. Modo "merge" (adiciona ao tracking existente) ou "create" (novo)
 *
 * OU via oRPC programático: `orpc.trackingPresets.apply.mutate(...)`.
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";

const envLocal = "/Users/weydsonlima/nasaex-wey/.env.local";
if (existsSync(envLocal)) config({ path: envLocal });
config();

import prisma from "../src/lib/prisma";
import { comercialMenuInterativoSpec } from "../prisma/comercial-menu-interativo-spec";

async function main() {
  const slug = "comercial-menu-interativo";

  const result = await prisma.trackingPreset.upsert({
    where: { slug },
    create: {
      id: "tps_comercial_menu_interativo_v1",
      slug,
      name: "Atendimento Comercial — Menu + Agendamento + Follow-up",
      description:
        "Lead entra via menu de WhatsApp (Consultoria/Produtos/Interesse/Compra) → IA classifica a escolha (com fallback heurístico embutido se LLM falhar) → aplica tag e envia link de agenda → cadência 1/2/3/4/5/7/15/20/30/90 dias → tag final 'Desistiu 90' se ignorar. Testado e validado em produção.",
      paradigm: "REATIVO",
      icon: "MessageSquare",
      color: "#7A5FDF",
      order: 1,
      spec: comercialMenuInterativoSpec as never,
      isPublic: true,
      starsCost: 0,
    },
    update: {
      name: "Atendimento Comercial — Menu + Agendamento + Follow-up",
      description:
        "Lead entra via menu de WhatsApp (Consultoria/Produtos/Interesse/Compra) → IA classifica a escolha (com fallback heurístico embutido se LLM falhar) → aplica tag e envia link de agenda → cadência 1/2/3/4/5/7/15/20/30/90 dias → tag final 'Desistiu 90' se ignorar. Testado e validado em produção.",
      paradigm: "REATIVO",
      icon: "MessageSquare",
      color: "#7A5FDF",
      order: 1,
      spec: comercialMenuInterativoSpec as never,
      isPublic: true,
    },
  });

  console.log(`✓ Preset "${result.name}" (${result.slug}) seedado.`);
  console.log(`  id: ${result.id}`);
  console.log(`  tags: ${comercialMenuInterativoSpec.tags?.length ?? 0}`);
  console.log(`  status: ${comercialMenuInterativoSpec.status.length}`);
  console.log(`  workflows: ${comercialMenuInterativoSpec.workflows?.length ?? 0}`);

  const totalNodes = (comercialMenuInterativoSpec.workflows ?? []).reduce(
    (sum, w) => sum + w.nodes.length,
    0,
  );
  console.log(`  total nodes: ${totalNodes}`);
}

main()
  .catch((e) => {
    console.error("✗ Seed falhou:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
