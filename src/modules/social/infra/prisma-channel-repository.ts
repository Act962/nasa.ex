import "server-only";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { last4 } from "@/lib/crypto";
import { tenantScope, type TenantScope } from "@/modules/shared/domain/tenant-scope";
import { ChannelAlreadyTakenError } from "../domain/errors";
import type { Channel, ChannelAuthModeValue, SocialProviderValue } from "../domain/types";
import type {
  ChannelLookupRepository,
  ChannelRepository,
  ChannelSummary,
  ConnectChannelOutcome,
} from "../ports/repositories";
import { decryptCredentials, encryptCredentials } from "./credential-cipher";

type ChannelRow = {
  id: string;
  organizationId: string;
  provider: string;
  externalAccountId: string;
  webhookPathToken: string;
  handle: string | null;
  displayName: string | null;
  status: string;
  credentials: string;
  lastErrorMessage: string | null;
  lastErrorAt: Date | null;
  createdAt: Date;
  _count?: { automations: number };
};

function toChannel(row: ChannelRow): Channel {
  return {
    id: row.id,
    organizationId: row.organizationId,
    provider: row.provider as SocialProviderValue,
    externalAccountId: row.externalAccountId,
    webhookPathToken: row.webhookPathToken,
    handle: row.handle,
    displayName: row.displayName,
    status: row.status as Channel["status"],
    credentials: decryptCredentials(row.credentials),
  };
}

function toSummary(row: ChannelRow): ChannelSummary {
  let accessTokenLast4 = "";
  let authMode: ChannelAuthModeValue = "INSTAGRAM_LOGIN";
  try {
    const credentials = decryptCredentials(row.credentials);
    accessTokenLast4 = last4(credentials.accessToken);
    authMode = credentials.authMode ?? "INSTAGRAM_LOGIN";
  } catch {
    accessTokenLast4 = "????";
  }

  return {
    id: row.id,
    provider: row.provider as SocialProviderValue,
    externalAccountId: row.externalAccountId,
    webhookPathToken: row.webhookPathToken,
    handle: row.handle,
    displayName: row.displayName,
    status: row.status as Channel["status"],
    lastErrorMessage: row.lastErrorMessage,
    lastErrorAt: row.lastErrorAt,
    createdAt: row.createdAt,
    accessTokenLast4,
    authMode,
    automationCount: row._count?.automations ?? 0,
  };
}

/**
 * A ÚNICA leitura sem escopo de tenant do módulo (spec 0024 D-12).
 *
 * O webhook chega anônimo; é daqui que o `TenantScope` nasce, e é por isso que
 * está isolada numa classe própria — quem revisa o PR olha uma função, não
 * quarenta queries.
 */
export class PrismaChannelLookupRepository implements ChannelLookupRepository {
  async findByWebhookPathToken(
    provider: SocialProviderValue,
    webhookPathToken: string,
  ): Promise<{ channel: Channel; tenant: TenantScope } | null> {
    const row = await prisma.socialChannel.findUnique({
      where: { webhookPathToken },
    });
    if (!row || row.provider !== provider) return null;

    return {
      channel: toChannel(row as unknown as ChannelRow),
      tenant: tenantScope(row.organizationId),
    };
  }

  async findByExternalAccountId(
    provider: SocialProviderValue,
    externalAccountId: string,
  ): Promise<{ channel: Channel; tenant: TenantScope } | null> {
    const row = await prisma.socialChannel.findUnique({
      where: { provider_externalAccountId: { provider, externalAccountId } },
    });
    if (!row) return null;

    return {
      channel: toChannel(row as unknown as ChannelRow),
      tenant: tenantScope(row.organizationId),
    };
  }
}

const WITH_AUTOMATION_COUNT = {
  _count: { select: { automations: true } },
} as const;

export class PrismaChannelRepository implements ChannelRepository {
  constructor(private readonly tenant: TenantScope) {}

  async listForTenant(provider?: SocialProviderValue): Promise<ChannelSummary[]> {
    const rows = await prisma.socialChannel.findMany({
      where: {
        organizationId: this.tenant.organizationId,
        ...(provider ? { provider } : {}),
      },
      orderBy: { createdAt: "asc" },
      include: WITH_AUTOMATION_COUNT,
    });
    return rows.map((row) => toSummary(row as unknown as ChannelRow));
  }

  async countForTenant(provider: SocialProviderValue): Promise<number> {
    return prisma.socialChannel.count({
      where: { organizationId: this.tenant.organizationId, provider },
    });
  }

