import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { presetSpecSchema } from "@/features/tracking-presets/lib/preset-spec.schema";

/**
 * Preview do que vai acontecer ao aplicar um preset. Sem efeitos colaterais —
 * só consulta. Usado pelo dialog de aplicação pra:
 *  - Mostrar contagens (X tags novas, Y reusadas, Z workflows criados)
 *  - Listar tags conflitando (mesmo nome) com opção Reusar/Criar Nova
 *  - Mostrar warnings de quebra potencial (só em mode=merge):
 *    status com mesmo nome já existe, workflow com mesmo nome, etc.
 */
export const previewTrackingPreset = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    path: "/tracking-presets/preview",
    summary: "Preview da aplicação de um preset",
  })
  .input(
    z.object({
      presetId: z.string(),
      mode: z.enum(["create", "merge"]),
      /// Obrigatório se mode="merge"
      targetTrackingId: z.string().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { org } = context;

    const preset = await prisma.trackingPreset.findUnique({
      where: { id: input.presetId },
    });
    if (!preset || !preset.isPublic) {
      throw errors.NOT_FOUND({ message: "Padrão não encontrado" });
    }

    const parsed = presetSpecSchema.safeParse(preset.spec);
    if (!parsed.success) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Spec do padrão inválido. Contate o administrador.",
      });
    }
    const spec = parsed.data;

    // Validação modo=merge
    let targetTracking: { id: string; name: string; statusCount: number } | null = null;
    const warnings: string[] = [];
    let existingStatusNames = new Set<string>();
    let existingWorkflowNames = new Set<string>();

    if (input.mode === "merge") {
      if (!input.targetTrackingId) {
        throw errors.BAD_REQUEST({
          message: "targetTrackingId obrigatório em modo merge",
        });
      }
      const tracking = await prisma.tracking.findFirst({
        where: { id: input.targetTrackingId, organizationId: org.id },
        select: {
          id: true,
          name: true,
          _count: { select: { status: true } },
          status: { select: { name: true } },
          workflows: { select: { name: true } },
        },
      });
      if (!tracking) {
        throw errors.NOT_FOUND({ message: "Tracking destino não encontrado" });
      }
      targetTracking = {
        id: tracking.id,
        name: tracking.name,
        statusCount: tracking._count.status,
      };
      existingStatusNames = new Set(
        tracking.status.map((s) => s.name.trim().toLowerCase()),
      );
      existingWorkflowNames = new Set(
        tracking.workflows.map((w) => w.name.trim().toLowerCase()),
      );
    }

    // ── Status: marca quais já existem no tracking destino (só em merge)
    const statusPreview = spec.status.map((s) => {
      const exists = existingStatusNames.has(s.name.trim().toLowerCase());
      if (input.mode === "merge" && exists) {
        warnings.push(`Status "${s.name}" já existe — vai ser pulado`);
      }
      return {
        slug: s.slug,
        name: s.name,
        color: s.color,
        action: exists ? ("alreadyExists" as const) : ("create" as const),
      };
    });

    // ── TagGroups: lookup case-insensitive por nome na org
    const tagGroupNames = spec.tagGroups.map((g) => g.name);
    const existingTagGroups =
      tagGroupNames.length > 0
        ? await prisma.tagGroup.findMany({
            where: {
              organizationId: org.id,
              name: { in: tagGroupNames, mode: "insensitive" },
            },
            select: { id: true, name: true },
          })
        : [];
    const tagGroupByLowerName = new Map(
      existingTagGroups.map((g) => [g.name.trim().toLowerCase(), g.id]),
    );

    const tagGroupsPreview = spec.tagGroups.map((g) => {
      const existingId = tagGroupByLowerName.get(g.name.trim().toLowerCase());
      return {
        slug: g.slug,
        name: g.name,
        color: g.color,
        action: existingId ? ("reuse" as const) : ("create" as const),
        existingId,
      };
    });

    // ── Tags: lookup case-insensitive + counts pra UI mostrar "vai afetar"
    const tagNames = spec.tags.map((t) => t.name);
    const existingTags =
      tagNames.length > 0
        ? await prisma.tag.findMany({
            where: {
              organizationId: org.id,
              archivedAt: null,
              name: { in: tagNames, mode: "insensitive" },
            },
            select: {
              id: true,
              name: true,
              color: true,
              _count: { select: { leadTags: true } },
            },
          })
        : [];
    const tagByLowerName = new Map(
      existingTags.map((t) => [t.name.trim().toLowerCase(), t]),
    );

    const tagsPreview = spec.tags.map((t) => {
      const existing = tagByLowerName.get(t.name.trim().toLowerCase());
      if (!existing) {
        return {
          slug: t.slug,
          name: t.name,
          color: t.color,
          action: "create" as const,
        };
      }
      return {
        slug: t.slug,
        name: t.name,
        color: t.color,
        action: "conflict" as const,
        existingTagId: existing.id,
        existingTagColor: existing.color,
        existingLeadCount: existing._count.leadTags,
      };
    });

    // ── Workflows: só warning em merge se nome conflita (vai criar com suffix)
    const workflowsPreview = spec.workflows.map((w) => {
      const conflicts =
        input.mode === "merge" &&
        existingWorkflowNames.has(w.name.trim().toLowerCase());
      if (conflicts) {
        warnings.push(
          `Workflow "${w.name}" já existe — será criado com sufixo numérico`,
        );
      }
      return {
        slug: w.slug,
        name: w.name,
        folderSlug: w.folderSlug ?? null,
        isActive: w.isActive,
        willCreate: true as const,
        nameConflictsWithExisting: conflicts,
      };
    });

    return {
      tracking:
        input.mode === "create"
          ? { willCreate: true as const, name: spec.tracking.name }
          : { willMergeInto: targetTracking! },
      status: statusPreview,
      tagGroups: tagGroupsPreview,
      tags: tagsPreview,
      workflows: workflowsPreview,
      warnings,
      starsCost: preset.starsCost,
    };
  });
