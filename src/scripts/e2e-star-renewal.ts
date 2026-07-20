/**
 * E2E da renovação de Stars — simula 3 meses de assinatura contra o banco real.
 *
 * Reproduz exatamente o bug relatado ("paguei mais um mês e as Stars não
 * renovaram") percorrendo o ciclo de vida completo: ativação, consumo, compra de
 * top-up, e duas renovações. Cada renovação é simulada como o Stripe faz de
 * verdade — avançando `Subscription.periodStart/periodEnd` — porque é isso que
 * muda o `periodKey` e destrava um novo ciclo.
 *
 * Não depende do Stripe nem do Inngest: exercita `ensureStarsCycle` (o que a
 * função Inngest chama por org) e a query de seleção do cron. Para o E2E com
 * Stripe de verdade, ver `docs/STARS_OVERVIEW.md` §10.
 *
 * Como rodar:
 *   pnpm tsx --env-file=.env src/scripts/e2e-star-renewal.ts
 *
 * Cria dados com prefixo `__e2e_renewal` e limpa tudo no final.
 *
 * Ruído esperado: o dispatch de alertas pós-débito importa
 * `notification-service`, que é marcado `server-only` e não carrega fora do
 * runtime do Next. `debitStars` já trata isso como não-crítico e segue — o
 * stack trace no output NÃO é falha do teste. A consequência é que a emissão de
 * notificações não é coberta aqui; ela precisa ser verificada pela app rodando.
 */

import prisma from "../lib/prisma";
import { ensureStarsCycle } from "../features/stars/lib/star-cycle-service";
import { debitStars, purchaseTopUp } from "../features/stars/lib/star-service";
import { StarTransactionType } from "../generated/prisma/client";

const TAG = "__e2e_renewal";
const MONTHLY_STARS = 1000;
const ROLLOVER_PCT = 30; // teto de rollover = 300
const DAY_MS = 24 * 60 * 60 * 1000;

