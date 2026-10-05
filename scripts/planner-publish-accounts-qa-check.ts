// Conferência da spec 0071 (Planner publica pelas contas dos Satélites) contra
// o Postgres local, com a rede simulada. Não há runner de testes no projeto
// (CLAUDE.md, regra 20): cada CA-n / CB-n vira uma asserção aqui.
// Cria duas empresas descartáveis e apaga tudo no fim.
//
//   pnpm tsx --conditions=react-server scripts/planner-publish-accounts-qa-check.ts

import "dotenv/config";
import prisma from "../src/lib/prisma";
import { tenantScope } from "../src/modules/shared/domain/tenant-scope";
import { createSocialRepositories } from "../src/modules/social";
import {
  isCredentialRenewalDue,
  refreshChannelCapabilities,
  renewChannelCredentials,
} from "../src/modules/social/application/maintain-channel";
import {
  ContentPublishError,
  type ChannelCapabilities,
  type ContentPublisher,
  type CredentialRenewal,
} from "../src/modules/social/ports/content-publisher";
import {
  CANNOT_PUBLISH_MESSAGE,
  CHOOSE_ACCOUNT_MESSAGE,
  DISABLED_ACCOUNT_MESSAGE,
  findDefaultInstagramAccountId,
  loadInstagramPublisher,
  MISSING_ACCOUNT_MESSAGE,
  NO_ACCOUNT_MESSAGE,
  PublishAccountUnavailableError,
  resolveInstagramTarget,
} from "../src/features/nasa-planner/server/publishing/instagram-channels";
import { listPublishAccounts } from "../src/features/nasa-planner/server/publishing/publish-accounts";
import { classifyPublishError } from "../src/features/nasa-planner/server/publishing/meta-errors";
import { encryptSecret } from "../src/lib/crypto";

const RUN_ID = `qa0071-${Date.now()}`;
const DAY_MS = 24 * 60 * 60 * 1000;
const failures: string[] = [];
let assertionCount = 0;

function check(criterion: string, description: string, isOk: boolean) {
  assertionCount += 1;
  console.log(`  ${isOk ? "✅" : "❌"} ${criterion} — ${description}`);
  if (!isOk) failures.push(`${criterion} — ${description}`);
}

async function createOrganization(label: string) {
  return prisma.organization.create({
    data: { name: `QA 0071 ${label}`, slug: `${RUN_ID}-${label}`, createdAt: new Date() },
    select: { id: true },
  });
}

function channelsOf(organizationId: string) {
  return createSocialRepositories(tenantScope(organizationId)).channels;
}

async function connectAccount(organizationId: string, externalAccountId: string, handle: string, metaLoginPageId?: string) {
  const { channel } = await channelsOf(organizationId).connect({
    provider: "INSTAGRAM",
    externalAccountId,
    handle,
    credentials: metaLoginPageId
      ? { authMode: "META_LOGIN", accessToken: `token-${handle}`, appSecret: "", verifyToken: "", pageId: metaLoginPageId }
      : { accessToken: `token-${handle}`, appSecret: "a".repeat(32), verifyToken: `verify-${handle}` },
    webhookPathToken: `${RUN_ID}-${handle}`,
  });
  return channel;
}

/** Publicador falso: só `checkCapabilities` responde; o resto não é chamado nestes casos. */
function fakePublisher(capabilities: ChannelCapabilities): ContentPublisher {
  return { checkCapabilities: async () => capabilities } as unknown as ContentPublisher;
}

const problemOf = async (organizationId: string, requestedExternalId: string | null) => {
  const resolution = await resolveInstagramTarget(organizationId, requestedExternalId);
  return resolution.ok ? null : resolution.problem;
};

