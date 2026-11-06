// Conferência do sorteio ao vivo do STAR FRIENDS (spec 0134) contra o banco local: cria uma
// campanha descartável com participantes fictícios, sorteia, revoga, muda a quantidade de
// ganhadores e apaga tudo no fim. Nunca rode contra produção.
//
//   pnpm tsx --conditions=react-server scripts/star-friends-live-draw-check.ts

import "dotenv/config";
import prisma from "../src/lib/prisma";
import { drawNextWinner, getCampaignDrawPool, revokeCampaignDraw, setCampaignPrizeCount } from "../src/features/star-friends/lib/campaign/draw";
import { isDrawRevocable, maskPhone, nextFreePosition, DRAW_REVOKE_WINDOW_MS } from "../src/features/star-friends/utils/live-draw";
import type { LoyaltyActor } from "../src/features/star-friends/lib/actor";

let failures = 0;
function check(label: string, isOk: boolean) {
  if (!isOk) failures++;
  console.log(`${isOk ? "✅" : "❌"} ${label}`);
}

const TEST_PHONE_PREFIX = "5500999";
const actor: LoyaltyActor = { type: "SYSTEM", userId: null, name: "Teste do sorteio" };

function checkPureRules() {
  check("posição livre: sem ganhadores começa no 1º", nextFreePosition([], 3) === 1);
  check("posição livre: revogado o 2º, o próximo repõe o 2º", nextFreePosition([1, 3], 3) === 2);
  check("posição livre: todos sorteados, nada livre", nextFreePosition([1, 2, 3], 3) === null);
  check("telefone mascarado mostra DDD e 4 finais", maskPhone("558688923098") === "(86) •••••-3098");
  const now = new Date();
  check("CA-3 revogação vale até 30 minutos", isDrawRevocable({ drawnAt: new Date(now.getTime() - DRAW_REVOKE_WINDOW_MS + 5000), revokedAt: null }, now));
  check("CA-3 depois de 30 minutos não revoga", !isDrawRevocable({ drawnAt: new Date(now.getTime() - DRAW_REVOKE_WINDOW_MS - 1000), revokedAt: null }, now));
}

async function createFixture(organizationId: string) {
  const campaign = await prisma.loyaltyCampaign.create({
    data: {
      organizationId,
      name: "TESTE sorteio ao vivo (apagar)",
      isActive: false,
      startsAt: new Date(Date.now() - 86_400_000),
      endsAt: new Date(Date.now() + 86_400_000),
      rulesSummary: "Campanha descartável do script de conferência do sorteio ao vivo.",
      rulesVersion: "test",
      prizeCount: 3,
      lastSweepAt: new Date(),
    },
  });
  // Quatro participantes: o primeiro com 3 números, os outros com 1.
  const memberIds: string[] = [];
  for (let memberIndex = 0; memberIndex < 4; memberIndex++) {
    const member = await prisma.loyaltyMember.create({
      data: { organizationId, phone: `${TEST_PHONE_PREFIX}${String(memberIndex).padStart(5, "0")}`, name: `Participante Teste ${memberIndex + 1}` },
    });
    memberIds.push(member.id);
    const receipt = await prisma.loyaltyReceipt.create({
      data: {
        organizationId,
        campaignId: campaign.id,
        memberId: member.id,
        messageId: `test-live-draw-${campaign.id}-${memberIndex}`,
        status: "ACCEPTED",
        totalCents: 10_000,
        createdAt: new Date(Date.now() - 60_000),
      },
    });
    const numbersCount = memberIndex === 0 ? 3 : 1;
    for (let numberIndex = 0; numberIndex < numbersCount; numberIndex++) {
      await prisma.loyaltyLuckyNumber.create({
        data: { campaignId: campaign.id, memberId: member.id, receiptId: receipt.id, code: `9${memberIndex}${numberIndex}000` },
      });
    }
  }
  return { campaignId: campaign.id, memberIds };
}

