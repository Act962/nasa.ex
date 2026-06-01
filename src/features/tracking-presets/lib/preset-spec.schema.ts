import { z } from "zod";

/**
 * Zod schema do `spec` JSON de um TrackingPreset.
 *
 * Fonte da verdade pra:
 *  - Validação no `tracking-presets.apply` antes de qualquer write no banco
 *  - Validação no editor admin (form de criar/editar preset)
 *
 * Princípio: **referências cruzadas usam SLUGS, nunca IDs**. O apply resolve
 * slugs → IDs reais via Maps acumulados durante a transação. Isso resolve
 * o bug latente da duplicação atual (`/api/admin/app-template/.../duplicate`)
 * que copia `node.data` intacto e deixa IDs órfãos.
 *
 * Validação cruzada (refinement no fim): todo `tagSlugs[]`/`tagSlug` em
 * `workflows[].nodes[].data` deve referenciar um slug existente em
 * `spec.tags[]`. Idem pra `statusSlug` vs `spec.status[]`.
 */

const slugRegex = /^[a-z0-9-]+$/;
const slug = z
  .string()
  .min(1)
  .regex(slugRegex, "slug deve ser kebab-case minúsculo (a-z, 0-9, -)");

const colorHex = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "color deve ser hex #RRGGBB");

// ── Tracking + AI ───────────────────────────────────────────────────────────
const aiSettingsSpec = z.object({
  assistantName: z.string().min(1),
  prompt: z.string().min(1),
  finishSentence: z.string().min(1),
});

const trackingSpec = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  ai: aiSettingsSpec.optional(),
});

// ── Status ──────────────────────────────────────────────────────────────────
const statusSpec = z.object({
  slug,
  name: z.string().min(1),
  color: colorHex.default("#1447e6"),
  order: z.number().int().nonnegative(),
});

// ── WinLossReason ───────────────────────────────────────────────────────────
const winLossReasonSpec = z.object({
  name: z.string().min(1),
  type: z.enum(["WIN", "LOSS"]),
});

// ── TagGroup ────────────────────────────────────────────────────────────────
const tagGroupSpec = z.object({
  slug,
  name: z.string().min(1),
  color: colorHex.default("#6366f1"),
  icon: z.string().optional(),
});

// ── Tag ─────────────────────────────────────────────────────────────────────
const tagSpec = z.object({
  slug,
  name: z.string().min(1),
  color: colorHex.default("#1447e6"),
  description: z.string().optional(),
  icon: z.string().optional(),
  /// Referência ao slug de um tagGroup do mesmo spec (ou null = sem categoria).
  groupSlug: slug.nullable().optional(),
});

// ── WorkflowFolder ──────────────────────────────────────────────────────────
const workflowFolderSpec = z.object({
  slug,
  name: z.string().min(1),
  order: z.number().int().nonnegative().default(0),
});

// ── Node ────────────────────────────────────────────────────────────────────
//
// `data` é Json livre — campos típicos (`tagSlugs`, `tagSlug`, `statusSlug`,
// `formSlug`, etc) são REMAPEADOS pra IDs reais no apply via `remapNodeData`.
// Outros campos (mensagens, textos, configs) passam intactos.
const nodePosition = z.object({
  x: z.number(),
  y: z.number(),
});

const nodeSpec = z.object({
  /// ID temporário pra resolver connections dentro do mesmo workflow.
  tempId: z.string().min(1),
  name: z.string().optional(),
  /// Match com NodeType enum do Prisma. Não validamos contra enum aqui
  /// pra manter spec compatível com novas versões — apply ignora types desconhecidos.
  type: z.string().min(1),
  position: nodePosition,
  data: z.record(z.string(), z.any()).default({}),
});

// ── Connection ──────────────────────────────────────────────────────────────
const connectionSpec = z.object({
  fromTempId: z.string().min(1),
  toTempId: z.string().min(1),
  fromOutput: z.string().default("source-1"),
  toInput: z.string().default("target-1"),
});