  async findById(channelId: string): Promise<ChannelSummary | null> {
    const row = await prisma.socialChannel.findFirst({
      where: { id: channelId, organizationId: this.tenant.organizationId },
      include: WITH_AUTOMATION_COUNT,
    });
    return row ? toSummary(row as unknown as ChannelRow) : null;
  }

  async findWithCredentialsById(channelId: string): Promise<Channel | null> {
    const row = await prisma.socialChannel.findFirst({
      where: { id: channelId, organizationId: this.tenant.organizationId },
    });
    return row ? toChannel(row as unknown as ChannelRow) : null;
  }

  async findByExternalAccountId(
    provider: SocialProviderValue,
    externalAccountId: string,
  ): Promise<ChannelSummary | null> {
    const row = await prisma.socialChannel.findFirst({
      where: {
        organizationId: this.tenant.organizationId,
        provider,
        externalAccountId,
      },
      include: WITH_AUTOMATION_COUNT,
    });
    return row ? toSummary(row as unknown as ChannelRow) : null;
  }

  /**
   * A chave é `(provider, externalAccountId)`, e nada além da linha dessa conta
   * é tocado (spec 0069, CB-1). A versão anterior tratava as outras linhas da
   * organização como restos de um bug e as apagava ou desativava — com várias
   * contas por organização, isso destruiria contas legítimas.
   */
  async connect(input: {
    provider: SocialProviderValue;
    externalAccountId: string;
    handle?: string | null;
    displayName?: string | null;
    credentials: Channel["credentials"];
    webhookPathToken: string;
    connectedById?: string | null;
  }): Promise<ConnectChannelOutcome> {
    const existing = await prisma.socialChannel.findUnique({
      where: {
        provider_externalAccountId: {
          provider: input.provider,
          externalAccountId: input.externalAccountId,
        },
      },
      select: { id: true, organizationId: true },
    });

    if (existing && existing.organizationId !== this.tenant.organizationId) {
      throw new ChannelAlreadyTakenError();
    }

    const credentials = encryptCredentials(input.credentials);

    if (existing) {
      // Mantém `webhookPathToken`: a URL já está colada no App da Meta.
      const row = await prisma.socialChannel.update({
        where: { id: existing.id },
        data: {
          credentials,
          handle: input.handle,
          displayName: input.displayName,
          status: "ACTIVE",
          lastErrorMessage: null,
          lastErrorAt: null,
          ...(input.connectedById ? { connectedById: input.connectedById } : {}),
        },
        include: WITH_AUTOMATION_COUNT,
      });
      return {
        channel: toSummary(row as unknown as ChannelRow),
        isNewChannel: false,
      };
    }

    try {
      const row = await prisma.socialChannel.create({
        data: {
          organizationId: this.tenant.organizationId,
          provider: input.provider,
          externalAccountId: input.externalAccountId,
          webhookPathToken: input.webhookPathToken,
          handle: input.handle,
          displayName: input.displayName,
          credentials,
          connectedById: input.connectedById,
        },
        include: WITH_AUTOMATION_COUNT,
      });
      return {
        channel: toSummary(row as unknown as ChannelRow),
        isNewChannel: true,
      };
    } catch (error) {
      // Duas conexões simultâneas da mesma conta: o unique decide (CB-6).
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ChannelAlreadyTakenError();
      }
      throw error;
    }
  }

  /**
   * Desconectar **desativa**, não apaga.
   *
   * `SocialAutomation`, `SocialContact` e `SocialInboundEvent` apontam para o
   * canal com `onDelete: Cascade` — apagar a linha levava junto automações,
   * gatilhos, respostas e histórico. Um clique num botão chamado "Desconectar"
   * não pode destruir a configuração do usuário. Manter a linha também preserva
   * o `webhookPathToken`, então a URL já configurada na Meta continua válida.
   */
  async disconnect(channelId: string): Promise<void> {
    await prisma.socialChannel.updateMany({
      where: { id: channelId, organizationId: this.tenant.organizationId },
      data: { status: "DISABLED" },
    });
  }

  async markNeedsReconnect(channelId: string, reason: string): Promise<void> {
    await prisma.socialChannel.updateMany({
      where: { id: channelId, organizationId: this.tenant.organizationId },
      data: {
        status: "NEEDS_RECONNECT",
        lastErrorMessage: reason.slice(0, 500),
        lastErrorAt: new Date(),
      },
    });
  }

  async markActive(channelId: string): Promise<void> {
    await prisma.socialChannel.updateMany({
      where: { id: channelId, organizationId: this.tenant.organizationId },
      data: { status: "ACTIVE", lastErrorMessage: null, lastErrorAt: null },
    });
  }
}
