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

  /**
   * A conexão da organização é **uma linha só** (spec 0024 D-13), e é a mais
   * antiga: é ela que as automações, os contatos e o histórico referenciam, e é
   * o `webhookPathToken` dela que já está colado no App da Meta. Toda leitura e
   * toda escrita passam por aqui — foi a divergência entre as duas que fez a
   * troca de conta gravar numa linha que nenhuma leitura enxergava.
   */
  private async currentRow(
    provider?: SocialProviderValue,
  ): Promise<ChannelRow | null> {
    const row = await prisma.socialChannel.findFirst({
      where: {
        organizationId: this.tenant.organizationId,
        ...(provider ? { provider } : {}),
      },
      orderBy: { createdAt: "asc" },
    });
    return (row as unknown as ChannelRow) ?? null;
  }

  async findForTenant(): Promise<ChannelSummary | null> {
    const row = await this.currentRow();
    return row ? toSummary(row) : null;
  }

  async findWithCredentials(): Promise<Channel | null> {
    const row = await this.currentRow();
    return row ? toChannel(row) : null;
  }

  /**
   * Conecta ou troca a conta da organização.
   *
   * Trocar de conta **reaproveita a linha existente** em vez de criar outra.
   * Criar outra era o bug: o unique é `(provider, externalAccountId)`, então um
   * ID de conta novo não colidia com nada, nascia uma segunda linha e as
   * leituras continuavam devolvendo a primeira — a UI dizia "conectada" e
   * mostrava a conta antiga. Reaproveitar também preserva a URL do webhook já
   * configurada na Meta e tudo que aponta para o canal.
   */
  async connect(input: {
    provider: SocialProviderValue;
    externalAccountId: string;
    handle?: string | null;
    displayName?: string | null;
    credentials: Channel["credentials"];
    webhookPathToken: string;
    connectedById?: string | null;
  }): Promise<{
    channel: ChannelSummary;
    replacedExternalAccountId: string | null;
  }> {
    const owner = await prisma.socialChannel.findUnique({
      where: {
        provider_externalAccountId: {
          provider: input.provider,
          externalAccountId: input.externalAccountId,
        },
      },
      select: { id: true, organizationId: true },
    });

    if (owner && owner.organizationId !== this.tenant.organizationId) {
      throw new ChannelAlreadyTakenError();
    }

    const credentials = encryptCredentials(input.credentials);
    const current = await this.currentRow(input.provider);

    if (!current) {
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
      });
      return {
        channel: toSummary(row as unknown as ChannelRow),
        replacedExternalAccountId: null,
      };
    }

    const isAccountChange = current.externalAccountId !== input.externalAccountId;

    try {
      const row = await prisma.$transaction(async (transaction) => {
        // Tentativas de troca feitas antes desta correção deixaram linhas
        // órfãs: invisíveis para a UI, mas segurando o unique da conta que
        // agora está entrando. Só saem se não carregarem nada — nenhuma
        // deveria, porque a URL delas nunca chegou a aparecer para o usuário.
        const orphans = await transaction.socialChannel.findMany({
          where: {
            organizationId: this.tenant.organizationId,
            provider: input.provider,
            id: { not: current.id },
          },
          select: {
            id: true,
            _count: {
              select: {
                automations: true,
                contacts: true,
                inboundEvents: true,
                runs: true,
              },
            },
          },
        });

        for (const orphan of orphans) {
          const isEmpty =
            orphan._count.automations === 0 &&
            orphan._count.contacts === 0 &&
            orphan._count.inboundEvents === 0 &&
            orphan._count.runs === 0;

          if (isEmpty) {
            await transaction.socialChannel.delete({ where: { id: orphan.id } });
          } else {
            await transaction.socialChannel.update({
              where: { id: orphan.id },
              data: { status: "DISABLED" },
            });
          }
        }

        return transaction.socialChannel.update({
          where: { id: current.id },
          data: {
            externalAccountId: input.externalAccountId,
            credentials,
            handle: input.handle,
            displayName: input.displayName,
            status: "ACTIVE",
            lastErrorMessage: null,
            lastErrorAt: null,
            ...(input.connectedById
              ? { connectedById: input.connectedById }
              : {}),
          },
        });
      });

      return {
        channel: toSummary(row as unknown as ChannelRow),
        replacedExternalAccountId: isAccountChange
          ? current.externalAccountId
          : null,
      };
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
