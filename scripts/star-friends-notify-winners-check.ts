// Conferência do aviso aos ganhadores (spec 0148) contra o banco local: monta as mensagens, barra
// prêmio sem nome, recusa revogar quem já foi avisado e cria só dados descartáveis, apagados no fim.
// Não envia nada pelo WhatsApp: a campanha de teste não tem número. Nunca rode contra produção.
//
//   pnpm tsx --conditions=react-server scripts/star-friends-notify-winners-check.ts

import "dotenv/config";
import prisma from "../src/lib/prisma";
import { revokeCampaignDraw } from "../src/features/star-friends/lib/campaign/draw";
import { notifyCampaignWinners } from "../src/features/star-friends/lib/campaign/notify-winners";
import { positionsMissingPrize, renderTemplateBody, winnerVariableValues, type WinnerVariable } from "../src/features/star-friends/utils/winner-notice";
import type { LoyaltyActor } from "../src/features/star-friends/lib/actor";

let failures = 0;
function check(label: string, isOk: boolean) {
  if (!isOk) failures++;
  console.log(`${isOk ? "✅" : "❌"} ${label}`);
}

const actor: LoyaltyActor = { type: "SYSTEM", userId: null, name: "Teste do aviso" };
const BODY = "Olá, {{1}}! Seu número {{2}} ganhou {{3}}. Retire até {{4}}.";
const VARIABLES: WinnerVariable[] = [{ source: "first_name" }, { source: "code" }, { source: "prize" }, { source: "fixed", fixedText: "12/12/2026" }];

function checkPureRules() {
  const winner = { position: 2, code: "0443768", name: "Maria da Silva" };
  const values = winnerVariableValues({ variables: VARIABLES, winner, campaignName: "Black Friday", prizeNames: ["Cesta", "Vale R$ 100"] });
  check(
    "CA-1 cada variável recebe nome, número, prêmio da posição e texto fixo",
    renderTemplateBody(BODY, values) === "Olá, Maria! Seu número 0443768 ganhou Vale R$ 100. Retire até 12/12/2026.",
  );
  const missing = positionsMissingPrize({
    variables: VARIABLES,
    winners: [{ position: 1, code: "1", name: "A" }, winner],
    prizeNames: ["Cesta", "  "],
  });
  check("CA-3 prêmio em branco na 2ª posição bloqueia o envio", missing.length === 1 && missing[0] === 2);
  check(
    "modelo sem a variável de prêmio não exige nomes",
    positionsMissingPrize({ variables: [{ source: "full_name" }], winners: [winner], prizeNames: [] }).length === 0,
  );
}

async function checkWithDatabase(organizationId: string) {
  const campaign = await prisma.loyaltyCampaign.create({
    data: {
      organizationId,
      name: "TESTE aviso aos ganhadores (apagar)",
      startsAt: new Date(Date.now() - 86_400_000),
      endsAt: new Date(Date.now() + 86_400_000),
      rulesSummary: "Campanha descartável do script de conferência do aviso aos ganhadores.",
      rulesVersion: "test",
      prizeCount: 2,
    },
  });
  try {
    const drawBase = { campaignId: campaign.id, seed: "test", poolSize: 2, actorName: "Teste" };
    const notified = await prisma.loyaltyCampaignDraw.create({
      data: { ...drawBase, position: 1, code: "0001", memberName: "Avisado Teste", memberPhone: "5500999000001", notifiedAt: new Date() },
    });
    await prisma.loyaltyCampaignDraw.create({
      data: { ...drawBase, position: 2, code: "0002", memberName: "Revogado Teste", memberPhone: "5500999000002", revokedAt: new Date(), revokedByName: "Teste" },
    });

    const revoke = await revokeCampaignDraw({ organizationId, drawId: notified.id, reason: null, actor });
    check("CA-4 ganhador avisado não é revogado", !revoke.ok && revoke.reason === "already_notified");

    const withoutTracking = await notifyCampaignWinners({
      organizationId,
      campaignId: campaign.id,
      templateName: "teste",
      languageCode: "pt_BR",
      variables: VARIABLES,
      prizeNames: [],
      actor,
    });
    check("CA-6 campanha sem funil explica o motivo e não envia", !withoutTracking.ok && withoutTracking.reason === "no_tracking");

    const otherOrganization = await notifyCampaignWinners({
      organizationId: "organizacao-que-nao-existe",
      campaignId: campaign.id,
      templateName: "teste",
      languageCode: "pt_BR",
      variables: VARIABLES,
      prizeNames: [],
      actor,
    });
    check("RNF-3 outra empresa não acha a campanha", !otherOrganization.ok && otherOrganization.reason === "not_found");

    const pending = await prisma.loyaltyCampaignDraw.count({ where: { campaignId: campaign.id, revokedAt: null, notifiedAt: null } });
    check("CA-2 e CA-5 avisado e revogado não entram na lista de envio", pending === 0);
  } finally {
    await prisma.loyaltyCampaign.delete({ where: { id: campaign.id } });
  }
}

async function main() {
  checkPureRules();
  const organization = await prisma.organization.findFirst({ select: { id: true } });
  if (!organization) throw new Error("Banco local sem organização");
  await checkWithDatabase(organization.id);
  const leftovers = await prisma.loyaltyCampaign.count({ where: { name: "TESTE aviso aos ganhadores (apagar)" } });
  check("nada do teste ficou no banco", leftovers === 0);
  console.log(failures === 0 ? "\nTudo certo." : `\n${failures} falha(s).`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