async function main() {
  const organization = await createOrganization("principal");
  const otherOrganization = await createOrganization("outra");
  const organizationId = organization.id;
  const channels = channelsOf(organizationId);

  try {
    console.log("\nDe onde vêm as contas do Planner");
    check("CA-5", "empresa só com conta de publicação da Meta, sem conta nos Satélites, não tem Instagram no Planner", await (async () => {
      await prisma.metaPublishAccount.create({
        data: { organizationId, kind: "IG_BUSINESS", pageId: `${RUN_ID}-page`, igUserId: `${RUN_ID}-meta-ig`, igUsername: "so_na_meta", accessTokenEnc: encryptSecret("page-token") },
      });
      const accounts = await listPublishAccounts([organizationId]);
      return accounts.length === 0 && (await problemOf(organizationId, null)) === NO_ACCOUNT_MESSAGE;
    })());

    const matriz = await connectAccount(organizationId, `${RUN_ID}-matriz`, `${RUN_ID}_matriz`);
    check("CB-2", "com uma conta só, post sem conta escolhida usa essa conta",
      (await findDefaultInstagramAccountId(organizationId)) === matriz.externalAccountId);

    const filial = await connectAccount(organizationId, `${RUN_ID}-filial`, `${RUN_ID}_filial`, `${RUN_ID}-page-filial`);
    const listedAccounts = await listPublishAccounts([organizationId]);
    check("CA-4", "as duas contas dos Satélites (formulário e Meta) aparecem para o Planner, com o ID da rede",
      listedAccounts.length === 2 && listedAccounts.every((account) => account.kind === "IG_BUSINESS") &&
      listedAccounts.map((account) => account.igUserId).sort().join() === [matriz.externalAccountId, filial.externalAccountId].sort().join());
    check("CB-3", "com várias contas, post sem conta escolhida não publica nem escolhe sozinho",
      (await problemOf(organizationId, null)) === CHOOSE_ACCOUNT_MESSAGE && (await findDefaultInstagramAccountId(organizationId)) === null);
    check("CB-1", "post apontando para conta que não está nos Satélites pede a escolha de novo",
      (await problemOf(organizationId, `${RUN_ID}-meta-ig`)) === MISSING_ACCOUNT_MESSAGE);

    console.log("\nIsolamento entre empresas");
    const foreignAccount = await connectAccount(otherOrganization.id, `${RUN_ID}-alheia`, `${RUN_ID}_alheia`);
    check("CA-11", "conta de outra empresa nunca é resolvida para o post",
      (await problemOf(organizationId, foreignAccount.externalAccountId)) === MISSING_ACCOUNT_MESSAGE &&
      (await loadInstagramPublisher(organizationId, foreignAccount.id).then(() => false).catch((error) => error instanceof PublishAccountUnavailableError)));

    console.log("\nPlano sem token");
    const resolution = await resolveInstagramTarget(organizationId, matriz.externalAccountId);
    check("CA-13", "o destino resolvido leva só ids, nunca token",
      resolution.ok && Object.keys(resolution).sort().join() === "channelId,externalAccountId,ok" && !JSON.stringify(resolution).includes("token-"));

    console.log("\nCapacidades da conta");
    await refreshChannelCapabilities(matriz.id, { channels, createPublisher: () => fakePublisher({ canPublish: false, canReadInsights: true, isCredentialRejected: false }) });
    check("CA-6", "token sem permissão de publicar marca a conta como 'não publica' e bloqueia o post",
      (await channels.findById(matriz.id))?.canPublish === false && (await problemOf(organizationId, matriz.externalAccountId)) === CANNOT_PUBLISH_MESSAGE &&
      (await listPublishAccounts([organizationId])).find((account) => account.id === matriz.id)?.canPublish === false);
    await refreshChannelCapabilities(matriz.id, { channels, createPublisher: () => fakePublisher({ canPublish: true, canReadInsights: false, isCredentialRejected: false }) });
    check("CB-8", "sem permissão de métricas a conta continua publicando",
      (await channels.findById(matriz.id))?.canReadInsights === false && (await problemOf(organizationId, matriz.externalAccountId)) === null);
    check("CB-7", "conta ainda não conferida pode ser escolhida",
      (await channels.findById(filial.id))?.canPublish === null && (await problemOf(organizationId, filial.externalAccountId)) === null);
    await refreshChannelCapabilities(filial.id, { channels, createPublisher: () => fakePublisher({ canPublish: null, canReadInsights: null, isCredentialRejected: true }) });
    check("RF-10", "credencial recusada na conferência vira 'precisa reconectar'", (await channels.findById(filial.id))?.status === "NEEDS_RECONNECT");
    await channels.markActive(filial.id);

    console.log("\nRenovação do token");
    const now = new Date();
    check("CA-8", "vence em 9 dias: renova; vence em 30 dias: não; validade desconhecida: tenta",
      isCredentialRenewalDue(new Date(now.getTime() + 9 * DAY_MS), now) && !isCredentialRenewalDue(new Date(now.getTime() + 30 * DAY_MS), now) && isCredentialRenewalDue(null, now));
    const renewedExpiry = new Date(now.getTime() + 60 * DAY_MS);
    const okRenewal: CredentialRenewal = { ok: true, accessToken: "token-renovado", expiresAt: renewedExpiry };
    const firstRenewal = await renewChannelCredentials(matriz.id, { channels, renewer: { renew: async () => okRenewal }, now: () => now });
    const renewedChannel = await channels.findWithCredentialsById(matriz.id);
    check("CA-8", "o token renovado substitui o antigo, mantém app secret e verify token e grava a validade",
      firstRenewal.status === "renewed" && renewedChannel?.credentials.accessToken === "token-renovado" &&
      renewedChannel.credentials.appSecret === "a".repeat(32) && renewedChannel.credentials.verifyToken.startsWith("verify-") &&
      (await channels.findById(matriz.id))?.credentialsExpiresAt?.getTime() === renewedExpiry.getTime());
    const notDueRenewal = await renewChannelCredentials(matriz.id, { channels, renewer: { renew: async () => { throw new Error("não deveria chamar"); } }, now: () => now });
    check("CA-8", "com 60 dias de validade a rotina não chama a rede", notDueRenewal.status === "skipped");
    const metaRenewal = await renewChannelCredentials(filial.id, { channels, renewer: { renew: async () => okRenewal }, now: () => now });
    check("D-4", "conta conectada pela Meta não entra na renovação", metaRenewal.status === "skipped");

    const rejectedRenewal: CredentialRenewal = { ok: false, error: "token inválido", isCredentialRejected: true };
    const nearExpiry = new Date(renewedExpiry.getTime() - 5 * DAY_MS);
    const rejected = await renewChannelCredentials(matriz.id, { channels, renewer: { renew: async () => rejectedRenewal }, now: () => nearExpiry });
    check("CA-9", "renovação recusada com validade conhecida vira 'precisa reconectar'",
      rejected.status === "needs-reconnect" && (await channels.findById(matriz.id))?.status === "NEEDS_RECONNECT");

    const young = await connectAccount(organizationId, `${RUN_ID}-nova`, `${RUN_ID}_nova`);
    const youngRenewal = await renewChannelCredentials(young.id, { channels, renewer: { renew: async () => rejectedRenewal }, now: () => now });
    check("CB-6", "token recém-colado (validade desconhecida) com renovação recusada não derruba a conta",
      youngRenewal.status === "failed" && (await channels.findById(young.id))?.status === "ACTIVE");

    console.log("\nTrocar a credencial zera o que foi conferido");
    await connectAccount(organizationId, matriz.externalAccountId, `${RUN_ID}_matriz`);
    const reconnected = await channels.findById(matriz.id);
    check("RF-6", "credencial nova volta validade e permissões para 'a conferir'",
      reconnected?.status === "ACTIVE" && reconnected.canPublish === null && reconnected.canReadInsights === null && reconnected.credentialsExpiresAt === null);

    console.log("\nConta desativada e erros");
    await channels.disconnect(matriz.id);
    check("CA-10", "post agendado para conta desativada falha com mensagem clara, sem nova tentativa",
      (await problemOf(organizationId, matriz.externalAccountId)) === DISABLED_ACCOUNT_MESSAGE &&
      (await loadInstagramPublisher(organizationId, matriz.id).then(() => null).catch((error) => classifyPublishError(error)))?.isRetryable === false);
    check("RF-13", "conta desativada some da lista do Planner",
      !(await listPublishAccounts([organizationId])).some((account) => account.id === matriz.id));
    const expiredToken = classifyPublishError(new ContentPublishError("Error validating access token", 190, null, false));
    const publishLimit = classifyPublishError(new ContentPublishError("limit", 9, 2207042, false));
    check("RF-10", "token recusado na publicação pede reconexão e não tenta de novo", expiredToken.needsReconnect && !expiredToken.isRetryable);
    check("CB-9", "limite diário de publicações falha sem marcar a conta para reconectar", publishLimit.code === "PUBLISH_LIMIT" && !publishLimit.needsReconnect && !publishLimit.isRetryable);
    check("RNF-4", "instabilidade da rede continua sendo tentada de novo", classifyPublishError(new ContentPublishError("temporário", 2, null, true)).isRetryable);
  } finally {
    // Cascade em Organization leva contas e contas de publicação de teste.
    await prisma.organization.deleteMany({ where: { id: { in: [organization.id, otherOrganization.id] } } });
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
