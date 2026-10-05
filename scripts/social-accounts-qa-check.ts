// Conferência da spec 0069 (várias contas do Instagram por empresa) contra o
// Postgres local. Não há runner de testes no projeto (CLAUDE.md, regra 20):
// cada CA-n / CB-n vira uma asserção aqui. Cria duas empresas descartáveis e
// apaga tudo no fim; o gateway é falso, então nada sai para a Meta.
//
//   pnpm tsx --conditions=react-server scripts/social-accounts-qa-check.ts

import "dotenv/config";
import prisma from "../src/lib/prisma";
import { tenantScope } from "../src/modules/shared/domain/tenant-scope";
import { channelLookup, createSocialRepositories } from "../src/modules/social";
import {
  connectChannel,
  MAX_CHANNELS_PER_PROVIDER,
  reconnectChannel,
} from "../src/modules/social/application/connect-channel";
import { setAutomationActive } from "../src/modules/social/application/activate-automation";
import { SocialErrorCode } from "../src/modules/social/domain/errors";
import { isDomainError } from "../src/modules/shared/domain/domain-error";
import type { ChannelGateway } from "../src/modules/social/ports/channel-gateway";
import { getInstagramLeadTracking, setInstagramLeadTracking } from "../src/features/comments/server/lead-tracking";

const RUN_ID = `qa0069-${Date.now()}`;
const failures: string[] = [];
let assertionCount = 0;

function check(criterion: string, description: string, isOk: boolean) {
  assertionCount += 1;
  if (isOk) {
    console.log(`  ✅ ${criterion} — ${description}`);
  } else {
    failures.push(`${criterion} — ${description}`);
    console.log(`  ❌ ${criterion} — ${description}`);
  }
}

async function domainErrorCodeOf(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (error) {
    if (isDomainError(error)) return error.code;
    throw error;
  }
}

/** Gateway falso: devolve o perfil configurado e nunca chama a Meta. */
function fakeGateway(profileAccountId: string | null): ChannelGateway {
  return {
    sendDirectMessage: async () => ({ ok: true }),
    replyToComment: async () => ({ ok: true }),
    listContent: async () => ({ items: [] }),
    fetchAccountProfile: async () =>
      profileAccountId ? { externalAccountId: profileAccountId, handle: `conta_${profileAccountId.slice(-4)}` } : null,
    subscribeToEvents: async () => ({ ok: true }),
    listSubscribedFields: async () => ["comments", "messages"],
  };
}

let webhookTokenSequence = 0;
const generateWebhookPathToken = () => `${RUN_ID}-token-${(webhookTokenSequence += 1)}`;

function accountIdOf(suffix: number): string {
  return `1784${RUN_ID.replace(/\D/g, "").slice(-9)}${String(suffix).padStart(4, "0")}`;
}

async function createOrganization(label: string) {
  return prisma.organization.create({
    data: { name: `QA 0069 ${label}`, slug: `${RUN_ID}-${label}`, createdAt: new Date() },
    select: { id: true },
  });
}

