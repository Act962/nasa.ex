// Lê o consumo de IA de uma empresa do banco local e confere que os totais por uso fecham com o total
// por recurso (spec 0093, RF-10). Só leitura. Uso: pnpm tsx --conditions=react-server scripts/verify-ai-consumption.ts <organizationId>
import "./astro-qa/load-env";

async function main() {
  const organizationId = process.argv[2];
  if (!organizationId) throw new Error("Informe o id da empresa.");
  const { AI_RESOURCES } = await import("../src/features/ia/lib/ai-resources");
  const { AI_USE_GROUPS, aiUseGroupOf, periodStart } = await import("../src/features/ia/lib/ai-use-groups");
  const { aiBadgeStateOf } = await import("../src/features/ia/lib/ai-badge-state");
  const { describeAiResource } = await import("../src/features/ia/lib/describe-ai-resource");
  const { loadAiKeyFacts } = await import("../src/features/ia/server/load-ai-key-facts");
  const { loadAiUsage } = await import("../src/features/ia/server/load-ai-usage");

  const { facts, funnels } = await loadAiKeyFacts(organizationId);
  for (const period of ["today", "7d", "month"] as const) {
    const { usageByKey, unassigned } = await loadAiUsage(organizationId, periodStart(period));
    const totalByGroup = new Map<string, { calls: number; costBrl: number; stars: number }>();
    let totalCalls = 0;
    for (const [key, usage] of usageByKey) {
      const group = aiUseGroupOf(key.split(":")[0]);
      const total = totalByGroup.get(group) ?? { calls: 0, costBrl: 0, stars: 0 };
      totalByGroup.set(group, { calls: total.calls + usage.calls, costBrl: total.costBrl + usage.costBrl, stars: total.stars + usage.stars });
      totalCalls += usage.calls;
    }
    const groupedCalls = [...totalByGroup.values()].reduce((sum, total) => sum + total.calls, 0);
    console.log(`\n${period}: ${totalCalls} usos em recursos, ${unassigned.calls} sem recurso. Soma por uso ${groupedCalls === totalCalls ? "fecha" : "NÃO FECHA"}.`);
    for (const group of AI_USE_GROUPS) {
      const total = totalByGroup.get(group.id) ?? { calls: 0, costBrl: 0, stars: 0 };
      console.log(`  ${group.label}: ${total.calls} · R$ ${total.costBrl.toFixed(2)} · ${total.stars} Stars`);
    }
  }
  // CA-6: a série por dia (relatório e diálogo de tokens) fecha com o total por recurso (Satélites).
  const { reportPeriodStart, usageCostBrl } = await import("../src/features/ia/lib/ai-use-groups");
  const { loadAiDailyUsage } = await import("../src/features/ia/server/load-ai-daily-usage");
  const since = reportPeriodStart("30d");
  const [dailyRows, { usageByKey, unassigned }] = await Promise.all([loadAiDailyUsage(organizationId, since), loadAiUsage(organizationId, since)]);
  const dailyCalls = dailyRows.reduce((sum, row) => sum + row.calls, 0);
  const dailyCost = dailyRows.reduce((sum, row) => sum + (usageCostBrl(row) ?? 0), 0);
  const dailyStars = dailyRows.reduce((sum, row) => sum + row.stars, 0);
  const resourceTotals = [...usageByKey.values(), unassigned];
  const resourceCalls = resourceTotals.reduce((sum, usage) => sum + usage.calls, 0);
  const resourceCost = resourceTotals.reduce((sum, usage) => sum + usage.costBrl, 0);
  const resourceStars = resourceTotals.reduce((sum, usage) => sum + usage.stars, 0);
  const isSame = dailyCalls === resourceCalls && dailyStars === resourceStars && Math.abs(dailyCost - resourceCost) < 0.01;
  console.log(`\n30 dias, por dia: ${dailyCalls} usos · R$ ${dailyCost.toFixed(2)} · ${dailyStars} Stars em ${new Set(dailyRows.map((row) => row.day)).size} dias`);
  console.log(`30 dias, por recurso: ${resourceCalls} usos · R$ ${resourceCost.toFixed(2)} · ${resourceStars} Stars`);
  console.log(isSame ? "Os dois totais batem." : "OS TOTAIS NÃO BATEM.");
  if (!isSame) process.exitCode = 1;

  const stateCount: Record<string, number> = {};
  for (const resource of AI_RESOURCES) {
    const state = aiBadgeStateOf(describeAiResource(resource, facts, resource.isPerTracking ? funnels[0] : undefined).keySource);
    stateCount[state] = (stateCount[state] ?? 0) + 1;
  }
  console.log("\nSelo por recurso:", stateCount);
}

main().then(() => process.exit(process.exitCode ?? 0)).catch((error) => { console.error(error); process.exit(1); });
