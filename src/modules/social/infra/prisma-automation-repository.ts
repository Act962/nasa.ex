import "server-only";
import prisma from "@/lib/prisma";
import type { TenantScope } from "@/modules/shared/domain/tenant-scope";
import { AutomationNotFoundError } from "../domain/errors";
import type {
  Automation,
  FlowStep,
  MatchRule,
  SocialContentTypeValue,
  Trigger,
} from "../domain/types";
import type {
  AutomationListItem,
  AutomationRepository,
  UpsertTriggerInput,
} from "../ports/repositories";
import { parseStepConfig } from "./schemas";

const triggerInclude = {
  targets: true,
  rules: { orderBy: { order: "asc" } },
  steps: { orderBy: { order: "asc" } },
} as const;

type TriggerRow = {
  id: string;
  automationId: string;
  eventType: string;
  targetScope: string;
  matchLogic: string;
  isEnabled: boolean;
  createdAt: Date;
  targets: {
    externalContentId: string;
    contentType: string;
    mediaUrl: string | null;
    permalink: string | null;
    caption: string | null;
  }[];
  rules: { id: string; kind: string; operator: string; terms: string[] }[];
  steps: {
    id: string;
    kind: string;
    order: number;
    isEnabled: boolean;
    config: unknown;
  }[];
};

function toTrigger(row: TriggerRow): Trigger {
  return {
    id: row.id,
    automationId: row.automationId,
    eventType: row.eventType as Trigger["eventType"],
    targetScope: row.targetScope as Trigger["targetScope"],
    matchLogic: row.matchLogic as Trigger["matchLogic"],
    isEnabled: row.isEnabled,
    createdAt: row.createdAt,
    targets: row.targets.map((target) => ({
      externalContentId: target.externalContentId,
      contentType: target.contentType as Trigger["targets"][number]["contentType"],
      mediaUrl: target.mediaUrl,
      permalink: target.permalink,
      caption: target.caption,
    })),
    rules: row.rules.map(
      (rule): MatchRule => ({
        id: rule.id,
        kind: rule.kind as MatchRule["kind"],
        operator: rule.operator as MatchRule["operator"],
        terms: rule.terms,
      }),
    ),
    steps: row.steps.map(
      (step): FlowStep => ({
        id: step.id,
        kind: step.kind as FlowStep["kind"],
        order: step.order,
        isEnabled: step.isEnabled,
        config: parseStepConfig(
          step.kind as "SEND_DIRECT_MESSAGE" | "REPLY_TO_COMMENT",
          step.config,
        ),
      }),
    ),
  };
}

export class PrismaAutomationRepository implements AutomationRepository {
  constructor(private readonly tenant: TenantScope) {}

  private async assertOwnership(automationId: string): Promise<void> {
    const found = await prisma.socialAutomation.findFirst({
      where: { id: automationId, organizationId: this.tenant.organizationId },
      select: { id: true },
    });
    if (!found) throw new AutomationNotFoundError();
  }

  async list(): Promise<AutomationListItem[]> {
    const rows = await prisma.socialAutomation.findMany({
      where: { organizationId: this.tenant.organizationId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { triggers: true } },
      },
    });

