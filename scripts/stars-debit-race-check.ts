// Corrida nos débitos de STARS: dispara dois débitos ao mesmo tempo contra uma org cujo saldo
// só cobre um deles e confere que um passa, o outro é recusado e o saldo nunca fica negativo.
// Cria orgs, usuários, curso e evento próprios e apaga tudo no fim. Só roda em banco local.
// Rodar (o Pusher exige cluster no import, daí as variáveis do CI):
//   set -a; . .github/ci-public.env; set +a
//   DATABASE_URL=postgresql://docker:docker@localhost:55432/stars_race_test pnpm tsx --conditions=react-server scripts/stars-debit-race-check.ts
import "./lib/load-env-local";
import prisma from "../src/lib/prisma";
import { StarTransactionType } from "../src/generated/prisma/enums";
import { debitStars, purchaseTopUp } from "../src/features/stars/lib/star-service";
import { executeCoursePurchaseInTx } from "../src/app/router/nasa-route/helpers/purchase-helpers";
import { executeTicketPurchaseInTx } from "../src/app/router/world-events/helpers/purchase-ticket-helpers";

const ROUNDS = 5;
const RUN = Date.now().toString(36);

if (!/@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? "")) {
  throw new Error("Este ensaio só roda em banco local (localhost): ele cria e apaga organizações.");
}

let failureCount = 0;
function check(caseId: string, isPassing: boolean, detail = "") {
  console.log(`${isPassing ? "✅" : "❌"} ${caseId}${detail ? ` — ${detail}` : ""}`);
  if (!isPassing) failureCount += 1;
}

const createdOrgIds: string[] = [];
const createdUserIds: string[] = [];
const createdStarPackageIds: string[] = [];

async function createOrg(label: string, starsBalance: number, starsBonusBalance = 0) {
  const org = await prisma.organization.create({
    data: {
      name: `QA corrida ${label}`,
      slug: `qa-race-${label}-${RUN}`,
      createdAt: new Date(),
      starsBalance,
      starsBonusBalance,
    },
    select: { id: true },
  });
  createdOrgIds.push(org.id);
  return org.id;
}

async function createUser(label: string) {
  const user = await prisma.user.create({
    data: { name: `QA corrida ${label}`, email: `qa-race-${label}-${RUN}@example.test` },
    select: { id: true },
  });
  createdUserIds.push(user.id);
  return user.id;
}

async function readBalances(organizationId: string) {
  return prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { starsBalance: true, starsBonusBalance: true },
  });
}

function isInsufficientStars(error: unknown) {
  const errorData = (error as { data?: { code?: string } } | null)?.data;
  return errorData?.code === "INSUFFICIENT_STARS";
}

async function checkDebitStarsSpendableOnly(round: number) {
  const orgId = await createOrg(`spend-${round}`, 100);
  const results = await Promise.all(
    [1, 2].map(() =>
      debitStars(orgId, 60, StarTransactionType.APP_CHARGE, "QA corrida", undefined, undefined, {
        allowBonus: false,
      }),
    ),
  );
  const approvedCount = results.filter((result) => result.success).length;
  const balances = await readBalances(orgId);
  const debitCount = await prisma.starTransaction.count({ where: { organizationId: orgId } });
  check(
    `debitStars sem bônus #${round}`,
    approvedCount === 1 && balances.starsBalance === 40 && debitCount === 1,
    `aprovados ${approvedCount}, saldo ${balances.starsBalance}, lançamentos ${debitCount}`,
  );
}

async function checkDebitStarsWithBonus(round: number) {
  const orgId = await createOrg(`bonus-${round}`, 50, 50);
  const results = await Promise.all(
    [1, 2].map(() => debitStars(orgId, 60, StarTransactionType.APP_CHARGE, "QA corrida")),
  );
  const approvedCount = results.filter((result) => result.success).length;
  const balances = await readBalances(orgId);
  const debits = await prisma.starTransaction.findMany({
    where: { organizationId: orgId },
    select: { description: true },
  });
  check(
    `debitStars com bônus #${round}`,
    approvedCount === 1 &&
      balances.starsBalance === 0 &&
      balances.starsBonusBalance === 40 &&
      debits.length === 1 &&
      debits[0].description === "QA corrida (50★ saldo + 10★ bônus)",
    `aprovados ${approvedCount}, saldo ${balances.starsBalance}, bônus ${balances.starsBonusBalance}, lançamentos ${debits.length}`,
  );
}

