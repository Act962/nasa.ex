import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const createFolder = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      trackingId: z.string(),
      name: z
        .string()
        .min(1, "Nome da pasta é obrigatório")
        .max(100, "Nome muito longo"),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const tracking = await prisma.tracking.findUnique({
      where: { id: input.trackingId },
      select: { id: true },
    });
    if (!tracking) {
      throw errors.NOT_FOUND({ message: "Tracking não encontrado" });
    }

    try {
      const folder = await prisma.workflowFolder.create({
        data: {
          name: input.name.trim(),
          trackingId: input.trackingId,
          userId: context.user.id,
        },
        select: { id: true, name: true, trackingId: true },
      });

      return folder;
    } catch (err: unknown) {
      const code =
        err instanceof Error && "code" in err
          ? (err as { code?: string }).code
          : undefined;
      if (code === "P2021" || code === "P2022") {
        throw errors.BAD_REQUEST({
          message:
            "Feature de pastas não está habilitada no banco. Roda `pnpm db:migrate` pra aplicar a migration workflow_folders.",
        });
      }
      throw err;
    }
  });
