import "server-only";
import prisma from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { MetaPublishAccountKind, MetaPublishAccountStatus } from "@/generated/prisma/enums";
import {
  createGatewayForCredentials,
  generateWebhookPathToken,
  socialLogger,
  socialRepositoriesForOrganization,
} from "@/modules/social";
import { connectChannel } from "@/modules/social/application/connect-channel";
import { InvalidCredentialsError } from "@/modules/social/domain/errors";

/** Comments conectado pela conexão da Meta da org (spec 0061): usa o token de página guardado em MetaPublishAccount. */

/** A plataforma recebe eventos só com as duas envs (RNF-1); sem elas o botão avisa em vez de conectar no escuro. */
export function isMetaCommentsWebhookConfigured(): boolean {
  return Boolean(process.env.META_APP_SECRET && process.env.META_WEBHOOK_VERIFY_TOKEN);
}

export async function listMetaInstagramAccounts(organizationId: string) {
  const accounts = await prisma.metaPublishAccount.findMany({
    where: { organizationId, kind: MetaPublishAccountKind.IG_BUSINESS, status: MetaPublishAccountStatus.ACTIVE, igUserId: { not: null } },
    select: { id: true, igUserId: true, igUsername: true, profilePictureUrl: true, pageName: true },
    orderBy: { createdAt: "asc" },
  });
  return {
    accounts: accounts.map((account) => ({
      id: account.id,
      igUserId: account.igUserId!,
      username: account.igUsername,
      profilePictureUrl: account.profilePictureUrl,
      pageName: account.pageName,
    })),
    isPlatformWebhookReady: isMetaCommentsWebhookConfigured(),
  };
}

export async function connectCommentsWithMetaAccount(input: {
  organizationId: string;
  userId: string;
  metaPublishAccountId?: string;
}) {
  const accounts = await prisma.metaPublishAccount.findMany({
    where: {
      organizationId: input.organizationId,
      kind: MetaPublishAccountKind.IG_BUSINESS,
      status: MetaPublishAccountStatus.ACTIVE,
      igUserId: { not: null },
      ...(input.metaPublishAccountId && { id: input.metaPublishAccountId }),
    },
    select: { igUserId: true, pageId: true, accessTokenEnc: true },
  });
  if (accounts.length === 0) {
    throw new InvalidCredentialsError("Nenhum Instagram conectado na Meta desta empresa. Conecte a Meta nos Satélites primeiro.");
  }
  if (accounts.length > 1) {
    throw new InvalidCredentialsError("Esta empresa tem mais de um Instagram na Meta. Escolha qual vai responder os comentários.");
  }

  const [account] = accounts;
  const igUserId = account.igUserId!;
  const accessToken = decryptSecret(account.accessTokenEnc);
  const { channels, automations } = socialRepositoriesForOrganization(input.organizationId);

  return connectChannel(
    {
      provider: "INSTAGRAM",
      externalAccountId: igUserId,
      credentials: { authMode: "META_LOGIN", accessToken, appSecret: "", verifyToken: "", pageId: account.pageId },
      connectedById: input.userId,
    },
    {
      channels,
      automations,
      gateway: createGatewayForCredentials("INSTAGRAM", igUserId, accessToken, { pageId: account.pageId }),
      generateWebhookPathToken,
    },
  );
}

/**
 * Reconectar a Meta nos Satélites troca o token de página (RF-6). Best-effort: falha aqui
 * não pode desfazer a conexão da Meta que acabou de dar certo.
 */
export async function refreshMetaLinkedCommentsChannel(organizationId: string): Promise<void> {
  try {
    const { channels } = socialRepositoriesForOrganization(organizationId);
    const channel = await channels.findWithCredentials();
    if (!channel || channel.credentials.authMode !== "META_LOGIN") return;

    const account = await prisma.metaPublishAccount.findFirst({
      where: { organizationId, kind: MetaPublishAccountKind.IG_BUSINESS, igUserId: channel.externalAccountId, status: MetaPublishAccountStatus.ACTIVE },
      select: { id: true },
    });
    if (!account) return;

    await connectCommentsWithMetaAccount({ organizationId, userId: "", metaPublishAccountId: account.id });
  } catch (error) {
    socialLogger.warn("Não deu para atualizar o token do Comments pela Meta", {
      organizationId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