async function main() {
  const organizationA = await createOrganization("a");
  const organizationB = await createOrganization("b");
  const repositoriesA = createSocialRepositories(tenantScope(organizationA.id));
  const repositoriesB = createSocialRepositories(tenantScope(organizationB.id));

  const connectIn = (
    repositories: typeof repositoriesA,
    externalAccountId: string,
    accessToken: string,
    profileAccountId: string | null = externalAccountId,
  ) =>
    connectChannel(
      {
        provider: "INSTAGRAM",
        externalAccountId,
        credentials: { accessToken, appSecret: "a".repeat(32), verifyToken: `verify-${externalAccountId}` },
      },
      { channels: repositories.channels, gateway: fakeGateway(profileAccountId), generateWebhookPathToken },
    );

  const saveReadyTrigger = (repositories: typeof repositoriesA, automationId: string) =>
    repositories.automations.upsertTrigger({
      automationId,
      eventType: "COMMENT_CREATED",
      targetScope: "ALL_CONTENT",
      matchLogic: "ANY_RULE",
      targets: [],
      rules: [{ kind: "INCLUDE", operator: "ANY_TEXT", terms: [] }],
      steps: [{ kind: "SEND_DIRECT_MESSAGE", order: 0, config: { source: "STATIC", text: "Oi!", buttons: [] } }],
    });

  try {
    console.log("\nVárias contas na mesma empresa");
    const firstAccountId = accountIdOf(1);
    const secondAccountId = accountIdOf(2);
    const first = await connectIn(repositoriesA, firstAccountId, "token-primeira-AAAA");
    const firstAutomation = await repositoriesA.automations.create({ channelId: first.channel.id, name: "Da primeira conta" });
    await saveReadyTrigger(repositoriesA, firstAutomation.id);
    const second = await connectIn(repositoriesA, secondAccountId, "token-segunda-BBBB");

    const afterSecond = await repositoriesA.channels.listForTenant("INSTAGRAM");
    const firstAfterSecond = afterSecond.find((channel) => channel.id === first.channel.id);
    check("CA-2", "adicionar a 2ª conta mantém as duas na lista", afterSecond.length === 2 && second.isNewChannel);
    check("CA-2", "1ª conta continua ativa e com a mesma URL de webhook",
      firstAfterSecond?.status === "ACTIVE" && firstAfterSecond.webhookPathToken === first.channel.webhookPathToken);
    check("CB-1", "automação da 1ª conta não foi apagada nem desativada pela chegada da 2ª",
      (await repositoriesA.automations.findById(firstAutomation.id))?.channelId === first.channel.id && firstAfterSecond?.automationCount === 1);

    const reconnectedFirst = await connectIn(repositoriesA, firstAccountId, "token-primeira-ZZZZ");
    check("CA-6", "conectar de novo a mesma conta atualiza a credencial sem criar linha",
      !reconnectedFirst.isNewChannel &&
      reconnectedFirst.channel.id === first.channel.id &&
      reconnectedFirst.channel.accessTokenLast4 === "ZZZZ" &&
      reconnectedFirst.channel.webhookPathToken === first.channel.webhookPathToken &&
      (await repositoriesA.channels.countForTenant("INSTAGRAM")) === 2);
    check("CB-1", "2ª conta segue ativa depois de reconectar a 1ª",
      (await repositoriesA.channels.findById(second.channel.id))?.status === "ACTIVE");

    console.log("\nCredencial inválida");
    const strangerAccountId = accountIdOf(3);
    check("CA-4", "token recusado pela Meta não salva nada",
      (await domainErrorCodeOf(() => connectIn(repositoriesA, strangerAccountId, "token-ruim", null))) === SocialErrorCode.INVALID_CREDENTIALS);
    check("CA-4", "token de outra conta não salva nada",
      (await domainErrorCodeOf(() => connectIn(repositoriesA, strangerAccountId, "token-alheio", secondAccountId))) === SocialErrorCode.INVALID_CREDENTIALS &&
      (await repositoriesA.channels.findByExternalAccountId("INSTAGRAM", strangerAccountId)) === null);

    const reconnectCode = await domainErrorCodeOf(() =>
      reconnectChannel(
        { channelId: first.channel.id, accessToken: "token-da-segunda" },
        { channels: repositoriesA.channels, createGateway: () => fakeGateway(secondAccountId), generateWebhookPathToken },
      ),
    );
    check("CB-8", "reconectar com token de outra conta é recusado e a conta da linha não muda",
      reconnectCode === SocialErrorCode.INVALID_CREDENTIALS &&
      (await repositoriesA.channels.findById(first.channel.id))?.externalAccountId === firstAccountId);

    console.log("\nIsolamento entre empresas");
    check("CA-5", "conta já conectada em outra empresa é recusada",
      (await domainErrorCodeOf(() => connectIn(repositoriesB, firstAccountId, "token-da-b"))) === SocialErrorCode.CHANNEL_ALREADY_TAKEN &&
      (await repositoriesB.channels.countForTenant("INSTAGRAM")) === 0);
    check("CA-17", "outra empresa não lê a conta pelo id",
      (await repositoriesB.channels.findById(first.channel.id)) === null &&
      (await repositoriesB.channels.findWithCredentialsById(first.channel.id)) === null &&
      (await repositoriesB.automations.listByChannel(first.channel.id)).length === 0);
    await repositoriesB.channels.disconnect(first.channel.id);
    check("CA-17", "outra empresa não desativa a conta pelo id",
      (await repositoriesA.channels.findById(first.channel.id))?.status === "ACTIVE");
    const foreignTrackingRead = await getInstagramLeadTracking(organizationB.id, first.channel.id).then(() => "ok").catch(() => "recusado");
    check("CA-17", "outra empresa não lê o tracking de leads da conta", foreignTrackingRead === "recusado");

    console.log("\nAutomações por conta");
    const secondAutomation = await repositoriesA.automations.create({ channelId: second.channel.id, name: "Da segunda conta" });
    await saveReadyTrigger(repositoriesA, secondAutomation.id);
    const firstList = await repositoriesA.automations.listByChannel(first.channel.id);
    const secondList = await repositoriesA.automations.listByChannel(second.channel.id);
    check("CA-13", "automação criada numa conta não aparece na outra",
      firstList.length === 1 && firstList[0].id === firstAutomation.id &&
      secondList.length === 1 && secondList[0].id === secondAutomation.id);

    await repositoriesA.channels.markNeedsReconnect(first.channel.id, "token expirado (teste)");
    await setAutomationActive({ automationId: secondAutomation.id, isActive: true }, repositoriesA);
    check("CA-14", "automação de conta ativa liga mesmo com outra conta precisando reconectar",
      (await repositoriesA.automations.findById(secondAutomation.id))?.isActive === true);
    check("CA-14", "automação da conta que precisa reconectar não liga",
      (await domainErrorCodeOf(() => setAutomationActive({ automationId: firstAutomation.id, isActive: true }, repositoriesA))) === SocialErrorCode.CHANNEL_NEEDS_RECONNECT);
    await repositoriesA.channels.markActive(first.channel.id);

    console.log("\nWebhook e tracking por conta");
    const routedToSecond = await channelLookup.findByWebhookPathToken("INSTAGRAM", second.channel.webhookPathToken);
    const routedByAccountId = await channelLookup.findByExternalAccountId("INSTAGRAM", secondAccountId);
    check("CA-3", "evento no webhook da 2ª conta cai no canal dela, na empresa certa",
      routedToSecond?.channel.id === second.channel.id &&
      routedToSecond.tenant.organizationId === organizationA.id &&
      routedByAccountId?.channel.id === second.channel.id);

    const firstTracking = await prisma.tracking.create({ data: { name: `${RUN_ID} tracking 1`, organizationId: organizationA.id }, select: { id: true } });
    const secondTracking = await prisma.tracking.create({ data: { name: `${RUN_ID} tracking 2`, organizationId: organizationA.id }, select: { id: true } });
    await setInstagramLeadTracking(organizationA.id, first.channel.id, firstTracking.id);
    await setInstagramLeadTracking(organizationA.id, second.channel.id, secondTracking.id);
    check("CA-15", "cada conta guarda o próprio tracking de leads",
      (await getInstagramLeadTracking(organizationA.id, first.channel.id)).trackingId === firstTracking.id &&
      (await getInstagramLeadTracking(organizationA.id, second.channel.id)).trackingId === secondTracking.id);

    console.log("\nDesativar e reativar");
    await repositoriesA.channels.disconnect(second.channel.id);
    const disabledSecond = await repositoriesA.channels.findById(second.channel.id);
    check("RF-6", "desativar preserva automações e URL do webhook",
      disabledSecond?.status === "DISABLED" &&
      disabledSecond.webhookPathToken === second.channel.webhookPathToken &&
      disabledSecond.automationCount === 1);
    await repositoriesA.channels.markActive(second.channel.id);
    check("CA-9", "reativar devolve a conta para ativa",
      (await repositoriesA.channels.findById(second.channel.id))?.status === "ACTIVE");

    console.log("\nLimite de contas");
    for (let suffix = 10; (await repositoriesA.channels.countForTenant("INSTAGRAM")) < MAX_CHANNELS_PER_PROVIDER; suffix += 1) {
      await connectIn(repositoriesA, accountIdOf(suffix), `token-lote-${suffix}`);
    }
    const overLimitAccountId = accountIdOf(99);
    check("CA-11", `a ${MAX_CHANNELS_PER_PROVIDER + 1}ª conta é recusada e nada é salvo`,
      (await domainErrorCodeOf(() => connectIn(repositoriesA, overLimitAccountId, "token-excedente"))) === SocialErrorCode.CHANNEL_LIMIT_REACHED &&
      (await repositoriesA.channels.countForTenant("INSTAGRAM")) === MAX_CHANNELS_PER_PROVIDER);
    check("CA-11", "no limite, reconectar uma conta existente ainda funciona",
      !(await connectIn(repositoriesA, firstAccountId, "token-primeira-FIM0")).isNewChannel);
  } finally {
    // Cascade em Organization leva canais, automações e trackings de teste.
    await prisma.organization.deleteMany({ where: { id: { in: [organizationA.id, organizationB.id] } } });
  }

  console.log(`\n${assertionCount - failures.length}/${assertionCount} asserções passaram.`);
  if (failures.length > 0) {
    console.log("Falhas:\n" + failures.map((failure) => `  - ${failure}`).join("\n"));
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
