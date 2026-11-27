import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { z } from "zod";
import { NBOX_MAX_FILE_BYTES } from "@/features/nbox/lib/storage-limits";
import { assertFolderWritable, registerUploadedNboxFile } from "@/features/nbox/server/items";
import { startNboxUpload, toNboxUserMessage } from "@/features/nbox/server/uploads";

// Envio do Nbox com login, cota e chave por empresa (spec 0148, D-2).

export const startUpload = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      folderId: z.string().nullable(),
      fileName: z.string().min(1).max(255),
      contentType: z.string().min(1).max(255),
      sizeBytes: z.number().int().min(1).max(NBOX_MAX_FILE_BYTES, "Arquivo maior que 5 GB."),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const kind = await assertFolderWritable(context.user, context.org.id, input.folderId);
      return await startNboxUpload({
        organizationId: context.org.id,
        kind,
        fileName: input.fileName,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
      });
    } catch (error) {
      const message = toNboxUserMessage(error);
      if (message) throw errors.BAD_REQUEST({ message });
      throw error;
    }
  });

export const completeUpload = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      folderId: z.string().nullable(),
      key: z.string().min(1).max(512),
      fileName: z.string().min(1).max(255),
      contentType: z.string().min(1).max(255),
      multipartUploadId: z.string().optional(),
      parts: z.array(z.object({ partNumber: z.number().int().min(1).max(10_000), etag: z.string().min(1) })).max(10_000).optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const item = await registerUploadedNboxFile({
        actor: context.user,
        organizationId: context.org.id,
        folderId: input.folderId,
        key: input.key,
        name: input.fileName,
        mimeType: input.contentType,
        multipartUploadId: input.multipartUploadId,
        parts: input.parts,
      });
      return { item };
    } catch (error) {
      const message = toNboxUserMessage(error);
      if (message) throw errors.BAD_REQUEST({ message });
      throw error;
    }
  });