async function checkDrawFlow(organizationId: string) {
  const { campaignId, memberIds } = await createFixture(organizationId);
  try {
    const pool = await getCampaignDrawPool({ organizationId, campaignId });
    check("lista do telão: 6 números de 4 participantes, telefone mascarado", pool.totalNumbers === 6 && pool.totalParticipants === 4 && pool.entries.every((entry) => entry.maskedPhone.includes("•")));

    const first = await drawNextWinner({ organizationId, campaignId, actor });
    const second = await drawNextWinner({ organizationId, campaignId, actor });
    check("CA-1 sorteia um por vez, nas posições 1 e 2", first.ok && second.ok && first.draw.position === 1 && second.draw.position === 2);
    const campaignAfterFirst = await prisma.loyaltyCampaign.findUniqueOrThrow({ where: { id: campaignId } });
    check("CA-1 campanha fecha para cupons e ainda não está concluída", !campaignAfterFirst.isActive && campaignAfterFirst.drawnAt === null);
    const firstWinners = await prisma.loyaltyCampaignDraw.findMany({ where: { campaignId, revokedAt: null } });
    check("CA-2 cada pessoa ganha no máximo uma vez", new Set(firstWinners.map((draw) => draw.memberId)).size === firstWinners.length);
    check("CA-1 o sorteio grava semente e tamanho da lista", firstWinners.every((draw) => draw.seed.length === 64 && draw.poolSize > 0));

    if (second.ok) {
      const revoked = await revokeCampaignDraw({ organizationId, drawId: second.draw.id, reason: "teste", actor });
      check("CA-3 revoga dentro do prazo", revoked.ok);
      const revokedAgain = await revokeCampaignDraw({ organizationId, drawId: second.draw.id, reason: null, actor });
      check("CA-3 segunda revogação do mesmo sorteio é recusada", !revokedAgain.ok && revokedAgain.reason === "already_revoked");
      const freedNumber = await prisma.loyaltyLuckyNumber.findFirst({ where: { campaignId, code: second.draw.code } });
      check("CA-3 número revogado volta a concorrer", freedNumber?.drawPosition === null);
    }

    const third = await drawNextWinner({ organizationId, campaignId, actor });
    check("CA-3 depois da revogação, o próximo sorteio repõe o 2º prêmio", third.ok && third.draw.position === 2);
    const fourth = await drawNextWinner({ organizationId, campaignId, actor });
    check("CA-1 o 3º prêmio conclui o sorteio", fourth.ok && fourth.draw.position === 3 && fourth.isComplete);
    const fifth = await drawNextWinner({ organizationId, campaignId, actor });
    check("CA-1 sorteio concluído recusa novo número", !fifth.ok && fifth.reason === "already_drawn");

    const lowered = await setCampaignPrizeCount({ organizationId, campaignId, prizeCount: 2, actor });
    check("CA-4 não diminui abaixo das posições já sorteadas", !lowered.ok && lowered.reason === "prize_below_winners");
    const raised = await setCampaignPrizeCount({ organizationId, campaignId, prizeCount: 4, actor });
    const campaignAfterRaise = await prisma.loyaltyCampaign.findUniqueOrThrow({ where: { id: campaignId } });
    check("CA-4 aumentar a quantidade reabre o sorteio", raised.ok && campaignAfterRaise.drawnAt === null);
    const lastOne = await drawNextWinner({ organizationId, campaignId, actor });
    check("CA-1 o 4º prêmio sai para o único participante que faltava", lastOne.ok && lastOne.draw.position === 4);

    const stale = await prisma.loyaltyCampaignDraw.create({
      data: {
        campaignId,
        position: 99,
        code: "000000",
        memberName: "Antigo",
        memberPhone: "5500",
        seed: "x",
        poolSize: 1,
        actorName: "Teste",
        drawnAt: new Date(Date.now() - DRAW_REVOKE_WINDOW_MS - 60_000),
      },
    });
    const expired = await revokeCampaignDraw({ organizationId, drawId: stale.id, reason: null, actor });
    check("CA-3 sorteio de mais de 30 minutos não revoga", !expired.ok && expired.reason === "revoke_expired");

    const winnerMemberIds = new Set((await prisma.loyaltyCampaignDraw.findMany({ where: { campaignId, revokedAt: null } })).map((draw) => draw.memberId));
    check("todos os 4 participantes saíram uma vez", memberIds.every((memberId) => winnerMemberIds.has(memberId)));
  } finally {
    await prisma.loyaltyCampaign.delete({ where: { id: campaignId } });
    await prisma.loyaltyMember.deleteMany({ where: { id: { in: memberIds } } });
  }
}

async function main() {
  checkPureRules();
  const organization = await prisma.organization.findFirst({ select: { id: true } });
  if (!organization) throw new Error("Banco local sem organização");
  await checkDrawFlow(organization.id);
  const leftovers = await prisma.loyaltyMember.count({ where: { phone: { startsWith: TEST_PHONE_PREFIX } } });
  check("nada do teste ficou no banco", leftovers === 0);
  console.log(failures === 0 ? "\nTudo certo." : `\n${failures} falha(s).`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  // O log de atividades deixa conexões abertas; o script encerra sozinho no fim.
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