// Recarga e débito ao mesmo tempo: a recarga não pode gravar por cima do débito.
async function checkTopUpDuringDebit(round: number) {
  const orgId = await createOrg(`topup-${round}`, 100);
  const starPackage = await prisma.starPackage.create({
    data: { stars: 500, priceBrl: 1, label: `QA corrida ${RUN}` },
    select: { id: true },
  });
  createdStarPackageIds.push(starPackage.id);
  await Promise.all([
    debitStars(orgId, 60, StarTransactionType.APP_CHARGE, "QA corrida"),
    purchaseTopUp(orgId, starPackage.id),
  ]);
  const balances = await readBalances(orgId);
  check(
    `recarga durante débito #${round}`,
    balances.starsBalance === 540,
    `saldo ${balances.starsBalance} (esperado 540)`,
  );
}

async function checkCoursePurchase(round: number) {
  const buyerOrgId = await createOrg(`course-buyer-${round}`, 100);
  const creatorOrgId = await createOrg(`course-creator-${round}`, 0);
  const creatorUserId = await createUser(`course-creator-${round}`);
  const buyerUserIds = [await createUser(`course-a-${round}`), await createUser(`course-b-${round}`)];
  const course = await prisma.nasaRouteCourse.create({
    data: { slug: `qa-race-${round}-${RUN}`, title: "QA corrida", creatorOrgId, creatorUserId },
    select: { id: true },
  });
  const plan = await prisma.nasaRoutePlan.create({
    data: { courseId: course.id, name: "QA", priceStars: 60 },
    select: { id: true },
  });

  const outcomes = await Promise.allSettled(
    buyerUserIds.map((userId) =>
      prisma.$transaction((tx) =>
        executeCoursePurchaseInTx({
          tx,
          userId,
          buyerOrgId,
          courseId: course.id,
          courseTitle: "QA corrida",
          creatorOrgId,
          planId: plan.id,
          planName: "QA",
          priceStars: 60,
        }),
      ),
    ),
  );
  const approvedCount = outcomes.filter((outcome) => outcome.status === "fulfilled").length;
  const refusedCount = outcomes.filter(
    (outcome) => outcome.status === "rejected" && isInsufficientStars(outcome.reason),
  ).length;
  const buyer = await readBalances(buyerOrgId);
  const creator = await readBalances(creatorOrgId);
  check(
    `compra de curso #${round}`,
    approvedCount === 1 && refusedCount === 1 && buyer.starsBalance === 40 && creator.starsBalance === 54,
    `aprovadas ${approvedCount}, recusadas ${refusedCount}, comprador ${buyer.starsBalance}, criador ${creator.starsBalance}`,
  );
}

async function createWorldEvent(hostOrgId: string, createdBy: string, label: string) {
  const station = await prisma.spaceStation.create({
    data: { type: "ORG", orgId: hostOrgId, nick: `qa-race-${label}-${RUN}` },
    select: { id: true },
  });
  const event = await prisma.worldEvent.create({
    data: {
      stationId: station.id,
      slug: `qa-race-${label}-${RUN}`,
      title: "QA corrida",
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 60 * 60 * 1000),
      mapData: {},
      createdBy,
    },
    select: { id: true },
  });
  return event.id;
}

function buyTicket(buyerOrgId: string, hostOrgId: string, worldEventId: string, holderUserId: string) {
  return prisma.$transaction((tx) =>
    executeTicketPurchaseInTx({
      tx,
      holderUserId,
      buyerOrgId,
      worldEventId,
      worldEventTitle: "QA corrida",
      hostOrgId,
      priceStars: 60,
    }),
  );
}

