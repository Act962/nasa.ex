/**
 * Dada uma BlueprintV2 + tracking de destino, calcula sugestões de
 * mapeamento pra cada ref (fuzzy match contra entidades da org alvo).
 * Resposta usa-se pra inicializar o `WorkflowImportMappingDialog`.
 *
 * Não cria nada — read-only. Roda em <1s mesmo com 30+ refs.
 */
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { findBestMatch, topAlternatives } from "@/features/workflow-clipboard/lib/fuzzy-match";
import {
  REF_BEHAVIOR,
  type BlueprintV2,
  type ImportPreview,
  type RefType,
} from "@/features/workflow-clipboard/lib/types";
import prisma from "@/lib/prisma";
import { z } from "zod";

const blueprintRefSchema = z.object({
  type: z.string(),
  slug: z.string(),
  label: z.string(),
  color: z.string().nullable().optional(),
  originalId: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

const inputSchema = z.object({
  // Só lemos `refs` aqui — não validamos nodes/edges (faz no import).
  blueprint: z
    .object({
      formatVersion: z.literal(1),
      refs: z.array(blueprintRefSchema),
    })
    .passthrough(),
  targetTrackingId: z.string(),
});

export const previewImport = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(inputSchema)
  .handler(async ({ input, context, errors }): Promise<ImportPreview> => {
    // Valida tracking alvo
    const tracking = await prisma.tracking.findUnique({
      where: { id: input.targetTrackingId },
      select: { id: true, organizationId: true },
    });
    if (!tracking || tracking.organizationId !== context.org.id) {
      throw errors.FORBIDDEN({
        message: "tracking destino inválido ou de outra organização",
      });
    }

    const refs = (input.blueprint as unknown as BlueprintV2).refs;

    // Carrega candidatos por tipo — uma query por tipo de ref usado
    const candidates = await loadCandidates(context.org.id, tracking.id, refs);

    const out: ImportPreview["refs"] = [];
    let autoResolved = 0;
    let needsManual = 0;

    for (const ref of refs) {
      const list = candidates[ref.type as RefType] ?? [];
      const behavior = REF_BEHAVIOR[ref.type as RefType] ?? "manual-only";

      // Skipa fuzzy pra "manual-only" — força user a escolher
      if (behavior === "manual-only") {
        out.push({
          ref,
          autoMatch: null,
          alternatives: topAlternatives(
            { slug: ref.slug, label: ref.label },
            list,
            3,
          ),
          behavior,
        });
        needsManual++;
        continue;
      }

      const best = findBestMatch(
        { slug: ref.slug, label: ref.label },
        list,
        behavior === "auto-suggestable" ? 0.5 : 0.4,
      );

      if (best && best.score >= 0.7) {
        // Match forte — auto-resolve
        out.push({
          ref,
          autoMatch: {
            targetId: best.id,
            targetLabel: best.label,
            score: best.score,
            matchedBy: best.matchedBy,
          },
          alternatives: topAlternatives(
            { slug: ref.slug, label: ref.label },
            list,
            3,
            best.id,
          ),
          behavior,
        });
        autoResolved++;
      } else {
        // Match fraco ou nenhum — sugere "create" pra auto-createable, manual senão
        out.push({
          ref,
          autoMatch: best
            ? {
                targetId: best.id,
                targetLabel: best.label,
                score: best.score,
                matchedBy: best.matchedBy,
              }
            : null,
          alternatives: topAlternatives(
            { slug: ref.slug, label: ref.label },
            list,
            3,
            best?.id,
          ),
          behavior,
        });
        if (behavior === "auto-createable") {
          // Não conta como "needsManual" — UI vai pré-selecionar "create"
        } else {
          needsManual++;
        }
      }
    }

    const canCreate = refs.filter(
      (r) => REF_BEHAVIOR[r.type as RefType] === "auto-createable",
    ).length;

    return {
      refs: out,
      summary: {
        total: refs.length,
        autoResolved,
        needsManual,
        canCreate,
      },
    };
  });

/**
 * Carrega lista de candidatos por refType — uma query por tipo,
 * batched. Tipos sem candidatos retornam array vazio.
 */
async function loadCandidates(
  organizationId: string,
  trackingId: string,
  refs: Array<{ type: string }>,
): Promise<Partial<Record<RefType, Array<{ id: string; slug?: string | null; name: string }>>>> {
  const used = new Set(refs.map((r) => r.type as RefType));
  const out: Partial<Record<RefType, Array<{ id: string; slug?: string | null; name: string }>>> = {};

  if (used.has("tag")) {
    out.tag = await prisma.tag.findMany({
      where: { organizationId, archivedAt: null },
      select: { id: true, slug: true, name: true },
    });
  }
  if (used.has("tag-group")) {
    out["tag-group"] = (
      await prisma.tagGroup.findMany({
        where: { organizationId },
        select: { id: true, name: true },
      })
    ).map((r) => ({ id: r.id, name: r.name }));
  }
  if (used.has("status")) {
    out.status = (
      await prisma.status.findMany({
        where: { trackingId },
        select: { id: true, name: true },
      })
    ).map((r) => ({ id: r.id, name: r.name }));
  }
  if (used.has("column")) {
    out.column = (
      await prisma.column.findMany({
        where: { trackingId },
        select: { id: true, name: true },
      })
    ).map((r) => ({ id: r.id, name: r.name }));
  }
  if (used.has("user")) {
    // Membros da org. Email vira slug.
    out.user = (
      await prisma.member.findMany({
        where: { organizationId },
        select: { user: { select: { id: true, name: true, email: true } } },
      })
    ).map((m) => ({
      id: m.user.id,
      slug: m.user.email,
      name: m.user.name || m.user.email,
    }));
  }
  if (used.has("tracking")) {
    out.tracking = (
      await prisma.tracking.findMany({
        where: { organizationId },
        select: { id: true, name: true },
      })
    ).map((r) => ({ id: r.id, name: r.name }));
  }
  if (used.has("form")) {
    out.form = (
      await prisma.form.findMany({
        where: { organizationId },
        select: { id: true, name: true },
      })
    ).map((r) => ({ id: r.id, name: r.name }));
  }
  if (used.has("agenda")) {
    out.agenda = (
      await prisma.agenda.findMany({
        where: { organizationId },
        select: { id: true, name: true },
      })
    ).map((r) => ({ id: r.id, name: r.name }));
  }
  if (used.has("forge-product")) {
    out["forge-product"] = (
      await prisma.forgeProduct.findMany({
        where: { organizationId },
        select: { id: true, name: true },
      })
    ).map((r) => ({ id: r.id, name: r.name }));
  }
  if (used.has("forge-contract-template")) {
    out["forge-contract-template"] = (
      await prisma.forgeContractTemplate.findMany({
        where: { organizationId },
        select: { id: true, name: true },
      })
    ).map((r) => ({ id: r.id, name: r.name }));
  }
  if (used.has("workflow")) {
    out.workflow = (
      await prisma.workflow.findMany({
        where: { tracking: { organizationId } },
        select: { id: true, name: true },
      })
    ).map((r) => ({ id: r.id, name: r.name }));
  }
  // linnker-page / nbox-file / nasa-route-course — best effort, pode
  // não existir o model no client. Skipa silenciosamente.
  if (used.has("linnker-page")) {
    try {
      const rows: Array<{ id: string; name?: string; title?: string }> = await (
        prisma as any
      ).linnker?.findMany?.({
        where: { organizationId },
        select: { id: true, name: true },
      });
      if (rows) {
        out["linnker-page"] = rows.map((r) => ({
          id: r.id,
          name: r.name || r.title || "(sem nome)",
        }));
      }
    } catch {
      out["linnker-page"] = [];
    }
  }
  if (used.has("nbox-file")) {
    try {
      const rows: Array<{ id: string; name: string }> = await (
        prisma as any
      ).nboxFile?.findMany?.({
        where: { organizationId },
        select: { id: true, name: true },
      });
      if (rows) out["nbox-file"] = rows;
    } catch {
      out["nbox-file"] = [];
    }
  }
  if (used.has("nasa-route-course")) {
    try {
      const rows: Array<{ id: string; title: string }> = await (
        prisma as any
      ).nasaRouteCourse?.findMany?.({
        where: { organizationId },
        select: { id: true, title: true },
      });
      if (rows) {
        out["nasa-route-course"] = rows.map((r) => ({ id: r.id, name: r.title }));
      }
    } catch {
      out["nasa-route-course"] = [];
    }
  }

  return out;
}