let failures = 0;
const timeline: Record<string, string | number>[] = [];

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `    ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n           esperado=${JSON.stringify(expected)} obtido=${JSON.stringify(actual)}`}`,
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
  await prisma.starPackage.deleteMany({ where: { label: { startsWith: TAG } } });
  await prisma.plan.deleteMany({ where: { slug: { startsWith: TAG } } });
}

async function readOrg(orgId: string) {
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
    where: { organizationId: orgId, type: StarTransactionType.PLAN_CREDIT },
  });
  return { ...org, planCredits };
}

/** Avança o período da assinatura como o Stripe faz ao renovar. */
async function advanceSubscription(
  subscriptionId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<void> {
  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { periodStart, periodEnd },
  });
}

/** Reproduz a seleção do cron `stars-cycle-renew`. */
async function orgsDueForRenewal(now: Date): Promise<string[]> {
  const due = await prisma.organization.findMany({
    where: {
      planId: { not: null },
      OR: [{ starsCycleEnd: { lte: now } }, { starsCycleEnd: null }],
    },
    select: { id: true },
  });
  return due.map((org) => org.id);
}

function record(
  step: string,
  org: { starsBalance: number; starsProtectedBalance: number; planCredits: number },
): void {
  timeline.push({
    etapa: step,
    saldo: org.starsBalance,
    protegido: org.starsProtectedBalance,
    "creditos do plano": org.planCredits,
  });
}

async function main(): Promise<void> {
  await cleanup();

  const now = new Date();
  const month1 = new Date(now.getTime() - 60 * DAY_MS);
  const month2 = new Date(now.getTime() - 30 * DAY_MS);
  const month3 = now;
  const month4 = new Date(now.getTime() + 30 * DAY_MS);

  const plan = await prisma.plan.create({
    data: {
      slug: `${TAG}-plano`,
      name: `${TAG}-plano`,
      monthlyStars: MONTHLY_STARS,
      rolloverPct: ROLLOVER_PCT,
      priceMonthly: 100,
      billingType: "monthly",
    },
    select: { id: true, name: true },
  });

  const owner = await prisma.user.create({
    data: { name: `${TAG}-owner`, email: `${TAG}-owner@x.test` },
    select: { id: true },
  });

  const org = await prisma.organization.create({
    data: {
      name: `${TAG}-org`,
      slug: `${TAG}-org`,
      createdAt: month1,
      planId: plan.id,
    },
    select: { id: true },
  });

  await prisma.member.create({
    data: {
      organizationId: org.id,
      userId: owner.id,
      role: "owner",
      createdAt: month1,
    },
  });

  const subscriptionId = `${TAG}-sub`;
  await prisma.subscription.create({
    data: {
      id: subscriptionId,
      plan: `${TAG}-plano`,
      referenceId: owner.id,
      status: "active",
      stripeSubscriptionId: `${TAG}-stripe`,
      periodStart: month1,
      periodEnd: month2,
      billingInterval: "month",
    },
  });

  console.log("\n═══ MÊS 1 — assinatura ativada ═══");
  await ensureStarsCycle(org.id, "first_activation");
  let state = await readOrg(org.id);
  check("cota creditada", state.starsBalance, MONTHLY_STARS);
  check("1 crédito de plano", state.planCredits, 1);
  record("mes 1: ativacao", state);

  console.log("\n═══ MÊS 1 — org consome 700 e compra 500 de top-up ═══");
  await debitStars(
    org.id,
    700,
    StarTransactionType.APP_CHARGE,
    "Consumo simulado do mês 1",
  );
  const topupPackage = await prisma.starPackage.create({
    data: { label: `${TAG}-pacote`, stars: 500, priceBrl: 75, isActive: true },
    select: { id: true },
  });
  await purchaseTopUp(org.id, topupPackage.id);

  state = await readOrg(org.id);
  check("saldo = 1000-700+500", state.starsBalance, 800);
  check("500 protegidos (Stars pagas)", state.starsProtectedBalance, 500);
  record("mes 1: pos consumo+topup", state);

  console.log("\n═══ MÊS 2 — cliente paga a renovação ═══");
  console.log("    (Stripe avança periodStart/periodEnd; o cron detecta)");
  await advanceSubscription(subscriptionId, month2, month3);

  const dueMonth2 = await orgsDueForRenewal(month3);
  check("cron seleciona a org", dueMonth2.includes(org.id), true);

  await ensureStarsCycle(org.id, "cron");
  state = await readOrg(org.id);
  // planPortion = 800-500 = 300 -> rollover = min(300, teto 300) = 300
  // saldo = rollover 300 + cota 1000 + protegido 500
  check("ESTE ERA O BUG: renovou", state.planCredits, 2);
  check("saldo = 300 rollover + 1000 cota + 500 pagos", state.starsBalance, 1800);
  check("top-up sobreviveu à virada", state.starsProtectedBalance, 500);
  record("mes 2: renovacao", state);

  console.log("\n═══ MÊS 2 — cron roda de novo no mesmo período ═══");
  await ensureStarsCycle(org.id, "cron");
  await ensureStarsCycle(org.id, "stripe");
  state = await readOrg(org.id);
  check("nenhum crédito extra", state.planCredits, 2);
  check("saldo inalterado", state.starsBalance, 1800);
  record("mes 2: cron repetido", state);

  console.log("\n═══ MÊS 3 — segunda renovação, teto de rollover atua ═══");
  await advanceSubscription(subscriptionId, month3, month4);
  await ensureStarsCycle(org.id, "cron");
  state = await readOrg(org.id);
  // planPortion = 1800-500 = 1300 -> rollover = min(1300, 300) = 300, expira 1000
  check("renovou de novo", state.planCredits, 3);
  check("saldo = 300 + 1000 + 500", state.starsBalance, 1800);
  check("protegido intacto", state.starsProtectedBalance, 500);
  const expired = await prisma.starTransaction.aggregate({
    where: { organizationId: org.id, type: StarTransactionType.CYCLE_EXPIRE },
    _sum: { amount: true },
  });
  check("cota excedente expirou", expired._sum.amount, -1000);
  record("mes 3: renovacao + expiracao", state);

  console.log("\n═══ Linha do tempo ═══");
  console.table(timeline);

  const cycles = await prisma.orgStarCycle.findMany({
    where: { organizationId: org.id },
    select: { periodKey: true, source: true, status: true, monthlyStars: true },
    orderBy: { createdAt: "asc" },
  });
  console.log("═══ Ciclos registrados (trilha de auditoria) ═══");
  console.table(
    cycles.map((cycle) => ({
      periodKey: cycle.periodKey.replace(`${TAG}-stripe:`, ""),
      origem: cycle.source,
      status: cycle.status,
      cota: cycle.monthlyStars,
    })),
  );
  check("3 ciclos aplicados, um por mês", cycles.length, 3);

  await cleanup();

  console.log(
    `\n${failures === 0 ? "E2E PASSOU — renovação funcionando nos 3 meses" : `${failures} ASSERCAO(OES) FALHARAM`}\n`,
  );
  if (failures > 0) process.exit(1);
}

main()
  .catch(async (error) => {
    console.error("E2E explodiu:", error);
    await cleanup().catch(() => {});
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
