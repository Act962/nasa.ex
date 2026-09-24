import "server-only";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { last4 } from "@/lib/crypto";
import { tenantScope, type TenantScope } from "@/modules/shared/domain/tenant-scope";
import { ChannelAlreadyTakenError } from "../domain/errors";
import type { Channel, SocialProviderValue } from "../domain/types";
import type {
  ChannelLookupRepository,
  ChannelRepository,
  ChannelSummary,
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
  try {
    accessTokenLast4 = last4(decryptCredentials(row.credentials).accessToken);
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
}

export class PrismaChannelRepository implements ChannelRepository {
  constructor(private readonly tenant: TenantScope) {}

  async findForTenant(): Promise<ChannelSummary | null> {
    const row = await prisma.socialChannel.findFirst({
      where: { organizationId: this.tenant.organizationId },
      orderBy: { createdAt: "asc" },
    });
    return row ? toSummary(row as unknown as ChannelRow) : null;
  }

  async findWithCredentials(): Promise<Channel | null> {
    const row = await prisma.socialChannel.findFirst({
      where: { organizationId: this.tenant.organizationId },
      orderBy: { createdAt: "asc" },
    });
    return row ? toChannel(row as unknown as ChannelRow) : null;
  }

  async connect(input: {
    provider: SocialProviderValue;
    externalAccountId: string;
    handle?: string | null;
    displayName?: string | null;
    credentials: Channel["credentials"];
    webhookPathToken: string;
    connectedById?: string | null;
  }): Promise<ChannelSummary> {
    const existing = await prisma.socialChannel.findUnique({
      where: {
        provider_externalAccountId: {
          provider: input.provider,
          externalAccountId: input.externalAccountId,
        },
      },
      select: { id: true, organizationId: true, webhookPathToken: true },
    });

    if (existing && existing.organizationId !== this.tenant.organizationId) {
      throw new ChannelAlreadyTakenError();
    }

    const credentials = encryptCredentials(input.credentials);

    try {
      const row = existing
        ? await prisma.socialChannel.update({
            where: { id: existing.id },
            data: {
              credentials,
              handle: input.handle,
              displayName: input.displayName,
              status: "ACTIVE",
              lastErrorMessage: null,
              lastErrorAt: null,
            },
          })
        : await prisma.socialChannel.create({
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
          });

      return toSummary(row as unknown as ChannelRow);
    } catch (error) {
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
