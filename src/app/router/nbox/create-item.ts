import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { NBoxItemType } from "@/generated/prisma/enums";
import {
  canViewRestrictedNBox,
  loadFolderRestriction,
} from "@/features/nbox/server/can-view-restricted-nbox";
import { toNboxItemDto } from "@/features/nbox/server/items";
import { NboxStorageFullError, assertNboxStorageAvailable } from "@/features/nbox/server/storage-usage";
import { TRANSFER_ROOT, isNboxObjectKeyOf, readStoredObjectSize } from "@/features/nbox/server/storage-objects";

const isExternalUrl = (url: string) => /^https?:\/\//.test(url);

/** Chave do Nbox de outra empresa, ou temporária (some pela regra do bucket), nunca vira item aqui (spec 0148, CA-6). */
const isForbiddenNboxKey = (organizationId: string, key: string) =>
  (key.startsWith("nbox/") || key.startsWith(TRANSFER_ROOT)) && !isNboxObjectKeyOf(organizationId, key, "stored");

export const createItem = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({
    folderId: z.string().nullable().optional(),
    type: z.nativeEnum(NBoxItemType),
    name: z.string().min(1).max(255),
    url: z.string().optional(),
    mimeType: z.string().optional(),
    size: z.number().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    forgeContractId: z.string().optional(),
    forgeProposalId: z.string().optional(),
  }))
  .handler(async ({ input, context, errors }) => {
    const folder = await loadFolderRestriction(input.folderId, context.org.id);
    if (input.folderId && !folder) throw errors.NOT_FOUND({ message: "Pasta não encontrada." });
    if (folder?.isRestricted && !(await canViewRestrictedNBox(context.user, context.org.id))) {
      throw errors.FORBIDDEN({ message: "Pasta restrita: só administradores do financeiro." });
    }

    // Arquivo do nosso bucket: o tamanho vem do R2, não do navegador (spec 0148, RF-4).
    const isStoredFile = input.type !== NBoxItemType.LINK && !!input.url && !isExternalUrl(input.url);
    if (isStoredFile && isForbiddenNboxKey(context.org.id, input.url!)) {
      throw errors.FORBIDDEN({ message: "Arquivo não pertence a esta empresa." });
    }
    const storedSize = isStoredFile ? await readStoredObjectSize(input.url!) : null;
    const sizeBytes = storedSize ?? input.size ?? null;
    if (sizeBytes) {
      try {
        await assertNboxStorageAvailable(context.org.id, sizeBytes);
      } catch (error) {
        if (error instanceof NboxStorageFullError) throw errors.BAD_REQUEST({ message: error.message });
        throw error;
      }
    }

    const item = await prisma.nBoxItem.create({
      data: {
        organizationId: context.org.id,
        folderId: input.folderId ?? null,
        type: input.type,
        name: input.name,
        url: input.url ?? null,
        mimeType: input.mimeType ?? null,
        size: sizeBytes === null ? null : BigInt(sizeBytes),
        description: input.description ?? null,
        tags: input.tags ?? [],
        forgeContractId: input.forgeContractId ?? null,
        forgeProposalId: input.forgeProposalId ?? null,
        createdById: context.user.id,
      },
      include: { createdBy: { select: { id: true, name: true, image: true } } },
    });
    await logActivity({
      organizationId: context.org.id,
      userId: context.user.id,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "nbox",
      subAppSlug: "nbox-items",
      featureKey: input.type === NBoxItemType.FILE ? "nbox.file.uploaded" : "nbox.link.added",
      action: input.type === NBoxItemType.FILE ? "nbox_upload" : "nbox.item.created",
      actionLabel: `Adicionou o ${input.type === NBoxItemType.FILE ? "arquivo" : "link"} "${item.name}" no NBox`,
      resource: item.name,
      resourceId: item.id,
      metadata: { type: item.type, hasFolder: !!input.folderId, size: sizeBytes },
    });

    // Cobra só pra uploads (FILE) — links externos são gratuitos.
    if (input.type === NBoxItemType.FILE) {
      await chargeStarsByAction(context.org.id, "nbox_upload", {
        userId: context.user.id,
        description: `Upload N-Box: ${item.name}`,
        appSlug: "nbox",
      });
    }

    return { item: toNboxItemDto(item) };
  });
