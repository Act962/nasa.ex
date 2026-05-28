import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { presetSpecSchema } from "@/features/tracking-presets/lib/preset-spec.schema";
import { remapNodeData } from "@/features/tracking-presets/lib/remap-node-data";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import { slugify } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Aplica um TrackingPreset numa org. Transactional — ou tudo passa, ou nada.
 *
 * Modos:
 *  - "create": cria novo tracking. Replica fluxo de `createTracking.ts` mas
 *    com nome/AI/status/winLossReasons do spec.
 *  - "merge": adiciona ao tracking existente. Status com mesmo nome são
 *    pulados (case-insensitive). Workflows com nome conflitante recebem
 *    sufixo numérico. Opcionalmente sobrescreve `aiSettings.prompt`.
 *
 * Resolução de slug → id:
 *  - tags: Map<tagSlug, realTagId> (criadas novas OU reusadas conforme input)
 *  - status: Map<statusSlug, realStatusId>
 *  - tagGroups: Map<groupSlug, realGroupId>
 *  - folders: Map<folderSlug, realFolderId>
 *  - nodes (escopo workflow): Map<tempId, realNodeId> pra resolver connections
 *
 * Bug corrigido: ao contrário da duplicação atual de templates, aqui o
 * `node.data` é REMAPEADO via `remapNodeData()` antes de gravar. Workflows
 * resultantes apontam pras tags/status reais da org, não pra IDs órfãos.
 */
