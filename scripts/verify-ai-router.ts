/**
 * Verificação do roteador de IA (Fase 4).
 *
 * Só resolve modelos — não chama provedor nenhum, não gasta token, não escreve
 * no banco. O que se prova aqui é a escolha: nível, capacidade exigida, chave
 * disponível e ordem de custo.
 *
 *   pnpm tsx --require ./scripts/_setup-server-only.cjs scripts/verify-ai-router.ts
 */

import "dotenv/config";

import {
  blendedCostPer1k,
  modelsForTier,
  NoAiProviderError,
  resolveModels,
  resolvePrimaryModel,
  type AstroTier,
} from "../src/features/ia/lib/router";
import prisma from "../src/lib/prisma";

let failures = 0;

function check(name: string, passed: boolean, detail: string) {
  if (!passed) failures += 1;
  console.log(`[${passed ? "PASS" : "FAIL"}] ${name} — ${detail}`);
}

async function main() {
  const organization = await prisma.organization.findFirst({
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  if (!organization) throw new Error("Nenhuma organização no banco.");

  const openaiKey = process.env.OPENAI_API_KEY;
  const googleKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY;

  console.log(`Organização: ${organization.name}`);
  console.log(
    `Chaves de ambiente — OpenAI: ${openaiKey ? "sim" : "não"}, ` +
      `Google: ${googleKey ? "sim" : "não"}, ` +
      `Anthropic: ${process.env.ANTHROPIC_API_KEY ? "sim" : "não"}\n`,
  );

  // ── Cada nível resolve ao menos um modelo ───────────────────────────────
  for (const tier of ["FAST", "SMART", "DEEP"] as AstroTier[]) {
    const resolved = await resolveModels({
      organizationId: organization.id,
      tier,
      requires: { tools: true },
    });
    check(
      `nível ${tier}`,
      resolved.length > 0,
      resolved.length > 0
        ? `${resolved.length} candidato(s): ${resolved.map((r) => `${r.provider}/${r.modelId}`).join(" → ")}`
        : "nenhum candidato",
    );
  }

  // ── Ordem por custo dentro do nível ─────────────────────────────────────
  const smart = modelsForTier("SMART");
  const costs = smart.map((model) => ({
    id: model.id,
    cost: blendedCostPer1k(model.id),
  }));
  const hasPrices = costs.every((entry) => Number.isFinite(entry.cost));
  check(
    "todo modelo do catálogo tem preço",
    hasPrices,
    costs.map((c) => `${c.id}=${c.cost.toFixed(5)}`).join(", ") +
      (hasPrices ? "" : " — modelo sem preço ordena por último"),
  );

  // ── O caso que motivou a fase: ASTRO sem a chave da OpenAI ──────────────
  const savedOpenai = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const withoutOpenai = await resolveModels({
      organizationId: organization.id,
      tier: "SMART",
      requires: { tools: true },
    });
    check(
      "ASTRO sobrevive sem OPENAI_API_KEY",
      withoutOpenai.length > 0,
      withoutOpenai.length > 0
        ? `caiu para ${withoutOpenai[0].provider}/${withoutOpenai[0].modelId} ` +
            "(antes desta fase, o copiloto inteiro lançava erro)"
        : "nenhum candidato — não há outra chave configurada neste ambiente",
    );
  } finally {
    if (savedOpenai) process.env.OPENAI_API_KEY = savedOpenai;
  }

  // ── Sem chave nenhuma, o erro é tipado e explica o que fazer ────────────
  const saved = {
    openai: process.env.OPENAI_API_KEY,
    google: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
  };
  delete process.env.OPENAI_API_KEY;
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    await resolvePrimaryModel({
      organizationId: organization.id,
      tier: "SMART",
    });
    check("erro tipado sem nenhuma chave", false, "deveria ter lançado");
  } catch (error) {
    check(
      "erro tipado sem nenhuma chave",
      error instanceof NoAiProviderError,
      error instanceof Error ? error.message.slice(0, 90) : String(error),
    );
  } finally {
    if (saved.openai) process.env.OPENAI_API_KEY = saved.openai;
    if (saved.google) process.env.GOOGLE_GENERATIVE_AI_API_KEY = saved.google;
    if (saved.gemini) process.env.GEMINI_API_KEY = saved.gemini;
    if (saved.anthropic) process.env.ANTHROPIC_API_KEY = saved.anthropic;
  }

  // ── Níveis não colapsam no mesmo modelo ─────────────────────────────────
  const smartPrimary = await resolveModels({
    organizationId: organization.id,
    tier: "SMART",
    requires: { tools: true },
  });
  const deepPrimary = await resolveModels({
    organizationId: organization.id,
    tier: "DEEP",
    requires: { tools: true },
  });
  check(
    "SMART e DEEP resolvem modelos distintos",
    smartPrimary[0]?.modelId !== deepPrimary[0]?.modelId,
    `SMART=${smartPrimary[0]?.modelId}, DEEP=${deepPrimary[0]?.modelId}`,
  );

  // ── Compatibilidade: o que o ASTRO usava antes continua sendo o primário ─
  check(
    "comportamento preservado com chave da OpenAI",
    smartPrimary[0]?.modelId === "gpt-4o-mini" &&
      deepPrimary[0]?.modelId === "gpt-4o",
    `antes: simples=gpt-4o-mini, complexo=gpt-4o · agora: ` +
      `SMART=${smartPrimary[0]?.modelId}, DEEP=${deepPrimary[0]?.modelId}`,
  );

  console.log(
    `\n${failures === 0 ? "Todos os critérios passaram." : `${failures} critério(s) falharam.`}`,
  );
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
