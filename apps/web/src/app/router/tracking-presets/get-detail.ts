import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { presetSpecSchema } from "@/features/tracking-presets/lib/preset-spec.schema";

/**
 * Retorna o spec COMPLETO de um preset pra renderizar preview antes de
 * aplicar. Usado pelo step inicial do ApplyPresetDialog que mostra:
 *  - Status que serão criados (nome + cor)
 *  - Tags que serão criadas (nome + cor + grupo)
 *  - Workflows que serão criados (separados por folder + ativos vs inativos)
 *
 * `list` retorna só summary (counts) pra não inflar a query. `detail` é
 * chamado on-demand quando user clica num card.
 */
export const getTrackingPresetDetail = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/tracking-presets/:id",
    summary: "Detalhe de um padrão de tracking",
  })
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, errors }) => {
    const preset = await prisma.trackingPreset.findUnique({
      where: { id: input.id },
    });
    if (!preset || !preset.isPublic) {
      throw errors.NOT_FOUND({ message: "Padrão não encontrado" });
    }

    const parsed = presetSpecSchema.safeParse(preset.spec);
    if (!parsed.success) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Spec do padrão inválido",
      });
    }

    return {
      id: preset.id,
      slug: preset.slug,
      name: preset.name,
      description: preset.description,
      paradigm: preset.paradigm,
      icon: preset.icon,
      color: preset.color,
      starsCost: preset.starsCost,
      spec: parsed.data,
    };
  });
