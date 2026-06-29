import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { presetSpecSchema } from "@/features/tracking-presets/lib/preset-spec.schema";

/**
 * Lista presets PÚBLICOS (isPublic=true). Catálogo aberto pra qualquer user
 * autenticado. Inclui um `summary` calculado on-the-fly do spec (contagens
 * de status/tags/workflows) pra UI mostrar badges sem precisar parsear.
 *
 * Filtro opcional por paradigma. Drafts (isPublic=false) NÃO aparecem aqui —
 * acessíveis só via admin router.
 */
export const listTrackingPresets = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/tracking-presets",
    summary: "Lista padrões públicos de tracking",
  })
  .input(
    z.object({
      paradigm: z
        .enum(["REATIVO", "PROATIVO", "PREDITIVO", "AUTOATENDIMENTO"])
        .optional(),
    }),
  )
  .handler(async ({ input }) => {
    const presets = await prisma.trackingPreset.findMany({
      where: {
        isPublic: true,
        ...(input.paradigm ? { paradigm: input.paradigm } : {}),
      },
      orderBy: [{ paradigm: "asc" }, { order: "asc" }, { name: "asc" }],
    });

    return {
      presets: presets.map((p) => {
        // spec já passou por validação no upsert, mas faz parse defensivo
        // pra extrair contagens — se algum spec antigo estiver inválido, retorna 0.
        const parsed = presetSpecSchema.safeParse(p.spec);
        const summary = parsed.success
          ? {
              statusCount: parsed.data.status.length,
              tagsCount: parsed.data.tags.length,
              workflowsCount: parsed.data.workflows.length,
              activeWorkflowsCount: parsed.data.workflows.filter(
                (w) => w.isActive,
              ).length,
            }
          : {
              statusCount: 0,
              tagsCount: 0,
              workflowsCount: 0,
              activeWorkflowsCount: 0,
            };

        return {
          id: p.id,
          slug: p.slug,
          name: p.name,
          description: p.description,
          paradigm: p.paradigm,
          icon: p.icon,
          color: p.color,
          starsCost: p.starsCost,
          summary,
        };
      }),
    };
  });
