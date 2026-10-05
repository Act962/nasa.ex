import { ORPCError } from "@orpc/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { IntegrationPlatform } from "@/generated/prisma/enums";
import {
  createChannelGateway,
  createGatewayForCredentials,
  generateWebhookPathToken,
} from "@/modules/social";
import {
  connectChannel,
  MAX_CHANNELS_PER_PROVIDER,
  reconnectChannel,
} from "@/modules/social/application/connect-channel";
import type { ChannelSummary } from "@/modules/social/ports/repositories";
import {
  connectMetaInstagramAccount,
  listMetaInstagramAccounts,
} from "@/features/social-accounts/server/meta-login-channel";
import {
  isOrgAdmin,
  repositoriesFor,
  requireOrgAdmin,
  requireOrgMember,
  webhookUrlFor,
  withDomainErrors,
} from "../comments/_shared";

/**
 * Contas de redes sociais conectadas pela organização (spec 0069).
 *
 * Cadastro único consumido por Satélites, Comments e Planner. Adapter primário
 * do módulo `src/modules/social`: nenhuma resposta leva token, app secret ou
 * verify token — só `getWebhookSetup`, restrito a admin.
 */
const socialAccountsProcedure = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware);

const channelIdInput = z.object({ channelId: z.string().min(1) });

function toPublicAccount(channel: ChannelSummary) {
  return {
    id: channel.id,
    provider: channel.provider,
    externalAccountId: channel.externalAccountId,
    handle: channel.handle,
    displayName: channel.displayName,
    status: channel.status,
    lastErrorMessage: channel.lastErrorMessage,
    lastErrorAt: channel.lastErrorAt,
    accessTokenLast4: channel.accessTokenLast4,
    authMode: channel.authMode,
    automationCount: channel.automationCount,
    connectedAt: channel.createdAt,
  };
}

async function requireChannel(organizationId: string, channelId: string) {
  const { channels } = repositoriesFor(organizationId);
  const channel = await channels.findWithCredentialsById(channelId);
  if (!channel) {
    throw new ORPCError("NOT_FOUND", { message: "Conta não encontrada." });
  }
  return { channels, channel };
}

const listAccounts = socialAccountsProcedure
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    const { channels } = repositoriesFor(context.org.id);
    const [accounts, canManage, legacyDirectMessageIntegrations] = await Promise.all([
      channels.listForTenant(),
      isOrgAdmin(context.org.id, context.user.id),
      prisma.platformIntegration.count({
        where: {
          organizationId: context.org.id,
          platform: IntegrationPlatform.INSTAGRAM,
          isActive: true,
        },
      }),
    ]);

    return {
      accounts: accounts.map(toPublicAccount),
      canManage,
      limitPerProvider: MAX_CHANNELS_PER_PROVIDER,
      // Conexão antiga do cartão "Instagram DM" (spec 0069, CB-12).
      hasLegacyDirectMessageIntegration: legacyDirectMessageIntegrations > 0,
    };
  });

const connectAccount = socialAccountsProcedure
  .input(
    z.object({
      provider: z.literal("INSTAGRAM").default("INSTAGRAM"),
      externalAccountId: z.string().trim().min(1, "Informe o ID da conta"),
      accessToken: z.string().trim().min(1, "Informe o token de acesso"),
      appSecret: z.string().trim().min(1, "Informe o app secret"),
      verifyToken: z
        .string()
        .trim()
        .min(8, "Use um verify token de 8+ caracteres"),
    }),
  )
  .handler(async ({ context, input }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    return withDomainErrors(async () => {
      const { channels } = repositoriesFor(context.org.id);

      const result = await connectChannel(
        {
          provider: input.provider,
          externalAccountId: input.externalAccountId,
          credentials: {
            accessToken: input.accessToken,
            appSecret: input.appSecret,
            verifyToken: input.verifyToken,
          },
          connectedById: context.user.id,
        },
        {
          channels,
          gateway: createGatewayForCredentials(
            input.provider,
            input.externalAccountId,
            input.accessToken,
          ),
          generateWebhookPathToken,
        },
      );

      return {
        account: toPublicAccount(result.channel),
        isNewAccount: result.isNewChannel,
        subscribed: result.subscribed,
        subscriptionError: result.subscriptionError,
      };
    });
  });