async function checkTicketPurchase(round: number) {
  const buyerOrgId = await createOrg(`ticket-buyer-${round}`, 100);
  const hostOrgId = await createOrg(`ticket-host-${round}`, 0);
  const holderUserId = await createUser(`ticket-${round}`);
  const worldEventId = await createWorldEvent(hostOrgId, holderUserId, `ticket-${round}`);

  const outcomes = await Promise.allSettled(
    [1, 2].map(() => buyTicket(buyerOrgId, hostOrgId, worldEventId, holderUserId)),
  );
  const approvedCount = outcomes.filter((outcome) => outcome.status === "fulfilled").length;
  const refusedCount = outcomes.filter(
    (outcome) => outcome.status === "rejected" && isInsufficientStars(outcome.reason),
  ).length;
  const buyer = await readBalances(buyerOrgId);
  const host = await readBalances(hostOrgId);
  check(
    `compra de ingresso #${round}`,
    approvedCount === 1 && refusedCount === 1 && buyer.starsBalance === 40 && host.starsBalance === 54,
    `aprovadas ${approvedCount}, recusadas ${refusedCount}, comprador ${buyer.starsBalance}, organizador ${host.starsBalance}`,
  );
}

// Duas orgs comprando ingresso uma da outra ao mesmo tempo: as travas não podem se cruzar (deadlock).
async function checkCrossedTicketPurchase(round: number) {
  const firstOrgId = await createOrg(`cross-a-${round}`, 100);
  const secondOrgId = await createOrg(`cross-b-${round}`, 100);
  const holderUserId = await createUser(`cross-${round}`);
  const firstEventId = await createWorldEvent(firstOrgId, holderUserId, `cross-a-${round}`);
  const secondEventId = await createWorldEvent(secondOrgId, holderUserId, `cross-b-${round}`);

  const outcomes = await Promise.allSettled([
    buyTicket(firstOrgId, secondOrgId, secondEventId, holderUserId),
    buyTicket(secondOrgId, firstOrgId, firstEventId, holderUserId),
  ]);
  const errors = outcomes
    .filter((outcome): outcome is PromiseRejectedResult => outcome.status === "rejected")
    .map((outcome) => String(outcome.reason?.message ?? outcome.reason));
  const first = await readBalances(firstOrgId);
  const second = await readBalances(secondOrgId);
  check(
    `compras cruzadas sem deadlock #${round}`,
    errors.length === 0 && first.starsBalance === 94 && second.starsBalance === 94,
    errors.length > 0 ? errors.join(" | ") : `saldos ${first.starsBalance} e ${second.starsBalance}`,
  );
}

async function cleanup() {
  await prisma.worldEventTicket.deleteMany({ where: { buyerOrgId: { in: createdOrgIds } } });
  await prisma.worldEvent.deleteMany({ where: { createdBy: { in: createdUserIds } } });
  await prisma.spaceStation.deleteMany({ where: { orgId: { in: createdOrgIds } } });
  await prisma.nasaRouteEnrollment.deleteMany({ where: { buyerOrgId: { in: createdOrgIds } } });
  await prisma.nasaRouteProgress.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.nasaRouteCourse.deleteMany({ where: { creatorOrgId: { in: createdOrgIds } } });
  await prisma.memberStarBudget.deleteMany({ where: { organizationId: { in: createdOrgIds } } });
  await prisma.starTransaction.deleteMany({ where: { organizationId: { in: createdOrgIds } } });
  await prisma.organization.deleteMany({ where: { id: { in: createdOrgIds } } });
  await prisma.starPackage.deleteMany({ where: { id: { in: createdStarPackageIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
}

async function main() {
  for (let round = 1; round <= ROUNDS; round += 1) {
    await checkDebitStarsSpendableOnly(round);
    await checkDebitStarsWithBonus(round);
    await checkTopUpDuringDebit(round);
    await checkCoursePurchase(round);
    await checkTicketPurchase(round);
    await checkCrossedTicketPurchase(round);
  }
}

main()
  .catch((error) => {
    console.error(error);
    failureCount += 1;
  })
  .finally(async () => {
    await cleanup().catch((error) => console.error("Falha na limpeza:", error));
    await prisma.$disconnect();
    console.log(failureCount === 0 ? "\nTudo certo." : `\n${failureCount} falha(s).`);
    process.exit(failureCount === 0 ? 0 : 1);
  });
