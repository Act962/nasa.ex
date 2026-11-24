import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { z } from "zod";
import { NBOX_MAX_FILE_BYTES } from "@/features/nbox/lib/storage-limits";
import { toNboxUserMessage } from "@/features/nbox/server/uploads";
import {
  completePublicNboxUpload,
  createNboxUploadLink,
  deletePublicNboxUpload,
  getPublicNboxUploadLink,
  listNboxUploadLinks,
  notifyPublicNboxUploadFinished,
  startPublicNboxUpload,
  updateNboxUploadLink,
} from "@/features/nbox/server/upload-links";

// Link de envio para cliente sem conta (spec 0149). `public.*` não exige login: vale o token do link.

const runWithUserMessage = async <Result>(
  run: () => Promise<Result>,
  toBadRequest: (message: string) => Error,
): Promise<Result> => {
  try {
    return await run();
  } catch (error) {
    const message = toNboxUserMessage(error);
    if (message) throw toBadRequest(message);
    throw error;
  }
};

const linkDaysSchema = z.number().int();
const uploadTokenSchema = z.string().min(16).max(64);
const uploaderTokenSchema = z.string().min(32).max(128);
const senderNameSchema = z.string().max(80).optional();

export const createUploadLink = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      days: linkDaysSchema,
      target: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("new"), name: z.string().min(1).max(120), parentId: z.string().nullable() }),
        z.object({ kind: z.literal("existing"), folderId: z.string().min(1) }),
      ]),
    }),
  )
  .handler(({ input, context, errors }) =>
    runWithUserMessage(
      () => createNboxUploadLink({ actor: context.user, organizationId: context.org.id, ...input }),
      (message) => errors.BAD_REQUEST({ message }),
    ),
  );

export const listUploadLinks = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => ({ uploadLinks: await listNboxUploadLinks(context.org.id) }));

export const updateUploadLink = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      folderId: z.string().min(1),
      action: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("extend"), days: linkDaysSchema }),
        z.object({ kind: z.literal("end") }),
        z.object({ kind: z.literal("regenerate"), days: linkDaysSchema }),
      ]),
    }),
  )
  .handler(({ input, context, errors }) =>
    runWithUserMessage(
      () => updateNboxUploadLink({ actor: context.user, organizationId: context.org.id, ...input }),
      (message) => errors.BAD_REQUEST({ message }),
    ),
  );

export const getPublicUploadLink = base
  .input(z.object({ uploadToken: uploadTokenSchema, uploaderToken: uploaderTokenSchema }))
  .handler(async ({ input, errors }) => {
    const link = await getPublicNboxUploadLink(input.uploadToken, input.uploaderToken);
    if (!link) throw errors.NOT_FOUND({ message: "Link não encontrado." });
    return link;
  });

export const startPublicUpload = base
  .input(
    z.object({
      uploadToken: uploadTokenSchema,
      fileName: z.string().min(1).max(255),
      contentType: z.string().min(1).max(255),
      sizeBytes: z.number().int().min(1).max(NBOX_MAX_FILE_BYTES, "Arquivo maior que 5 GB."),
    }),
  )
  .handler(({ input, errors }) =>
    runWithUserMessage(() => startPublicNboxUpload(input), (message) => errors.BAD_REQUEST({ message })),
  );

export const completePublicUpload = base
  .input(
    z.object({
      uploadToken: uploadTokenSchema,
      uploaderToken: uploaderTokenSchema,
      senderName: senderNameSchema,
      key: z.string().min(1).max(512),
      fileName: z.string().min(1).max(255),
      contentType: z.string().min(1).max(255),
      multipartUploadId: z.string().optional(),
      parts: z.array(z.object({ partNumber: z.number().int().min(1).max(10_000), etag: z.string().min(1) })).max(10_000).optional(),
    }),
  )
  .handler(({ input, errors }) =>
    runWithUserMessage(() => completePublicNboxUpload(input), (message) => errors.BAD_REQUEST({ message })),
  );

export const deletePublicUpload = base
  .input(z.object({ uploadToken: uploadTokenSchema, uploaderToken: uploaderTokenSchema, itemId: z.string().min(1) }))
  .handler(({ input, errors }) =>
    runWithUserMessage(async () => {
      await deletePublicNboxUpload(input);
      return { ok: true as const };
    }, (message) => errors.BAD_REQUEST({ message })),
  );

export const finishPublicUpload = base
  .input(z.object({ uploadToken: uploadTokenSchema, uploaderToken: uploaderTokenSchema, senderName: senderNameSchema }))
  .handler(async ({ input }) => {
    await notifyPublicNboxUploadFinished(input);
    return { ok: true as const };
  });