const reconnectAccount = socialAccountsProcedure
  .input(
    channelIdInput.extend({
      accessToken: z.string().trim().min(1, "Informe o token de acesso"),
      appSecret: z.string().trim().optional(),
    }),
  )
  .handler(async ({ context, input }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    return withDomainErrors(async () => {
      const { channels } = repositoriesFor(context.org.id);

      const result = await reconnectChannel(
        {
          channelId: input.channelId,
          accessToken: input.accessToken,
          appSecret: input.appSecret,
          connectedById: context.user.id,
        },
        {
          channels,
          createGateway: (externalAccountId, accessToken) =>
            createGatewayForCredentials("INSTAGRAM", externalAccountId, accessToken),
          generateWebhookPathToken,
        },
      );

      return {
        account: toPublicAccount(result.channel),
        subscribed: result.subscribed,
        subscriptionError: result.subscriptionError,
      };
    });
  });

/** Desativa a conexão preservando automações, histórico e URL do webhook. */
const disconnectAccount = socialAccountsProcedure
  .input(channelIdInput)
  .handler(async ({ context, input }) => {
    await requireOrgAdmin(context.org.id, context.user.id);
    const { channels, channel } = await requireChannel(context.org.id, input.channelId);

    await channels.disconnect(channel.id);
    return { disconnected: true };
  });

/** Religa a conexão desativada e reinscreve o app nos eventos da conta. */
const reactivateAccount = socialAccountsProcedure
  .input(channelIdInput)
  .handler(async ({ context, input }) => {
    await requireOrgAdmin(context.org.id, context.user.id);
    const { channels, channel } = await requireChannel(context.org.id, input.channelId);

    await channels.markActive(channel.id);
    const subscription = await createChannelGateway(channel).subscribeToEvents();
    return { reactivated: true, subscribed: subscription.ok };
  });

/**
 * Reenvia a inscrição do app nos eventos da conta. Assinar os campos no painel
 * da Meta não basta, e a Meta derruba a inscrição quando o token é trocado.
 */
const repairSubscription = socialAccountsProcedure
  .input(channelIdInput)
  .handler(async ({ context, input }) => {
    await requireOrgAdmin(context.org.id, context.user.id);
    const { channel } = await requireChannel(context.org.id, input.channelId);

    const gateway = createChannelGateway(channel);
    const result = await gateway.subscribeToEvents();
    const fields = await gateway.listSubscribedFields();

    return {
      subscribed: result.ok,
      fields: fields ?? [],
      error: result.ok ? null : result.error,
    };
  });

/**
 * URL e verify token para o passo do webhook no guia (spec 0047, CB-1): quem
 * fecha o popup depois de conectar volta outro dia sem perder o token.
 */
const getWebhookSetup = socialAccountsProcedure
  .input(channelIdInput)
  .handler(async ({ context, input }) => {
    await requireOrgAdmin(context.org.id, context.user.id);
    const { channel } = await requireChannel(context.org.id, input.channelId);

    // Pela Meta o webhook é o da plataforma: não há nada para o cliente colar.
    if (channel.credentials.authMode === "META_LOGIN") {
      return { webhookUrl: null, verifyToken: null };
    }

    return {
      webhookUrl: webhookUrlFor(
        channel.provider,
        channel.webhookPathToken,
        context.headers,
      ),
      verifyToken: channel.credentials.verifyToken,
    };
  });

/** Contas do Instagram da conexão da Meta da org, para conectar com um clique (spec 0061, RF-1). */
const listMetaAccounts = socialAccountsProcedure
  .input(z.object({ organizationId: z.string().optional() }).optional())
  .handler(async ({ context, input }) => {
    // O Planner é multi-cliente: o post pode ser de outra empresa do usuário, não da ativa.
    const organizationId = input?.organizationId ?? context.org.id;
    await requireOrgMember(organizationId, context.user.id);
    return listMetaInstagramAccounts(organizationId);
  });

/** Conecta a conta com o token de página da conexão da Meta (spec 0061, RF-2). */
const connectWithMeta = socialAccountsProcedure
  .input(z.object({ metaPublishAccountId: z.string().optional(), organizationId: z.string().optional() }))
  .handler(async ({ context, input }) => {
    const organizationId = input.organizationId ?? context.org.id;
    await requireOrgAdmin(organizationId, context.user.id);

    return withDomainErrors(async () => {
      const result = await connectMetaInstagramAccount({
        organizationId,
        userId: context.user.id,
        metaPublishAccountId: input.metaPublishAccountId,
      });
      return {
        account: toPublicAccount(result.channel),
        isNewAccount: result.isNewChannel,
        subscribed: result.subscribed,
        subscriptionError: result.subscriptionError,
      };
    });
  });

export const socialAccountsRouter = {
  list: listAccounts,
  connect: connectAccount,
  reconnect: reconnectAccount,
  disconnect: disconnectAccount,
  reactivate: reactivateAccount,
  repairSubscription,
  webhookSetup: getWebhookSetup,
  metaAccounts: listMetaAccounts,
  connectWithMeta,
};
