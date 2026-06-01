/**
 * Aplica os 5 presets agent-mode em TODOS os trackings ativos da org.
 *
 * Idempotente: pra cada tracking, verifica quais presets já existem
 * (match por nome contém slug) e aplica apenas os faltantes. Roda
 * em batch, log per-tracking.
 *
 * Presets aplicados:
 *   1. Agente de Agendamento
 *   2. Closer Comercial + Follow-up
 *   3. Proposta + Contrato — Fechamento Automático
 *   4. Boas-vindas NASA Route — Pós-pagamento
 *   5. Comprovante de Pagamento — IA Lê o Arquivo
 *
 * USO: pnpm tsx scripts/apply-presets-to-all-trackings.ts
 *
 * Override de org: ORG_ID=xxx pnpm tsx scripts/...
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
const envLocal = "/Users/weydsonlima/nasaex-wey/.env.local";
if (existsSync(envLocal)) config({ path: envLocal });
config();

import prisma from "../src/lib/prisma";
import {
  applyDefaultAgentPresets,
  PRESET_CATALOG,
  type PresetSlug,
} from "../src/features/workflows/lib/agent-presets/apply-default-presets";

const ORG_ID =
  process.env.ORG_ID ?? "GHqaKGx2iD4Za5tnO8WzKbC8xUVBkPg0";

// Mapeia slug → palavra-chave única que aparece no name do workflow criado.
// Usado pra detectar "preset já existe" sem precisar de campo dedicado.
const SLUG_TO_NAME_FRAGMENT: Record<PresetSlug, string> = {
  agendamento: "Agendamento",
  "closer-followup": "Closer",
  "proposta-contrato": "Proposta + Contrato",
  "boas-vindas-nasa-route": "Boas-vindas NASA Route",
  "comprovante-pagamento": "Comprovante de Pagamento",
};

async function main() {
  console.log(`Aplicando 5 presets na org ${ORG_ID}\n`);

  // Pega user owner pra dar autoria nos workflows
  const owner = await prisma.member.findFirst({
    where: { organizationId: ORG_ID, role: "owner" },
    select: { userId: true },
  });
  if (!owner) {
    throw new Error(`Org ${ORG_ID} sem owner — abortando`);
  }

  const trackings = await prisma.tracking.findMany({
    where: { organizationId: ORG_ID, archivedAt: null },
    select: {
      id: true,
      name: true,
      workflows: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });

  console.log(`Encontrados ${trackings.length} trackings ativos\n`);

  let totalCreated = 0;
  let totalSkipped = 0;

  for (const tracking of trackings) {
    const existingNames = tracking.workflows.map((w) => w.name);

    // Pra cada preset, verifica se já tem workflow com fragmento no nome
    const missingSlugs: PresetSlug[] = [];
    for (const preset of PRESET_CATALOG) {
      const fragment = SLUG_TO_NAME_FRAGMENT[preset.slug];
      const exists = existingNames.some((n) => n.includes(fragment));
      if (!exists) missingSlugs.push(preset.slug);
    }

    console.log(`━ ${tracking.name} (${tracking.id})`);
    console.log(
      `  Workflows atuais: ${tracking.workflows.length} | Faltam: ${missingSlugs.length}`,
    );
    if (missingSlugs.length === 0) {
      console.log(`  ✓ Todos os 5 presets já existem — pulando\n`);
      totalSkipped += 5;
      continue;
    }

    for (const slug of missingSlugs) {
      try {
        const created = await applyDefaultAgentPresets({
          prisma,
          organizationId: ORG_ID,
          trackingId: tracking.id,
          userId: owner.userId,
          slug,
        });
        if (created.length > 0) {
          console.log(`  ✓ "${created[0]!.name}" criado`);
          totalCreated++;
        } else {
          console.log(`  ⚠ preset ${slug} não criou nada`);
        }
      } catch (err) {
        console.log(
          `  ✗ preset ${slug} falhou:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
    console.log();
  }

  console.log("═══════════════════════════════════════");
  console.log(`✓ ${totalCreated} workflows criados`);
  console.log(`→ ${totalSkipped} pulados (já existiam)`);
  console.log("═══════════════════════════════════════");
}

main()
  .catch((e) => {
    console.error("✗ Falhou:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