    const sentCounts = await prisma.socialAutomationRun.groupBy({
      by: ["automationId"],
      where: {
        status: "SENT",
        automation: { organizationId: this.tenant.organizationId },
      },
      _count: { _all: true },
    });
    const sentByAutomation = new Map(
      sentCounts.map((entry) => [entry.automationId, entry._count._all]),
    );

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      isActive: row.isActive,
      createdAt: row.createdAt,
      triggerCount: row._count.triggers,
      sentCount: sentByAutomation.get(row.id) ?? 0,
    }));
  }

  async findById(automationId: string): Promise<Automation | null> {
    const row = await prisma.socialAutomation.findFirst({
      where: { id: automationId, organizationId: this.tenant.organizationId },
      include: { triggers: { include: triggerInclude } },
    });
    if (!row) return null;

    return {
      id: row.id,
      organizationId: row.organizationId,
      channelId: row.channelId,
      name: row.name,
      isActive: row.isActive,
      triggers: (row.triggers as unknown as TriggerRow[]).map(toTrigger),
    };
  }

  async findActiveByChannel(channelId: string): Promise<Automation[]> {
    const rows = await prisma.socialAutomation.findMany({
      where: {
        channelId,
        isActive: true,
        organizationId: this.tenant.organizationId,
      },
      include: { triggers: { include: triggerInclude } },
    });

    return rows.map((row) => ({
      id: row.id,
      organizationId: row.organizationId,
      channelId: row.channelId,
      name: row.name,
      isActive: row.isActive,
      triggers: (row.triggers as unknown as TriggerRow[]).map(toTrigger),
    }));
  }

  async create(input: {
    channelId: string;
    name: string;
    createdById?: string | null;
  }): Promise<{ id: string }> {
    const row = await prisma.socialAutomation.create({
      data: {
        organizationId: this.tenant.organizationId,
        channelId: input.channelId,
        name: input.name,
        createdById: input.createdById,
      },
      select: { id: true },
    });
    return row;
  }

  async rename(automationId: string, name: string): Promise<void> {
    const updated = await prisma.socialAutomation.updateMany({
      where: { id: automationId, organizationId: this.tenant.organizationId },
      data: { name },
    });
    if (updated.count === 0) throw new AutomationNotFoundError();
  }

  async setActive(automationId: string, isActive: boolean): Promise<void> {
    const updated = await prisma.socialAutomation.updateMany({
      where: { id: automationId, organizationId: this.tenant.organizationId },
      data: { isActive },
    });
    if (updated.count === 0) throw new AutomationNotFoundError();
  }

  async remove(automationId: string): Promise<void> {
    await prisma.socialAutomation.deleteMany({
      where: { id: automationId, organizationId: this.tenant.organizationId },
    });
  }

  /**
   * Salva o gatilho inteiro de uma vez — alvos, regras e passos.
   *
   * O painel do editor edita o conjunto, então gravar por partes abriria janela
   * para estado inconsistente (gatilho sem resposta, resposta sem gatilho).
   * Regras e passos são substituídos, não mesclados: é o que o formulário
   * manda, é o que fica.
   *
   * Só escrita de banco dentro da transação — regra 18 do CLAUDE.md.
   */
  async upsertTrigger(input: UpsertTriggerInput): Promise<{ triggerId: string }> {
    await this.assertOwnership(input.automationId);

    if (input.triggerId) {
      const owned = await prisma.socialTrigger.findFirst({
        where: { id: input.triggerId, automationId: input.automationId },
        select: { id: true },
      });
      if (!owned) throw new AutomationNotFoundError();
    }

    return prisma.$transaction(async (tx) => {
      const trigger = input.triggerId
        ? await tx.socialTrigger.update({
            where: { id: input.triggerId },
            data: {
              eventType: input.eventType,
              targetScope: input.targetScope,
              matchLogic: input.matchLogic,
            },
            select: { id: true },
          })
        : await tx.socialTrigger.create({
            data: {
              automationId: input.automationId,
              eventType: input.eventType,
              targetScope: input.targetScope,
              matchLogic: input.matchLogic,
            },
            select: { id: true },
          });

      await tx.socialTriggerTarget.deleteMany({
        where: { triggerId: trigger.id },
      });
      await tx.socialMatchRule.deleteMany({ where: { triggerId: trigger.id } });
      await tx.socialFlowStep.deleteMany({ where: { triggerId: trigger.id } });

      if (input.targets.length > 0) {
        await tx.socialTriggerTarget.createMany({
          data: input.targets.map((target) => ({
            triggerId: trigger.id,
            externalContentId: target.externalContentId,
            contentType: target.contentType as SocialContentTypeValue,
            permalink: target.permalink ?? null,
            caption: target.caption ?? null,
            mediaUrl: target.mediaUrl ?? null,
            syncedAt: new Date(),
          })),
        });
      }

      if (input.rules.length > 0) {
        await tx.socialMatchRule.createMany({
          data: input.rules.map((rule, index) => ({
            triggerId: trigger.id,
            kind: rule.kind,
            operator: rule.operator,
            terms: rule.terms,
            order: index,
          })),
        });
      }

      if (input.steps.length > 0) {
        await tx.socialFlowStep.createMany({
          data: input.steps.map((step) => ({
            triggerId: trigger.id,
            kind: step.kind,
            order: step.order,
            config: step.config as object,
          })),
        });
      }

      return { triggerId: trigger.id };
    });
  }

  async removeTrigger(automationId: string, triggerId: string): Promise<void> {
    await this.assertOwnership(automationId);
    await prisma.socialTrigger.deleteMany({
      where: { id: triggerId, automationId },
    });
  }
}