// ── Workflow ────────────────────────────────────────────────────────────────
const workflowSpec = z.object({
  slug,
  name: z.string().min(1),
  description: z.string().optional(),
  /// Slug de um folder do spec. null/undefined = sem pasta (raiz).
  folderSlug: slug.nullable().optional(),
  /// Workflows do paradigma "biblioteca" entram inativos por default,
  /// "core" entram ativos.
  isActive: z.boolean().default(false),
  /// Se true, workflow roda na engine DAG (Modo Agente IA) com suporte a
  /// AI_DECISION, WAIT_FOR_EVENT, branches. Default false = legacy linear.
  agentMode: z.boolean().default(false),
  nodes: z.array(nodeSpec).min(1),
  connections: z.array(connectionSpec).default([]),
});

// ── Spec completo ───────────────────────────────────────────────────────────
export const presetSpecSchema = z
  .object({
    tracking: trackingSpec,
    status: z.array(statusSpec).min(1),
    winLossReasons: z.array(winLossReasonSpec).default([]),
    tagGroups: z.array(tagGroupSpec).default([]),
    tags: z.array(tagSpec).default([]),
    workflowFolders: z.array(workflowFolderSpec).default([]),
    workflows: z.array(workflowSpec).default([]),
  })
  .superRefine((spec, ctx) => {
    // Cruza referências: todos os slugs usados devem existir.
    const statusSlugs = new Set(spec.status.map((s) => s.slug));
    const tagSlugs = new Set(spec.tags.map((t) => t.slug));
    const tagGroupSlugs = new Set(spec.tagGroups.map((g) => g.slug));
    const folderSlugs = new Set(spec.workflowFolders.map((f) => f.slug));

    // tagGroup das tags
    for (const tag of spec.tags) {
      if (tag.groupSlug && !tagGroupSlugs.has(tag.groupSlug)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tags"],
          message: `tag "${tag.slug}" referencia tagGroup "${tag.groupSlug}" inexistente`,
        });
      }
    }

    // folder dos workflows + tempIds das connections
    for (const wf of spec.workflows) {
      if (wf.folderSlug && !folderSlugs.has(wf.folderSlug)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["workflows", wf.slug],
          message: `workflow "${wf.slug}" referencia folder "${wf.folderSlug}" inexistente`,
        });
      }

      const wfTempIds = new Set(wf.nodes.map((n) => n.tempId));
      for (const conn of wf.connections) {
        if (!wfTempIds.has(conn.fromTempId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["workflows", wf.slug, "connections"],
            message: `connection.fromTempId "${conn.fromTempId}" não existe em workflow "${wf.slug}"`,
          });
        }
        if (!wfTempIds.has(conn.toTempId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["workflows", wf.slug, "connections"],
            message: `connection.toTempId "${conn.toTempId}" não existe em workflow "${wf.slug}"`,
          });
        }
      }

      // tagSlugs/statusSlugs/tagSlug em node.data
      for (const node of wf.nodes) {
        const data = node.data ?? {};
        const checkTagSlug = (slugVal: unknown, field: string) => {
          if (typeof slugVal === "string" && slugVal && !tagSlugs.has(slugVal)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["workflows", wf.slug, "nodes", node.tempId, "data", field],
              message: `tag slug "${slugVal}" não existe em spec.tags`,
            });
          }
        };
        if (Array.isArray(data.tagSlugs)) {
          for (const s of data.tagSlugs) checkTagSlug(s, "tagSlugs");
        }
        checkTagSlug(data.tagSlug, "tagSlug");

        if (typeof data.statusSlug === "string" && data.statusSlug) {
          if (!statusSlugs.has(data.statusSlug)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [
                "workflows",
                wf.slug,
                "nodes",
                node.tempId,
                "data",
                "statusSlug",
              ],
              message: `status slug "${data.statusSlug}" não existe em spec.status`,
            });
          }
        }
      }
    }
  });

export type PresetSpec = z.infer<typeof presetSpecSchema>;
export type PresetSpecStatus = z.infer<typeof statusSpec>;
export type PresetSpecTag = z.infer<typeof tagSpec>;
export type PresetSpecTagGroup = z.infer<typeof tagGroupSpec>;
export type PresetSpecWorkflow = z.infer<typeof workflowSpec>;
export type PresetSpecNode = z.infer<typeof nodeSpec>;
