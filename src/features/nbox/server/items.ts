import "server-only";

import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { NBoxItemType } from "@/generated/prisma/enums";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import { canViewRestrictedNBox } from "@/features/nbox/server/can-view-restricted-nbox";
import { finishNboxUpload, NboxUploadError } from "@/features/nbox/server/uploads";
import type { NboxObjectKind } from "@/features/nbox/server/storage-objects";

export interface NboxActor {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

/** Itens da árvore normal: transferências ficam numa seção própria (spec 0148, RF-11). */
export const NBOX_TREE_ITEM_FILTER: Prisma.NBoxItemWhereInput = {
  OR: [{ folderId: null }, { folder: { expiresAt: null } }],
};

/** `size` é BigInt no banco; a tela e o MCP recebem número (até 9 PB cabe sem perda). */
export function toNboxItemDto<Item extends { size: bigint | null }>(item: Item): Omit<Item, "size"> & { size: number | null } {
  return { ...item, size: item.size === null ? null : Number(item.size) };
}

/** Confere a pasta de destino e diz se o arquivo é guardado ou temporário (pasta de transferência). */
export async function assertFolderWritable(
  actor: NboxActor,
  organizationId: string,
  folderId: string | null | undefined,
): Promise<NboxObjectKind> {
  if (!folderId) return "stored";
  const folder = await prisma.nBoxFolder.findFirst({
    where: { id: folderId, organizationId },
    select: { isRestricted: true, expiresAt: true },
  });
  if (!folder) throw new NboxUploadError("Pasta não encontrada.");
  if (folder.expiresAt && folder.expiresAt <= new Date()) throw new NboxUploadError("Esta transferência já expirou.");
  if (folder.isRestricted && !(await canViewRestrictedNBox(actor, organizationId))) {
    throw new NboxUploadError("Pasta restrita: só administradores do financeiro.");
  }
  return folder.expiresAt ? "transfer" : "stored";
}

/**
 * Fecha o envio e cria o item. Idempotente pela chave (CB-3): repetir a chamada devolve o mesmo item.
 */
export async function registerUploadedNboxFile(params: {
  actor: NboxActor;
  organizationId: string;
  folderId: string | null;
  key: string;
  name: string;
  mimeType: string;
  description?: string;
  multipartUploadId?: string;
  parts?: Array<{ partNumber: number; etag: string }>;
}) {
  const existing = await prisma.nBoxItem.findFirst({
    where: { organizationId: params.organizationId, url: params.key },
    include: { createdBy: { select: { id: true, name: true, image: true } } },
  });
  if (existing) return toNboxItemDto(existing);

  const kind = await assertFolderWritable(params.actor, params.organizationId, params.folderId);
  const { sizeBytes } = await finishNboxUpload({
    organizationId: params.organizationId,
    kind,
    key: params.key,
    multipartUploadId: params.multipartUploadId,
    parts: params.parts,
  });

  const type = params.mimeType.startsWith("image/") ? NBoxItemType.IMAGE : NBoxItemType.FILE;
  const item = await prisma.nBoxItem.create({
    data: {
      organizationId: params.organizationId,
      folderId: params.folderId,
      type,
      name: params.name,
      url: params.key,
      mimeType: params.mimeType,
      size: BigInt(sizeBytes),
      description: params.description ?? null,
      createdById: params.actor.id,
    },
    include: { createdBy: { select: { id: true, name: true, image: true } } },
  });

  await logActivity({
    organizationId: params.organizationId,
    userId: params.actor.id,
    userName: params.actor.name,
    userEmail: params.actor.email,
    userImage: params.actor.image ?? null,
    appSlug: "nbox",
    subAppSlug: "nbox-items",
    featureKey: "nbox.file.uploaded",
    action: "nbox_upload",
    actionLabel: `Adicionou o arquivo "${item.name}" no NBox`,
    resource: item.name,
    resourceId: item.id,
    metadata: { type: item.type, hasFolder: !!params.folderId, size: sizeBytes },
  });
  if (kind === "stored") {
    await chargeStarsByAction(params.organizationId, "nbox_upload", {
      userId: params.actor.id,
      description: `Upload N-Box: ${item.name}`,
      appSlug: "nbox",
    });
  }

  return toNboxItemDto(item);
}