export const applyTrackingPreset = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "POST",
    path: "/tracking-presets/apply",
    summary: "Aplica um padrão de tracking",
  })
  .input(
    z.object({
      presetId: z.string(),
      mode: z.enum(["create", "merge"]),
      targetTrackingId: z.string().optional(),
      /// Map: tagSlug → resolução escolhida pelo user no preview.
      /// "reuse" = usa tag existente (mesmo nome na org). "createNew" = cria nova.
      /// Tags sem conflito não precisam aparecer (default createNew).
      tagConflictResolution: z
        .record(z.string(), z.enum(["reuse", "createNew"]))
        .default({}),
      /// Só relevante em mode=merge. Atualiza `aiSettings.prompt` com o do spec.
      overrideAiPrompt: z.boolean().default(false),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { user, org } = context;

    // ── 1. Carrega preset + valida spec ─────────────────────────────────
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

    // ── 2. Resolve target tracking (cria ou usa existente) ──────────────
    // Tudo em transaction pra atomicidade. Se algum step falhar, nada persiste.
    // Mensagem detalhada de erro (incluindo causa do Prisma) é importante
    // pra debug em prod — INTERNAL_SERVER_ERROR genérico esconde info útil.
    let result;
    try {
      result = await prisma.$transaction(
      async (tx) => {
        // ── Tracking ─────────────────────────────────────────────────────
        let trackingId: string;
        let trackingName: string;

        if (input.mode === "create") {
          const created = await tx.tracking.create({
            data: {
              name: spec.tracking.name,
              description: spec.tracking.description,
              organizationId: org.id,
              participants: {
                create: { userId: user.id, role: "OWNER" },
              },
              ...(spec.tracking.ai && {
                aiSettings: {
                  create: {
                    assistantName: spec.tracking.ai.assistantName,
                    prompt: spec.tracking.ai.prompt,
                    finishSentence: spec.tracking.ai.finishSentence,
                  },
                },
              }),
              ...(spec.winLossReasons.length > 0 && {
                winLossReasons: {
                  createMany: {
                    data: spec.winLossReasons.map((r) => ({
                      name: r.name,
                      type: r.type,
                    })),
                  },
                },
              }),
            },
          });
          trackingId = created.id;
          trackingName = created.name;
        } else {
          const existing = await tx.tracking.findFirst({
            where: { id: input.targetTrackingId!, organizationId: org.id },
          });
          if (!existing) {
            throw errors.NOT_FOUND({
              message: "Tracking destino não encontrado",
            });
          }
          trackingId = existing.id;
          trackingName = existing.name;

          if (input.overrideAiPrompt && spec.tracking.ai) {
            await tx.aiSettings.upsert({
              where: { trackingId },
              create: {
                trackingId,
                assistantName: spec.tracking.ai.assistantName,
                prompt: spec.tracking.ai.prompt,
                finishSentence: spec.tracking.ai.finishSentence,
              },
              update: {
                prompt: spec.tracking.ai.prompt,
                assistantName: spec.tracking.ai.assistantName,
                finishSentence: spec.tracking.ai.finishSentence,
              },
            });
          }

          if (spec.winLossReasons.length > 0) {
            // Em merge: cria só os reasons que ainda não existem (case-insensitive)
            const existingReasons = await tx.winLossReason.findMany({
              where: { trackingId },
              select: { name: true, type: true },
            });
            const existingKeys = new Set(
              existingReasons.map(
                (r) => `${r.type}:${r.name.trim().toLowerCase()}`,
              ),
            );
            const toCreate = spec.winLossReasons.filter(
              (r) =>
                !existingKeys.has(`${r.type}:${r.name.trim().toLowerCase()}`),
            );
            if (toCreate.length > 0) {
              await tx.winLossReason.createMany({
                data: toCreate.map((r) => ({
                  trackingId,
                  name: r.name,
                  type: r.type,
                })),
              });
            }
          }
        }

        // ── Status: mapa slug → realId ──────────────────────────────────
        const statusSlugToId = new Map<string, string>();
        const existingStatus =
          input.mode === "merge"
            ? await tx.status.findMany({
                where: { trackingId },
                select: { id: true, name: true },
              })
            : [];
        const statusByLowerName = new Map(
          existingStatus.map((s) => [s.name.trim().toLowerCase(), s.id]),
        );

        for (const s of spec.status) {
          const existingId = statusByLowerName.get(s.name.trim().toLowerCase());
          if (existingId) {
            statusSlugToId.set(s.slug, existingId);
            continue;
          }
          const created = await tx.status.create({
            data: {
              trackingId,
              name: s.name,
              color: s.color,
              order: s.order,
            },
            select: { id: true },
          });
          statusSlugToId.set(s.slug, created.id);
        }

        // ── TagGroups: mapa slug → realId ───────────────────────────────
        const tagGroupSlugToId = new Map<string, string>();
        const existingTagGroups =
          spec.tagGroups.length > 0
            ? await tx.tagGroup.findMany({
                where: {
                  organizationId: org.id,
                  name: {
                    in: spec.tagGroups.map((g) => g.name),
                    mode: "insensitive",
                  },
                },
                select: { id: true, name: true },
              })
            : [];
        const tagGroupByLowerName = new Map(
          existingTagGroups.map((g) => [g.name.trim().toLowerCase(), g.id]),
        );

        for (const g of spec.tagGroups) {
          const existingId = tagGroupByLowerName.get(
            g.name.trim().toLowerCase(),
          );
          if (existingId) {
            tagGroupSlugToId.set(g.slug, existingId);
            continue;
          }
          const created = await tx.tagGroup.create({
            data: {
              organizationId: org.id,
              name: g.name,
              color: g.color,
              icon: g.icon,
            },
            select: { id: true },
          });
          tagGroupSlugToId.set(g.slug, created.id);
        }

        // ── Tags: mapa slug → realId ────────────────────────────────────
        const tagSlugToId = new Map<string, string>();
        const createdTagIds: string[] = [];
        const reusedTagIds: string[] = [];

        // Lookup tags existentes (case-insensitive, NÃO arquivadas) na org
        const existingTags =
          spec.tags.length > 0
            ? await tx.tag.findMany({
                where: {
                  organizationId: org.id,
                  archivedAt: null,
                  name: {
                    in: spec.tags.map((t) => t.name),
                    mode: "insensitive",
                  },
                },
                select: { id: true, name: true },
              })
            : [];
        const tagByLowerName = new Map(
          existingTags.map((t) => [t.name.trim().toLowerCase(), t.id]),
        );

        for (const t of spec.tags) {
          const existingId = tagByLowerName.get(t.name.trim().toLowerCase());
          const resolution = input.tagConflictResolution[t.slug];
          // Reusa se: existe E user marcou "reuse" (default em conflito é createNew).
          // Sem conflito (não existe na org): sempre cria nova.
          if (existingId && resolution === "reuse") {
            tagSlugToId.set(t.slug, existingId);
            reusedTagIds.push(existingId);
            continue;
          }
          // Cria nova. Se nome já existe na org E user disse "createNew",
          // suffix numérico pra não violar unique constraint composta.
          let finalName = t.name;
          let finalSlug = slugify(t.name);
          if (existingId) {
            let suffix = 2;
            while (true) {
              const trySlug = `${slugify(t.name)}-${suffix}`;
              const tryName = `${t.name} (${suffix})`;
              const conflict = await tx.tag.findFirst({
                where: {
                  organizationId: org.id,
                  OR: [{ slug: trySlug }, { name: tryName }],
                },
                select: { id: true },
              });
              if (!conflict) {
                finalName = tryName;
                finalSlug = trySlug;
                break;
              }
              suffix++;
            }
          }
          const groupId = t.groupSlug
            ? tagGroupSlugToId.get(t.groupSlug) ?? null
            : null;
          const created = await tx.tag.create({
            data: {
              organizationId: org.id,
              // Tags do preset são org-wide (trackingId=null) — alinhado com TagsV2.
              trackingId: null,
              name: finalName,
              slug: finalSlug,
              color: t.color,
              description: t.description,
              icon: t.icon,
              tagGroupId: groupId,
            },
            select: { id: true },
          });
          tagSlugToId.set(t.slug, created.id);
          createdTagIds.push(created.id);
        }

        // ── WorkflowFolders: mapa slug → realId ────────────────────────
        const folderSlugToId = new Map<string, string>();
        for (const f of spec.workflowFolders) {
          // Em merge: se nome conflita, sufixo
          let finalName = f.name;
          if (input.mode === "merge") {
            let suffix = 2;
            while (true) {
              const conflict = await tx.workflowFolder.findFirst({
                where: { trackingId, name: finalName },
                select: { id: true },
              });
              if (!conflict) break;
              finalName = `${f.name} (${suffix})`;
              suffix++;
            }
          }
          // Nota: WorkflowFolder atual NÃO tem campo `order` no schema.
          // O `f.order` do spec é ignorado por enquanto — ordem visual
          // segue a sequência de criação. Se um dia adicionar order ao
          // schema, voltar a passar aqui.
          const created = await tx.workflowFolder.create({
            data: {
              trackingId,
              userId: user.id,
              name: finalName,
            },
            select: { id: true },
          });
          folderSlugToId.set(f.slug, created.id);
        }

        // ── Workflows + Nodes + Connections ─────────────────────────────
        const createdWorkflowIds: string[] = [];
        for (const wf of spec.workflows) {
          // Nome único no tracking (sufixo se conflitar)
          let finalName = wf.name;
          if (input.mode === "merge") {
            let suffix = 2;
            while (true) {
              const conflict = await tx.workflow.findFirst({
                where: { trackingId, name: finalName },
                select: { id: true },
              });
              if (!conflict) break;
              finalName = `${wf.name} (${suffix})`;
              suffix++;
            }
          }

          const folderId = wf.folderSlug
            ? folderSlugToId.get(wf.folderSlug) ?? null
            : null;

          const createdWf = await tx.workflow.create({
            data: {
              tracking: { connect: { id: trackingId } },
              user: { connect: { id: user.id } },
              name: finalName,
              description: wf.description,
              isActive: wf.isActive,
              ...(folderId && {
                folder: { connect: { id: folderId } },
              }),
            },
            select: { id: true },
          });
          createdWorkflowIds.push(createdWf.id);

          // Nodes (escopo do workflow): tempId → realNodeId.
          // Prisma 7 exige relation `workflow: { connect }` ao invés de
          // `workflowId` direto quando o model tem @relation declarada.
          const nodeIdMap = new Map<string, string>();
          for (const node of wf.nodes) {
            const remappedData = remapNodeData(node.data ?? {}, {
              tagSlugToId,
              statusSlugToId,
            });
            const createdNode = await tx.node.create({
              data: {
                workflow: { connect: { id: createdWf.id } },
                // name é obrigatório no schema — fallback pro type quando o
                // spec não passa um nome custom (a maioria dos casos).
                name: node.name ?? node.type,
                type: node.type as any, // string match com NodeType enum
                position: node.position as Prisma.InputJsonValue,
                data: remappedData as Prisma.InputJsonValue,
              },
              select: { id: true },
            });
            nodeIdMap.set(node.tempId, createdNode.id);
          }

          for (const conn of wf.connections) {
            const fromId = nodeIdMap.get(conn.fromTempId);
            const toId = nodeIdMap.get(conn.toTempId);
            if (!fromId || !toId) continue; // Zod já validou, mas defensivo
            await tx.connection.create({
              data: {
                workflow: { connect: { id: createdWf.id } },
                fromNode: { connect: { id: fromId } },
                toNode: { connect: { id: toId } },
                fromOutput: conn.fromOutput,
                toInput: conn.toInput,
              },
            });
          }
        }

        // ── Auditoria: registro de aplicação ────────────────────────────
        const application = await tx.trackingPresetApplication.create({
          data: {
            presetId: preset.id,
            organizationId: org.id,
            trackingId,
            appliedById: user.id,
            mode: input.mode,
            result: {
              trackingId,
              trackingName,
              statusCount: spec.status.length,
              tagsCreated: createdTagIds.length,
              tagsReused: reusedTagIds.length,
              workflowsCreated: createdWorkflowIds.length,
              foldersCreated: spec.workflowFolders.length,
            },
          },
          select: { id: true },
        });

        return {
          trackingId,
          trackingName,
          applicationId: application.id,
          summary: {
            statusCreated: spec.status.length,
            tagsCreated: createdTagIds.length,
            tagsReused: reusedTagIds.length,
            workflowsCreated: createdWorkflowIds.length,
            foldersCreated: spec.workflowFolders.length,
          },
        };
      },
      // Timeout maior — presets grandes (50+ workflows) podem demorar.
      { maxWait: 10_000, timeout: 60_000 },
    );
    } catch (err) {
      console.error("[tracking-presets.apply] transaction failed", {
        presetId: input.presetId,
        mode: input.mode,
        orgId: org.id,
        userId: user.id,
        err: err instanceof Error ? { message: err.message, stack: err.stack } : err,
      });
      throw errors.INTERNAL_SERVER_ERROR({
        message: `Apply falhou: ${err instanceof Error ? err.message : "erro desconhecido"}`,
      });
    }

    // ── Pós-transaction: stars + activity log (best-effort) ──────────────
    if (preset.starsCost > 0) {
      try {
        await chargeStarsByAction(org.id, "tracking_preset_apply" as any, {
          userId: user.id,
          description: `Aplicou padrão "${preset.name}"`,
          appSlug: "tracking",
          overrideAmount: preset.starsCost,
        } as any);
      } catch (e) {
        console.warn("[tracking-presets.apply] charge stars failed:", e);
      }
    }

    try {
      await logActivity({
        organizationId: org.id,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userImage: (user as any).image,
        appSlug: "tracking",
        action: "tracking_preset_applied",
        actionLabel: `Aplicou padrão "${preset.name}" (${input.mode === "create" ? "novo tracking" : "mesclou em existente"})`,
        resource: result.trackingName,
        resourceId: result.trackingId,
        metadata: {
          presetId: preset.id,
          presetSlug: preset.slug,
          mode: input.mode,
          summary: result.summary,
        },
      });
    } catch (e) {
      console.warn("[tracking-presets.apply] log activity failed:", e);
    }

    return result;
  });
