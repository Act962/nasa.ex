import "server-only";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import type { TenantScope } from "@/modules/shared/domain/tenant-scope";
import type {
  SocialEventTypeValue,
  SocialProviderValue,
  SocialRunStatusValue,
} from "../domain/types";
import type {
  ContactRepository,
  InboundEventRepository,
  RunRepository,
  StepRunRecord,
} from "../ports/repositories";

export class PrismaInboundEventRepository implements InboundEventRepository {
  constructor(private readonly tenant: TenantScope) {}

  /**
   * O registro é a própria trava de idempotência: `create` com unique em
   * `[provider, externalEventId]`. Conferir-antes-de-inserir não serviria —
   * duas entregas simultâneas da Meta passariam as duas pela conferência.
   */
  async registerOnce(input: {
    channelId: string;
    provider: SocialProviderValue;
    externalEventId: string;
    eventType: SocialEventTypeValue;
    externalUserId?: string;
    externalContentId?: string;
  }): Promise<{ isFirstTime: boolean; inboundEventId: string | null }> {
    try {
      const row = await prisma.socialInboundEvent.create({
        data: {
          channelId: input.channelId,
          provider: input.provider,
          externalEventId: input.externalEventId,
          eventType: input.eventType,
          externalUserId: input.externalUserId,
          externalContentId: input.externalContentId,
        },
        select: { id: true },
      });
      return { isFirstTime: true, inboundEventId: row.id };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return { isFirstTime: false, inboundEventId: null };
      }
      throw error;
    }
  }

  async markStatus(
    inboundEventId: string,
    status: "MATCHED" | "SKIPPED" | "FAILED",
    skipReason?: string,
  ): Promise<void> {
    await prisma.socialInboundEvent.updateMany({
      where: {
        id: inboundEventId,
        channel: { organizationId: this.tenant.organizationId },
      },
      data: { status, skipReason: skipReason?.slice(0, 300) },
    });
  }
}

export class PrismaRunRepository implements RunRepository {
  constructor(private readonly tenant: TenantScope) {}

  async start(input: {
    automationId: string;
    triggerId: string;
    channelId: string;
    inboundEventId?: string | null;
    contactId?: string | null;
  }): Promise<{ runId: string }> {
    const row = await prisma.socialAutomationRun.create({
      data: {
        automationId: input.automationId,
        triggerId: input.triggerId,
        channelId: input.channelId,
        inboundEventId: input.inboundEventId ?? null,
        contactId: input.contactId ?? null,
      },
      select: { id: true },
    });
    return { runId: row.id };
  }

  async finish(
    runId: string,
    status: SocialRunStatusValue,
    steps: StepRunRecord[],
    error?: string | null,
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.socialAutomationRun.update({
        where: { id: runId },
        data: {
          status,
          error: error?.slice(0, 500) ?? null,
          finishedAt: new Date(),
        },
      });

      if (steps.length > 0) {
        await tx.socialStepRun.createMany({
          data: steps.map((step) => ({
            runId,
            stepId: step.stepId ?? null,
            kind: step.kind,
            status: step.status,
            error: step.error?.slice(0, 500) ?? null,
            externalMessageId: step.externalMessageId ?? null,
            durationMs: step.durationMs ?? null,
          })),
        });
      }
    });
  }

  async countByAutomation(automationId: string): Promise<number> {
    return prisma.socialAutomationRun.count({
      where: {
        automationId,
        automation: { organizationId: this.tenant.organizationId },
      },
    });
  }
}

export class PrismaContactRepository implements ContactRepository {
  constructor(private readonly tenant: TenantScope) {}

  async upsertFromInbound(input: {
    channelId: string;
    externalUserId: string;
    username?: string;
    occurredAt: Date;
  }): Promise<{ contactId: string }> {
    const row = await prisma.socialContact.upsert({
      where: {
        channelId_externalUserId: {
          channelId: input.channelId,
          externalUserId: input.externalUserId,
        },
      },
      update: {
        username: input.username,
        lastInboundAt: input.occurredAt,
      },
      create: {
        channelId: input.channelId,
        externalUserId: input.externalUserId,
        username: input.username,
        lastInboundAt: input.occurredAt,
      },
      select: { id: true },
    });
    return { contactId: row.id };
  }

  async markOutbound(contactId: string, at: Date): Promise<void> {
    await prisma.socialContact.updateMany({
      where: {
        id: contactId,
        channel: { organizationId: this.tenant.organizationId },
      },
      data: { lastOutboundAt: at },
    });
  }
}
