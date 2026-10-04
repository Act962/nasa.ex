import { z } from "zod";
import {
  createChannelGateway,
  createGatewayForCredentials,
  generateWebhookPathToken,
} from "@/modules/social";
import { connectChannel } from "@/modules/social/application/connect-channel";
import {
  commentsProcedure,
  repositoriesFor,
  requireOrgAdmin,
  requireOrgMember,
  webhookUrlFor,
  withDomainErrors,
} from "./_shared";
import { getInstagramLeadTracking, setInstagramLeadTracking } from "@/features/comments/server/lead-tracking";
import {
  connectCommentsWithMetaAccount,
  listMetaInstagramAccounts,
} from "@/features/comments/server/meta-login-channel";

export const getChannel = commentsProcedure
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    const { channels } = repositoriesFor(context.org.id);
    const channel = await channels.findForTenant();

    if (!channel) {
      return { connected: false as const };
    }

    return {
      connected: true as const,
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
      webhookUrl: webhookUrlFor(
        channel.provider,
        channel.webhookPathToken,
        context.headers,
      ),
      connectedAt: channel.createdAt,
    };
  });

export const connectChannelProcedure = commentsProcedure
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
      const { channels, automations } = repositoriesFor(context.org.id);

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
          automations,
          gateway: createGatewayForCredentials(
            input.provider,
            input.externalAccountId,
            input.accessToken,
          ),
          generateWebhookPathToken,
        },
      );

      return {
        id: result.channel.id,
        handle: result.channel.handle,
        displayName: result.channel.displayName,
        externalAccountId: result.channel.externalAccountId,
        status: result.channel.status,
        webhookUrl: webhookUrlFor(
          result.channel.provider,
          result.channel.webhookPathToken,
          context.headers,
        ),
        subscribed: result.subscribed,
        subscriptionError: result.subscriptionError,
        replacedExternalAccountId: result.replacedExternalAccountId,
        deactivatedAutomations: result.deactivatedAutomations,
      };
    });
  });

/** Tracking que recebe os leads do Instagram no tracking-chat (spec 0062). */
export const getLeadTracking = commentsProcedure
  .input(z.object({}).optional())
  .handler(async ({ context }) => getInstagramLeadTracking(context.org.id));

export const setLeadTracking = commentsProcedure
  .input(z.object({ trackingId: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    await requireOrgAdmin(context.org.id, context.user.id);
    return setInstagramLeadTracking(context.org.id, input.trackingId);
  });

/** Contas do Instagram da conexão da Meta da org, para conectar com um clique (spec 0061, RF-1). */
export const listMetaAccounts = commentsProcedure
  .input(z.object({ organizationId: z.string().optional() }).optional())
  .handler(async ({ context, input }) => {
    // O Planner é multi-cliente: o post pode ser de outra empresa do usuário, não da ativa.
    const organizationId = input?.organizationId ?? context.org.id;
    await requireOrgMember(organizationId, context.user.id);
    return listMetaInstagramAccounts(organizationId);
  });

/** Conecta o Comments com o token de página da conexão da Meta (spec 0061, RF-2). */
export const connectWithMeta = commentsProcedure
  .input(z.object({ metaPublishAccountId: z.string().optional(), organizationId: z.string().optional() }))
  .handler(async ({ context, input }) => {
    const organizationId = input.organizationId ?? context.org.id;
    await requireOrgAdmin(organizationId, context.user.id);

    return withDomainErrors(async () => {
      const result = await connectCommentsWithMetaAccount({
        organizationId,
        userId: context.user.id,
        metaPublishAccountId: input.metaPublishAccountId,
      });
      return {
        id: result.channel.id,
        handle: result.channel.handle,
        externalAccountId: result.channel.externalAccountId,
        status: result.channel.status,
        subscribed: result.subscribed,
        subscriptionError: result.subscriptionError,
        replacedExternalAccountId: result.replacedExternalAccountId,
        deactivatedAutomations: result.deactivatedAutomations,
      };
    });
  });

/**
 * Reenvia a inscrição do app nos eventos da conta.
 *
 * Existe porque conexões criadas antes desta correção ficaram sem inscrição —
 * e porque a Meta derruba a inscrição quando o token é trocado.
 */
export const repairSubscription = commentsProcedure
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    const { channels } = repositoriesFor(context.org.id);
    const channel = await channels.findWithCredentials();

    if (!channel) {
      return { subscribed: false, fields: [], error: "Nenhuma conta conectada" };
    }

    const gateway = createChannelGateway(channel);
    const result = await gateway.subscribeToEvents();
    const fields = await gateway.listSubscribedFields();

    return {
      subscribed: result.ok,
      fields: fields ?? [],
      error: result.ok ? null : result.error,
    };
  });

/** Desativa a conexão preservando automações, histórico e URL do webhook. */
export const disconnectChannel = commentsProcedure
  .input(z.object({ channelId: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    const { channels } = repositoriesFor(context.org.id);
    await channels.disconnect(input.channelId);
    return { disconnected: true };
  });

/** Religa a conexão desativada e reinscreve o app nos eventos da conta. */
export const reactivateChannel = commentsProcedure
  .input(z.object({ channelId: z.string().min(1) }))
  .handler(async ({ context, input }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    const { channels } = repositoriesFor(context.org.id);
    await channels.markActive(input.channelId);

    const channel = await channels.findWithCredentials();
    if (!channel) {
      return { reactivated: false, subscribed: false };
    }

    const subscription = await createChannelGateway(channel).subscribeToEvents();
    return { reactivated: true, subscribed: subscription.ok };
  });

/**
 * URL e verify token para o passo do webhook no guia (spec 0047, CB-1): quem
 * fecha o popup depois de conectar volta outro dia sem perder o token.
 */
export const getWebhookSetup = commentsProcedure
  .input(z.object({}).optional())
  .handler(async ({ context }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    const { channels } = repositoriesFor(context.org.id);
    const channel = await channels.findWithCredentials();
    if (!channel) {
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

/** Publicações da conta, para o passo "escolha o post" do editor. */
export const listContent = commentsProcedure
  .input(z.object({ cursor: z.string().optional() }).optional())
  .handler(async ({ context, input }) => {
    const { channels } = repositoriesFor(context.org.id);
    const channel = await channels.findWithCredentials();

    if (!channel || channel.status !== "ACTIVE") {
      return {
        items: [],
        nextCursor: undefined as string | undefined,
        needsReconnect: Boolean(channel),
      };
    }

    const page = await createChannelGateway(channel).listContent({
      cursor: input?.cursor,
    });

    return { ...page, needsReconnect: false };
  });
