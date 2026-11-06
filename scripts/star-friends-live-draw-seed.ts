// Prepara a campanha do banco LOCAL para ensaiar o sorteio ao vivo (spec 0134): cria participantes
// fictícios com números da sorte, faz a campanha passar na varredura e zera sorteios anteriores.
// Com --remove, apaga os fictícios e os sorteios. Nunca rode contra produção.
//
//   pnpm tsx scripts/star-friends-live-draw-seed.ts "MERCADINHO PREÇO BAIXO" 40
//   pnpm tsx scripts/star-friends-live-draw-seed.ts "MERCADINHO PREÇO BAIXO" --remove

import "dotenv/config";
import prisma from "../src/lib/prisma";

const FAKE_PHONE_PREFIX = "5500998";
const FIRST_NAMES = ["Ana", "Bruno", "Carla", "Diego", "Elaine", "Fábio", "Gabriela", "Heitor", "Isabela", "João", "Karina", "Lucas", "Mariana", "Natan", "Olívia", "Paulo", "Rafael", "Sabrina", "Tiago", "Vitor"];
const LAST_NAMES = ["Souza", "Lima", "Mendes", "Alves", "Costa", "Rocha", "Nunes", "Dias", "Freitas", "Pereira", "Moura", "Barros"];

async function main() {
  const [organizationName, countOrFlag] = process.argv.slice(2);
  const databaseUrl = process.env.DATABASE_URL ?? "";
  if (!/localhost|127\.0\.0\.1/.test(databaseUrl)) throw new Error("Este script só roda contra banco local.");
  if (!organizationName) throw new Error('Informe o nome da empresa. Ex.: "MERCADINHO PREÇO BAIXO" 40');

  const organization = await prisma.organization.findFirst({ where: { name: organizationName }, select: { id: true } });
  if (!organization) throw new Error(`Empresa "${organizationName}" não encontrada.`);
  const campaign = await prisma.loyaltyCampaign.findFirst({ where: { organizationId: organization.id }, orderBy: { createdAt: "desc" } });
  if (!campaign) throw new Error("A empresa não tem campanha.");

  await prisma.loyaltyCampaignDraw.deleteMany({ where: { campaignId: campaign.id } });
  await prisma.loyaltyLuckyNumber.updateMany({ where: { campaignId: campaign.id }, data: { drawPosition: null } });
  await prisma.loyaltyMember.deleteMany({ where: { organizationId: organization.id, phone: { startsWith: FAKE_PHONE_PREFIX } } });

  if (countOrFlag === "--remove") {
    await prisma.loyaltyCampaign.update({ where: { id: campaign.id }, data: { drawnAt: null, drawSeed: null, winnerNumberId: null } });
    console.log(`Participantes fictícios e sorteios de "${campaign.name}" removidos.`);
    return;
  }

  const participantsCount = Math.min(500, Math.max(1, Number(countOrFlag) || 40));
  for (let participantIndex = 0; participantIndex < participantsCount; participantIndex++) {
    const name = `${FIRST_NAMES[participantIndex % FIRST_NAMES.length]} ${LAST_NAMES[(participantIndex * 7) % LAST_NAMES.length]} (teste)`;
    const member = await prisma.loyaltyMember.create({
      data: { organizationId: organization.id, phone: `${FAKE_PHONE_PREFIX}${String(participantIndex).padStart(5, "0")}`, name },
    });
    await prisma.loyaltyCampaignEntry.create({
      data: { campaignId: campaign.id, memberId: member.id, registeredPhone: member.phone, acceptedRulesVersion: campaign.rulesVersion },
    });
    const receipt = await prisma.loyaltyReceipt.create({
      data: {
        organizationId: organization.id,
        campaignId: campaign.id,
        memberId: member.id,
        messageId: `seed-live-draw-${member.id}`,
        status: "ACCEPTED",
        totalCents: 10_000 * (1 + (participantIndex % 3)),
        createdAt: new Date(Date.now() - 60 * 60 * 1000),
      },
    });
    for (let numberIndex = 0; numberIndex <= participantIndex % 3; numberIndex++) {
      await prisma.loyaltyLuckyNumber.create({
        data: { campaignId: campaign.id, memberId: member.id, receiptId: receipt.id, code: `8${String(participantIndex).padStart(3, "0")}${numberIndex}0` },
      });
    }
  }
  await prisma.loyaltyCampaign.update({
    where: { id: campaign.id },
    data: { lastSweepAt: new Date(), drawnAt: null, drawSeed: null, winnerNumberId: null, prizeCount: Math.max(campaign.prizeCount, 15) },
  });
  console.log(`"${campaign.name}": ${participantsCount} participantes fictícios criados, varredura marcada e sorteios zerados.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
