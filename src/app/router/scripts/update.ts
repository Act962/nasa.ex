import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { deleteStoredObject } from "@/lib/s3-client";
import { z } from "zod";
import { scriptVideoInput } from "./video-input";

export const updateScript = base
  .use(requiredAuthMiddleware)
  .route({ method: "PATCH", path: "/scripts/:id" })
  .input(
    z.object({
      id: z.string(),
      name: z.string().trim().min(1).optional(),
      content: z.string().optional(),
      /**
       * Ausente = não mexe no vídeo. `null` = remove o vídeo atual.
       * Objeto = substitui (o objeto anterior é apagado do bucket).
       */
      video: scriptVideoInput.nullish(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const script = await prisma.script.findUnique({ where: { id: input.id } });
    if (!script) throw errors.NOT_FOUND({ message: "Script não encontrado" });

    const isVideoTouched = input.video !== undefined;
    const nextVideoKey = input.video?.key ?? null;
    const shouldDropPreviousVideo =
      isVideoTouched && !!script.videoKey && script.videoKey !== nextVideoKey;

    const updated = await prisma.script.update({
      where: { id: input.id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.content !== undefined && { content: input.content }),
        ...(isVideoTouched && {
          videoKey: nextVideoKey,
          videoMimetype: input.video?.mimetype ?? null,
          videoFileName: input.video?.fileName ?? null,
          videoSizeBytes: input.video?.sizeBytes ?? null,
        }),
      },
    });

    // Best-effort após o commit: objeto órfão é preferível a falhar uma
    // edição já persistida (spec 0004, CB-10).
    if (shouldDropPreviousVideo) {
      await deleteStoredObject(script.videoKey!);
    }

    return updated;
  });
