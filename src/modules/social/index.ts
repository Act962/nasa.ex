import "server-only";
import { randomBytes } from "node:crypto";
import {
  createConsoleLogger,
  cryptoRandomPicker,
  systemClock,
} from "@/modules/shared/infra";
import { tenantScope, type TenantScope } from "@/modules/shared/domain/tenant-scope";
import type { Channel, SocialProviderValue } from "./domain/types";
import type { ChannelGateway } from "./ports/channel-gateway";
import type { ContentPublisher } from "./ports/content-publisher";
import {
  INSTAGRAM_LOGIN_GRAPH_URL,
  InstagramContentPublisher,
  InstagramLoginCredentialRenewer,
  META_LOGIN_GRAPH_URL,
} from "./infra/instagram/content-publisher";
import { InstagramGraphChannelGateway } from "./infra/instagram/graph-channel-gateway";
import { MetaLoginInstagramChannelGateway } from "./infra/instagram/meta-login-channel-gateway";
import { InstagramWebhookTranslator } from "./infra/instagram/webhook-translator";
import {
  PrismaChannelLookupRepository,
  PrismaChannelMaintenanceRepository,
  PrismaChannelRepository,
} from "./infra/prisma-channel-repository";
import { PrismaAutomationRepository } from "./infra/prisma-automation-repository";
import {
  PrismaContactRepository,
  PrismaInboundEventRepository,
  PrismaRunRepository,
} from "./infra/prisma-event-repositories";
import { StarsAiReplyGenerator } from "./infra/stars-ai-reply-generator";

/**
 * Composition root do módulo `social`.
 *
 * É o único arquivo que instancia adapter. `application/` e `domain/` recebem
 * tudo por parâmetro, e é isso que permite trocar Prisma por fake no teste sem
 * tocar numa linha de regra.
 */

export const socialLogger = createConsoleLogger("social");
export const socialClock = systemClock;
export const socialPicker = cryptoRandomPicker;

const translators = {
  INSTAGRAM: new InstagramWebhookTranslator(),
} as const;

export function getInboundTranslator(provider: SocialProviderValue) {
  return translators[provider];
}

export function createChannelGateway(channel: Channel): ChannelGateway {
  switch (channel.provider) {
    case "INSTAGRAM":
      if (channel.credentials.authMode === "META_LOGIN" && channel.credentials.pageId) {
        return new MetaLoginInstagramChannelGateway(
          channel.externalAccountId,
          channel.credentials.pageId,
          channel.credentials.accessToken,
        );
      }
      return new InstagramGraphChannelGateway(
        channel.externalAccountId,
        channel.credentials.accessToken,
      );
    default: {
      // Exaustividade verificada em tempo de compilação: acrescentar um valor
      // em SocialProviderValue sem gateway quebra o build aqui, não em produção.
      const exhaustive: never = channel.provider;
      throw new Error(`Provider sem gateway: ${String(exhaustive)}`);
    }
  }
}

/** Publicação e leitura do que foi publicado, na forma de conexão da conta (spec 0071, D-1). */
export function createContentPublisher(channel: Channel): ContentPublisher {
  switch (channel.provider) {
    case "INSTAGRAM":
      if (channel.credentials.authMode === "META_LOGIN" && channel.credentials.pageId) {
        return new InstagramContentPublisher(
          META_LOGIN_GRAPH_URL,
          channel.externalAccountId,
          channel.credentials.accessToken,
          channel.credentials.pageId,
        );
      }
      return new InstagramContentPublisher(
        INSTAGRAM_LOGIN_GRAPH_URL,
        channel.externalAccountId,
        channel.credentials.accessToken,
        channel.externalAccountId,
      );
    default: {
      const exhaustive: never = channel.provider;
      throw new Error(`Provider sem publicador: ${String(exhaustive)}`);
    }
  }
}

export const instagramCredentialRenewer = new InstagramLoginCredentialRenewer();
export const channelMaintenance = new PrismaChannelMaintenanceRepository();

/** Credenciais fornecidas à mão, ainda não salvas — usado no connect. */
export function createGatewayForCredentials(
  provider: SocialProviderValue,
  externalAccountId: string,
  accessToken: string,
  metaLogin?: { pageId: string },
): ChannelGateway {
  return createChannelGateway({
    id: "",
    organizationId: "",
    provider,
    externalAccountId,
    webhookPathToken: "",
    handle: null,
    displayName: null,
    status: "ACTIVE",
    credentials: metaLogin
      ? { authMode: "META_LOGIN", accessToken, appSecret: "", verifyToken: "", pageId: metaLogin.pageId }
      : { accessToken, appSecret: "", verifyToken: "" },
  });
}

export function generateWebhookPathToken(): string {
  return randomBytes(16).toString("hex");
}

export const channelLookup = new PrismaChannelLookupRepository();

/**
 * Monta os repositórios já escopados. Não existe caminho para obtê-los sem
 * `TenantScope` — é a garantia estrutural contra IDOR por omissão (§5.3 do
 * overview de arquitetura).
 */
export function createSocialRepositories(tenant: TenantScope) {
  return {
    tenant,
    channels: new PrismaChannelRepository(tenant),
    automations: new PrismaAutomationRepository(tenant),
    inboundEvents: new PrismaInboundEventRepository(tenant),
    runs: new PrismaRunRepository(tenant),
    contacts: new PrismaContactRepository(tenant),
    ai: new StarsAiReplyGenerator(),
  };
}

export function socialRepositoriesForOrganization(organizationId: string) {
  return createSocialRepositories(tenantScope(organizationId));
}

export type SocialRepositories = ReturnType<typeof createSocialRepositories>;
