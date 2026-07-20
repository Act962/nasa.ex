/**
 * Teste funcional do ciclo de Stars — roda contra o banco de dev.
 *
 * Cria plano/orgs próprios com prefixo `__test_cycle` e limpa tudo no final;
 * não toca em dados existentes.
 *
 * Como rodar:
 *   pnpm tsx --env-file=.env src/scripts/test-star-cycle.ts
 *
 * O caso 5 guarda uma regressão séria: enquanto a âncora do ciclo era `now`, o
 * `periodKey` mudava a cada chamada, a unique nunca colidia e o cron creditava a
 * cota do plano a cada execução (Stars infinitas). Se ele falhar, a idempotência
 * quebrou — não relaxe a asserção.
 */

import prisma from "../lib/prisma";
import {
  ensureStarsCycle,
  resolveCycleForOrg,
  syncStarsForPlanState,
} from "../features/stars/lib/star-cycle-service";

const TAG = "__test_cycle";
let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n         esperado=${JSON.stringify(expected)} obtido=${JSON.stringify(actual)}`}`,
  );
}

async function cleanup(): Promise<void> {
  const orgs = await prisma.organization.findMany({
    where: { slug: { startsWith: TAG } },
    select: { id: true },
  });
  const ids = orgs.map((org) => org.id);
  if (ids.length > 0) {
    await prisma.orgStarCycle.deleteMany({ where: { organizationId: { in: ids } } });
    await prisma.starTransaction.deleteMany({ where: { organizationId: { in: ids } } });
    await prisma.memberStarBudget.deleteMany({ where: { organizationId: { in: ids } } });
    await prisma.workspaceIntegration.deleteMany({ where: { organizationId: { in: ids } } });
    await prisma.member.deleteMany({ where: { organizationId: { in: ids } } });
    await prisma.organization.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.subscription.deleteMany({ where: { id: { startsWith: TAG } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  await prisma.appStarCost.deleteMany({ where: { appSlug: { startsWith: TAG } } });
  await prisma.plan.deleteMany({ where: { slug: { startsWith: TAG } } });
}

async function makeOrg(
  planId: string,
  starsBalance: number,
  starsProtectedBalance: number,
  suffix: string,
): Promise<string> {
  const org = await prisma.organization.create({
    data: {
      name: `${TAG}-${suffix}`,
      slug: `${TAG}-${suffix}`,
      createdAt: new Date(),
      planId,
      starsBalance,
      starsProtectedBalance,
    },
    select: { id: true },
  });
  return org.id;
}

async function snapshot(orgId: string) {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: {
      starsBalance: true,
      starsProtectedBalance: true,
      starsCycleStart: true,
      starsCycleEnd: true,
    },
  });
  const planCredits = await prisma.starTransaction.count({
    where: { organizationId: orgId, type: "PLAN_CREDIT" },
  });
  const cycles = await prisma.orgStarCycle.count({
    where: { organizationId: orgId },
  });
  return { ...org, planCredits, cycles };
}

async function main(): Promise<void> {
  await cleanup();

  const plan = await prisma.plan.create({
    data: {
      slug: `${TAG}-plano`,
      name: `${TAG}-plano`,
      monthlyStars: 1000,
      rolloverPct: 30, // teto de rollover = 300
      priceMonthly: 100,
      billingType: "monthly",
    },
    select: { id: true },
  });

  console.log("\n1) Ciclo aplica cota + rollover, preservando Stars pagas");
  // saldo 500 = 300 do plano + 200 protegido → rollover=min(300,300)=300
  const orgA = await makeOrg(plan.id, 500, 200, "a");
  const first = await ensureStarsCycle(orgA, "cron");
  const afterFirst = await snapshot(orgA);
  check("aplicou", first.applied, true);
  check("rollover", first.rollover, 300);
  check("saldo = rollover+cota+protegido", afterFirst.starsBalance, 1500);
  check("protegido intacto", afterFirst.starsProtectedBalance, 200);
  check("1 PLAN_CREDIT", afterFirst.planCredits, 1);

  console.log("\n2) Rodar de novo no MESMO periodo nao credita de novo");
  const second = await ensureStarsCycle(orgA, "cron");
  const afterSecond = await snapshot(orgA);
  check("nao aplicou", second.applied, false);
  check("motivo", second.reason, "duplicate");
  check("saldo inalterado", afterSecond.starsBalance, 1500);
  check("ainda 1 PLAN_CREDIT", afterSecond.planCredits, 1);
  check("ainda 1 ciclo", afterSecond.cycles, 1);

  console.log("\n3) Teto de rollover corta o excedente da cota do plano");
  // saldo 900 = 700 do plano + 200 protegido → rollover=min(700,300)=300, expira 400
  const orgB = await makeOrg(plan.id, 900, 200, "b");
  const third = await ensureStarsCycle(orgB, "cron");
  const afterThird = await snapshot(orgB);
  check("rollover limitado ao teto", third.rollover, 300);
  check("saldo final", afterThird.starsBalance, 1500);
  const expireTx = await prisma.starTransaction.findFirst({
    where: { organizationId: orgB, type: "CYCLE_EXPIRE" },
    select: { amount: true },
  });
  check("expirou 400 da cota", expireTx?.amount, -400);

  console.log("\n4) Corrida: dois gatilhos simultaneos creditam UMA vez");
  const orgC = await makeOrg(plan.id, 0, 0, "c");
  const raced = await Promise.all([
    ensureStarsCycle(orgC, "stripe"),
    ensureStarsCycle(orgC, "cron"),
  ]);
  const afterRace = await snapshot(orgC);
  check(
    "exatamente 1 aplicou",
    raced.filter((r) => r.applied).length,
    1,
  );
  check("1 PLAN_CREDIT", afterRace.planCredits, 1);
  check("saldo = cota", afterRace.starsBalance, 1000);

  console.log("\n5) periodKey e DETERMINISTICO entre chamadas");
  // Regressao: ancorar em `now` gerava chave nova a cada chamada, e o cron
  // creditaria a cota a cada execucao.
  const orgE = await makeOrg(plan.id, 0, 0, "e");
  const keyOne = await resolveCycleForOrg(orgE);
  await new Promise((resolve) => setTimeout(resolve, 25));
  const keyTwo = await resolveCycleForOrg(orgE);
  check("mesma chave em chamadas distintas", keyOne?.periodKey, keyTwo?.periodKey);
  check("chave local", keyOne?.periodKey.startsWith("local:"), true);
  check(
    "starsCycleEnd preenchido apos ciclo",
    afterSecond.starsCycleEnd !== null,
    true,
  );

  console.log("\n6) Org sem plano nao credita");
  const orgD = (
    await prisma.organization.create({
      data: {
        name: `${TAG}-d`,
        slug: `${TAG}-d`,
        createdAt: new Date(),
        starsBalance: 50,
      },
      select: { id: true },
    })
  ).id;
  const noPlan = await ensureStarsCycle(orgD, "cron");
  check("nao aplicou", noPlan.applied, false);
  check("motivo", noPlan.reason, "no_plan");
  const afterNoPlan = await snapshot(orgD);
  check("saldo intocado", afterNoPlan.starsBalance, 50);

  const planBig = await prisma.plan.create({
    data: {
      slug: `${TAG}-plano-big`,
      name: `${TAG}-plano-big`,
      monthlyStars: 3000,
      rolloverPct: 30,
      priceMonthly: 300,
      billingType: "monthly",
    },
    select: { id: true },
  });

  console.log("\n7) Plano removido e REAPLICADO no mesmo periodo nao recredita");
  // Regressao #1: medir o delta contra `previousPlanId=null` creditava um mes
  // inteiro de novo (demote/promote de billing-role, recuperacao de past_due).
  const orgF = await makeOrg(plan.id, 0, 0, "f");
  await ensureStarsCycle(orgF, "first_activation");
  const beforeFlap = await snapshot(orgF);
  check("creditou o 1o ciclo", beforeFlap.starsBalance, 1000);

  // Plano some (o que recomputeOrgPlan faz quando nao ha sub ativa)...
  await prisma.organization.update({
    where: { id: orgF },
    data: { planId: null, starsCycleEnd: null, starsCyclePeriodKey: null },
  });
  // ...e volta, mesmo plano, mesmo periodo.
  await prisma.organization.update({
    where: { id: orgF },
    data: { planId: plan.id },
  });
  const flap = await syncStarsForPlanState(orgF, {
    source: "cron",
    nextPlanId: plan.id,
  });
  const afterFlap = await snapshot(orgF);
  check("nao creditou de novo", flap.applied, false);
  check("motivo", flap.reason, "not_due");
  check("saldo inalterado", afterFlap.starsBalance, 1000);
  check("ainda 1 PLAN_CREDIT", afterFlap.planCredits, 1);
  const flapDelta = await prisma.starTransaction.count({
    where: { organizationId: orgF, type: "PLAN_UPGRADE_DELTA" },
  });
  check("nenhum delta de upgrade", flapDelta, 0);

  console.log("\n8) Upgrade real no meio do ciclo credita SO a diferenca");
  await prisma.organization.update({
    where: { id: orgF },
    data: { planId: planBig.id },
  });
  const upgrade = await syncStarsForPlanState(orgF, {
    source: "stripe",
    nextPlanId: planBig.id,
  });
  const afterUpgrade = await snapshot(orgF);
  check("aplicou", upgrade.applied, true);
  check("delta = 3000-1000", upgrade.credited, 2000);
  check("saldo = cota do plano novo", afterUpgrade.starsBalance, 3000);
  // Repetir o upgrade nao pode creditar de novo.
  const upgradeAgain = await syncStarsForPlanState(orgF, {
    source: "stripe",
    nextPlanId: planBig.id,
  });
  check("upgrade repetido e no-op", upgradeAgain.applied, false);
  check("saldo inalterado", (await snapshot(orgF)).starsBalance, 3000);

  console.log("\n9a) APP_CHARGE e cobrado no primeiro ciclo quando ha saldo");
  // Regressao: o claim usava `NOT: { lastChargedPeriodKey }`, que em SQL nao
  // casa linhas com a coluna NULL — ou seja, nenhuma integracao nunca-cobrada
  // era reivindicada e o APP_CHARGE mensal jamais acontecia.
  const cheapSlug = `${TAG}-app-barato`;
  await prisma.appStarCost.create({
    data: { appSlug: cheapSlug, displayName: cheapSlug, monthlyCost: 250, setupCost: 0 },
  });
  const orgI = await makeOrg(plan.id, 0, 0, "i");
  await prisma.workspaceIntegration.create({
    data: { organizationId: orgI, appSlug: cheapSlug, isActive: true },
  });
  await ensureStarsCycle(orgI, "cron");
  const cheapCharges = await prisma.starTransaction.count({
    where: { organizationId: orgI, type: "APP_CHARGE" },
  });
  check("cobrou no 1o ciclo", cheapCharges, 1);
  check("saldo = cota - custo", (await snapshot(orgI)).starsBalance, 750);
  const cheapIntegration = await prisma.workspaceIntegration.findFirstOrThrow({
    where: { organizationId: orgI, appSlug: cheapSlug },
    select: { lastChargedPeriodKey: true },
  });
  check("claim retido apos sucesso", cheapIntegration.lastChargedPeriodKey !== null, true);

  console.log("\n9b) APP_CHARGE sem saldo libera o claim e retenta depois");
  // Regressao #2: o claim era gravado antes do debito e nunca devolvido, entao
  // uma cobranca sem saldo era marcada como feita e perdida para sempre.
  const appSlug = `${TAG}-app`;
  await prisma.appStarCost.create({
    data: { appSlug, displayName: appSlug, monthlyCost: 5000, setupCost: 0 },
  });
  const orgG = await makeOrg(plan.id, 0, 0, "g");
  await prisma.workspaceIntegration.create({
    data: { organizationId: orgG, appSlug, isActive: true },
  });
  await ensureStarsCycle(orgG, "cron"); // credita 1000, cobranca de 5000 falha
  const integrationAfterFail = await prisma.workspaceIntegration.findFirstOrThrow(
    { where: { organizationId: orgG, appSlug }, select: { lastChargedPeriodKey: true } },
  );
  const chargesAfterFail = await prisma.starTransaction.count({
    where: { organizationId: orgG, type: "APP_CHARGE" },
  });
  check("claim liberado", integrationAfterFail.lastChargedPeriodKey, null);
  check("nada cobrado ainda", chargesAfterFail, 0);

  // Org recarrega e a reconciliacao seguinte precisa cobrar.
  await prisma.organization.update({
    where: { id: orgG },
    data: { starsBalance: 9000 },
  });
  const retry = await ensureStarsCycle(orgG, "cron");
  const chargesAfterRetry = await prisma.starTransaction.count({
    where: { organizationId: orgG, type: "APP_CHARGE" },
  });
  check("ciclo continua duplicado", retry.reason, "duplicate");
  check("cobrou na retentativa", chargesAfterRetry, 1);
  check("saldo debitado", (await snapshot(orgG)).starsBalance, 4000);

  console.log("\n10) Sub ATIVA ganha de sub past_due mais recente");
  // Regressao #3: ancorar na sub mais recente incluindo inadimplentes marcava a
  // org inteira como dunning e travava a cota que ela pagou.
  const orgH = await makeOrg(plan.id, 0, 0, "h");
  const userActive = await prisma.user.create({
    data: { name: `${TAG}-ativo`, email: `${TAG}-ativo@x.test` },
    select: { id: true },
  });
  const userLate = await prisma.user.create({
    data: { name: `${TAG}-atrasado`, email: `${TAG}-atrasado@x.test` },
    select: { id: true },
  });
  await prisma.member.createMany({
    data: [
      { organizationId: orgH, userId: userActive.id, role: "owner", createdAt: new Date() },
      { organizationId: orgH, userId: userLate.id, role: "admin", createdAt: new Date() },
    ],
  });
  await prisma.subscription.createMany({
    data: [
      {
        id: `${TAG}-sub-ativa`,
        plan: `${TAG}-plano`,
        referenceId: userActive.id,
        status: "active",
        stripeSubscriptionId: `${TAG}-stripe-ativa`,
        periodStart: new Date("2026-01-01"),
        periodEnd: new Date("2026-02-01"),
        billingInterval: "month",
      },
      {
        // Mais recente de proposito — nao pode ganhar da ativa.
        id: `${TAG}-sub-atrasada`,
        plan: `${TAG}-plano`,
        referenceId: userLate.id,
        status: "past_due",
        stripeSubscriptionId: `${TAG}-stripe-atrasada`,
        periodStart: new Date("2026-06-01"),
        periodEnd: new Date("2026-07-01"),
        billingInterval: "month",
      },
    ],
  });

  const mixedWindow = await resolveCycleForOrg(orgH);
  check("ancorou na sub ativa", mixedWindow?.subscriptionStatus, "active");
  check(
    "periodKey da sub ativa",
    mixedWindow?.periodKey.includes("stripe-ativa"),
    true,
  );
  const mixed = await ensureStarsCycle(orgH, "cron");
  check("creditou normalmente", mixed.applied, true);
  check("saldo = cota", (await snapshot(orgH)).starsBalance, 1000);

  await cleanup();

  console.log(
    `\n${failures === 0 ? "TODOS OS TESTES PASSARAM" : `${failures} ASSERCAO(OES) FALHARAM`}\n`,
  );
  if (failures > 0) process.exit(1);
}

main()
  .catch(async (error) => {
    console.error("Teste explodiu:", error);
    await cleanup().catch(() => {});
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
