import "server-only";
import prisma from "@/lib/prisma";
import {
  AUTO_TAG_SLUGS,
  DEFAULT_TAGS,
  DEFAULT_TRACKING_DESCRIPTION,
  DEFAULT_TRACKINGS,
  DEFAULT_WIN_LOSS_REASONS,
} from "./default-org-template";
import { inngest } from "@/inngest/client";
import { ensureCatalogStages } from "@/features/nerp-catalog/lib/stage-setup";
import { SAMPLE_APP_SEEDERS } from "./sample-content";
import { seedSampleLeads } from "./sample-content/sample-leads";
import type { SampleSeedContext } from "./sample-content/types";

export const SAMPLE_CONTENT_EVENT = "org-defaults/sample-content.seed";
export type SampleContentEventData = Omit<SampleSeedContext, "trackings">;

/**
 * Empresa nova nasce com funis e tags de exemplo (spec 0042, RF-1/RF-2).
 * Idempotente: se a empresa já tem tracking, não mexe em nada. Chamar depois do
 * commit da criação da empresa; falha aqui não pode desfazer o cadastro.
 */
export async function seedNewOrganization(params: { organizationId: string; ownerUserId: string | null }) {
  const { organizationId, ownerUserId } = params;
  const existingTrackings = await prisma.tracking.count({ where: { organizationId } });
  if (existingTrackings > 0) return { seeded: false as const };

  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true, slug: true } });
  const organizationName = organization?.name ?? "sua empresa";

  await prisma.$transaction(async (tx) => {
    for (const template of DEFAULT_TRACKINGS) {
      const tracking = await tx.tracking.create({
        data: {
          name: template.name,
          description: DEFAULT_TRACKING_DESCRIPTION,
          organizationId,
          ...(ownerUserId ? { participants: { create: { userId: ownerUserId, role: "OWNER" } } } : {}),
          ...(template.statuses.length > 0
            ? {
                status: {
                  createMany: {
                    data: template.statuses.map((status, index) => ({ name: status.name, color: status.color, order: index })),
                  },
                },
              }
            : {}),
          winLossReasons: { createMany: { data: DEFAULT_WIN_LOSS_REASONS } },
          aiSettings: {
            create: {
              assistantName: "Astro",
              prompt: `Você é o assistente de atendimento da ${organizationName} no funil ${template.name}.`,
              finishSentence: "Quando o cliente quiser conversar com um atendente humano",
            },
          },
        },
        select: { id: true },
      });
      if (template.hasCatalogStages) {
        await ensureCatalogStages({ organizationId, trackingId: tracking.id, client: tx });
      }
    }

    await tx.tag.createMany({
      data: DEFAULT_TAGS.map((tag) => ({
        name: tag.name,
        slug: AUTO_TAG_SLUGS[tag.key],
        color: tag.color,
        description: tag.description,
        type: "SYSTEM" as const,
        organizationId,
      })),
      skipDuplicates: true,
    });
  });

  if (ownerUserId) {
    const eventData: SampleContentEventData = { organizationId, ownerUserId, organizationSlug: organization?.slug ?? organizationId };
    await inngest.send({ name: SAMPLE_CONTENT_EVENT, data: eventData });
  }

  return { seeded: true as const };
}

export const SAMPLE_SEEDERS = [{ app: "leads", seed: seedSampleLeads }, ...SAMPLE_APP_SEEDERS];

export async function loadSampleSeedContext(params: SampleContentEventData): Promise<SampleSeedContext> {
  const trackings = await prisma.tracking.findMany({
    where: { organizationId: params.organizationId },
    select: { id: true, name: true, status: { select: { id: true, name: true } } },
  });
  return {
    ...params,
    trackings: trackings.map((tracking) => ({ id: tracking.id, name: tracking.name, statuses: tracking.status })),
  };
}
