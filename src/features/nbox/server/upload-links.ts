import "server-only";

import { createHash, randomBytes } from "crypto";
import prisma from "@/lib/prisma";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { createNotification, NOTIF_TYPES } from "@/features/admin/lib/notification-service";
import {
  NBOX_UPLOAD_LINK_DAY_OPTIONS,
  NBOX_UPLOAD_LINK_MAX_BYTES,
  NBOX_UPLOAD_LINK_MAX_FILES,
} from "@/features/nbox/lib/storage-limits";
import { deleteNboxObjectIfUnused, registerUploadedNboxFile, toNboxItemDto, type NboxActor } from "@/features/nbox/server/items";
import { NboxUploadError, startNboxUpload } from "@/features/nbox/server/uploads";

// Link para cliente sem conta enviar arquivos a uma pasta (spec 0149). O link é da pasta (D-1): token + data de validade.

const DAY_MS = 24 * 60 * 60 * 1000;
const NOTIFY_INTERVAL_MS = 10 * 60 * 1000;
const SENDER_NAME_MAX_LENGTH = 80;

export const uploadLinkPublicPath = (uploadToken: string) => `/enviar/${uploadToken}`;
export const nboxFolderAppPath = (folderId: string) => `/nbox?pasta=${folderId}`;

const hashUploaderToken = (uploaderToken: string) => createHash("sha256").update(uploaderToken).digest("hex");

function assertUploadLinkDays(days: number) {
  if (!(NBOX_UPLOAD_LINK_DAY_OPTIONS as readonly number[]).includes(days)) {
    throw new NboxUploadError(`A validade é de ${NBOX_UPLOAD_LINK_DAY_OPTIONS.join(", ")} dias.`);
  }
}

const newUploadLinkFields = (days: number) => ({
  uploadToken: randomBytes(18).toString("base64url"),
  uploadExpiresAt: new Date(Date.now() + days * DAY_MS),
});

async function logUploadLinkActivity(actor: NboxActor, organizationId: string, folder: { id: string; name: string }, action: string, actionLabel: string) {
  await logActivity({
    organizationId,
    userId: actor.id,
    userName: actor.name,
    userEmail: actor.email,
    userImage: actor.image ?? null,
    appSlug: "nbox",
    action,
    actionLabel,
    resource: folder.name,
    resourceId: folder.id,
  });
}

/** Cria pasta nova com link de envio, ou liga o link numa pasta existente (RF-1). */
export async function createNboxUploadLink(params: {
  actor: NboxActor;
  organizationId: string;
  days: number;
  target: { kind: "new"; name: string; parentId: string | null } | { kind: "existing"; folderId: string };
}) {
  assertUploadLinkDays(params.days);

  let folderId: string;
  if (params.target.kind === "existing") {
    const folder = await prisma.nBoxFolder.findFirst({
      where: { id: params.target.folderId, organizationId: params.organizationId },
      select: { id: true, isRestricted: true, systemKey: true, expiresAt: true },
    });
    if (!folder) throw new NboxUploadError("Pasta não encontrada.");
    if (folder.isRestricted || folder.systemKey || folder.expiresAt) {
      throw new NboxUploadError("Esta pasta não pode receber arquivos por link.");
    }
    folderId = folder.id;
  } else {
    const name = params.target.name.trim();
    if (!name) throw new NboxUploadError("Dê um nome para a pasta.");
    if (params.target.parentId) {
      const parent = await prisma.nBoxFolder.findFirst({
        where: { id: params.target.parentId, organizationId: params.organizationId },
        select: { isRestricted: true, expiresAt: true },
      });
      if (!parent || parent.isRestricted || parent.expiresAt) throw new NboxUploadError("Pasta de destino inválida.");
    }
    const created = await prisma.nBoxFolder.create({
      data: { organizationId: params.organizationId, name, parentId: params.target.parentId, createdById: params.actor.id },
      select: { id: true },
    });
    folderId = created.id;
  }

  const folder = await prisma.nBoxFolder.update({
    where: { id: folderId },
    data: newUploadLinkFields(params.days),
    select: { id: true, name: true, uploadToken: true, uploadExpiresAt: true },
  });
  await logUploadLinkActivity(
    params.actor,
    params.organizationId,
    folder,
    "nbox.upload_link.created",
    `Criou um link para cliente enviar arquivos à pasta "${folder.name}" (${params.days} dias).`,
  );
  return { folderId: folder.id, path: uploadLinkPublicPath(folder.uploadToken!), uploadExpiresAt: folder.uploadExpiresAt! };
}

/** Prorroga (nova validade a partir de agora), encerra já ou gera link novo, que mata o antigo (RF-2). */
export async function updateNboxUploadLink(params: {
  actor: NboxActor;
  organizationId: string;
  folderId: string;
  action: { kind: "extend"; days: number } | { kind: "end" } | { kind: "regenerate"; days: number };
}) {
  const folder = await prisma.nBoxFolder.findFirst({
    where: { id: params.folderId, organizationId: params.organizationId, uploadToken: { not: null } },
    select: { id: true, name: true },
  });
  if (!folder) throw new NboxUploadError("Esta pasta não tem link de envio.");

  const { action } = params;
  const data =
    action.kind === "end"
      ? { uploadExpiresAt: new Date() }
      : action.kind === "extend"
        ? (assertUploadLinkDays(action.days), { uploadExpiresAt: new Date(Date.now() + action.days * DAY_MS) })
        : (assertUploadLinkDays(action.days), newUploadLinkFields(action.days));

  const updated = await prisma.nBoxFolder.update({
    where: { id: folder.id },
    data,
    select: { uploadToken: true, uploadExpiresAt: true },
  });
  const actionLabels = {
    end: `Encerrou o link de envio da pasta "${folder.name}".`,
    extend: `Prorrogou o link de envio da pasta "${folder.name}".`,
    regenerate: `Gerou um link de envio novo para a pasta "${folder.name}" (o anterior parou de funcionar).`,
  } as const;
  await logUploadLinkActivity(params.actor, params.organizationId, folder, `nbox.upload_link.${action.kind}`, actionLabels[action.kind]);
  return { path: uploadLinkPublicPath(updated.uploadToken!), uploadExpiresAt: updated.uploadExpiresAt! };
}

// ── Lado público: sem login, identificado pelo token do link + código do navegador ──

async function loadUploadLinkFolder(uploadToken: string) {
  if (!uploadToken || uploadToken.length < 16) return null;
  return prisma.nBoxFolder.findUnique({
    where: { uploadToken },
    select: {
      id: true,
      name: true,
      organizationId: true,
      isRestricted: true,
      uploadExpiresAt: true,
      createdBy: { select: { id: true, name: true, email: true, image: true } },
      organization: { select: { name: true, logo: true } },
    },
  });
}

type UploadLinkFolder = NonNullable<Awaited<ReturnType<typeof loadUploadLinkFolder>>>;

const isUploadLinkOpen = (folder: UploadLinkFolder) =>
  !folder.isRestricted && !!folder.uploadExpiresAt && folder.uploadExpiresAt > new Date();

async function loadOpenUploadLink(uploadToken: string): Promise<UploadLinkFolder> {
  const folder = await loadUploadLinkFolder(uploadToken);
  if (!folder || !isUploadLinkOpen(folder)) throw new NboxUploadError("Este link de envio foi encerrado.");
  return folder;
}

async function assertUploadLinkHasRoom(folderId: string, extraBytes: number) {
  const usage = await prisma.nBoxItem.aggregate({
    where: { folderId, uploaderTokenHash: { not: null } },
    _sum: { size: true },
    _count: true,
  });
  if (usage._count + 1 > NBOX_UPLOAD_LINK_MAX_FILES) {
    throw new NboxUploadError(`Este link já recebeu o máximo de ${NBOX_UPLOAD_LINK_MAX_FILES} arquivos.`);
  }
  if (Number(usage._sum.size ?? BigInt(0)) + extraBytes > NBOX_UPLOAD_LINK_MAX_BYTES) {
    throw new NboxUploadError("Este link chegou ao limite de 20 GB. Peça um link novo para quem te enviou.");
  }
}

const listSenderItems = (folderId: string, uploaderTokenHash: string) =>
  prisma.nBoxItem.findMany({
    where: { folderId, uploaderTokenHash },
    select: { id: true, name: true, size: true, mimeType: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

/** Cabeçalho da página `/enviar/<token>` (renderizado no servidor, sem a lista do navegador). */
export async function getNboxUploadLinkSummary(uploadToken: string) {
  const folder = await loadUploadLinkFolder(uploadToken);
  if (!folder) return null;
  return {
    folderName: folder.name,
    companyName: folder.organization.name,
    companyLogo: folder.organization.logo,
    uploadExpiresAt: folder.uploadExpiresAt,
    isOpen: isUploadLinkOpen(folder),
  };
}

/** Dados da página `/enviar/<token>`. Mostra só o que este navegador enviou (RF-4). */
export async function getPublicNboxUploadLink(uploadToken: string, uploaderToken: string) {
  const folder = await loadUploadLinkFolder(uploadToken);
  if (!folder) return null;
  const isOpen = isUploadLinkOpen(folder);
  const myItems = isOpen ? await listSenderItems(folder.id, hashUploaderToken(uploaderToken)) : [];
  return {
    folderName: folder.name,
    companyName: folder.organization.name,
    companyLogo: folder.organization.logo,
    uploadExpiresAt: folder.uploadExpiresAt,
    isOpen,
    myItems: myItems.map(toNboxItemDto),
  };
}

export async function startPublicNboxUpload(params: {
  uploadToken: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}) {
  const folder = await loadOpenUploadLink(params.uploadToken);
  await assertUploadLinkHasRoom(folder.id, params.sizeBytes);
  return startNboxUpload({
    organizationId: folder.organizationId,
    kind: "stored",
    fileName: params.fileName,
    contentType: params.contentType,
    sizeBytes: params.sizeBytes,
  });
}

export async function completePublicNboxUpload(params: {
  uploadToken: string;
  uploaderToken: string;
  senderName?: string;
  key: string;
  fileName: string;
  contentType: string;
  multipartUploadId?: string;
  parts?: Array<{ partNumber: number; etag: string }>;
}) {
  const folder = await loadUploadLinkFolder(params.uploadToken);
  if (!folder || !isUploadLinkOpen(folder)) {
    // CB-1: venceu no meio do envio. O objeto é desta empresa e ainda não virou item.
    if (folder) await deleteNboxObjectIfUnused(folder.organizationId, params.key);
    throw new NboxUploadError("Este link de envio foi encerrado.");
  }
  const senderName = params.senderName?.trim().slice(0, SENDER_NAME_MAX_LENGTH);
  const item = await registerUploadedNboxFile({
    actor: folder.createdBy,
    organizationId: folder.organizationId,
    folderId: folder.id,
    key: params.key,
    name: params.fileName,
    mimeType: params.contentType,
    description: senderName ? `Enviado por ${senderName} pelo link de envio.` : "Enviado pelo link de envio.",
    multipartUploadId: params.multipartUploadId,
    parts: params.parts,
    viaUploadLink: {
      uploaderTokenHash: hashUploaderToken(params.uploaderToken),
      assertFits: (sizeBytes) => assertUploadLinkHasRoom(folder.id, sizeBytes),
    },
  });
  return { id: item.id, name: item.name, size: item.size, mimeType: item.mimeType, createdAt: item.createdAt };
}

/** O cliente apaga só o que ele mesmo enviou, e só enquanto o link vale (RF-4, CA-4). */
export async function deletePublicNboxUpload(params: { uploadToken: string; uploaderToken: string; itemId: string }) {
  const folder = await loadOpenUploadLink(params.uploadToken);
  const item = await prisma.nBoxItem.findFirst({
    where: { id: params.itemId, folderId: folder.id, uploaderTokenHash: hashUploaderToken(params.uploaderToken) },
    select: { id: true, url: true },
  });
  if (!item) throw new NboxUploadError("Arquivo não encontrado.");
  await prisma.nBoxItem.delete({ where: { id: item.id } });
  await deleteNboxObjectIfUnused(folder.organizationId, item.url);
}

/** Avisa quem criou o link que chegaram arquivos; no máximo um aviso a cada 10 min por link (RF-6). */
export async function notifyPublicNboxUploadFinished(params: { uploadToken: string; uploaderToken: string; senderName?: string }) {
  const folder = await loadUploadLinkFolder(params.uploadToken);
  if (!folder) return;
  const actionUrl = nboxFolderAppPath(folder.id);
  const recentNotice = await prisma.adminNotification.findFirst({
    where: {
      targetId: folder.createdBy.id,
      type: NOTIF_TYPES.NBOX_FILES_RECEIVED,
      actionUrl,
      createdAt: { gt: new Date(Date.now() - NOTIFY_INTERVAL_MS) },
    },
    select: { id: true },
  });
  if (recentNotice) return;

  const sentCount = await prisma.nBoxItem.count({
    where: {
      folderId: folder.id,
      uploaderTokenHash: hashUploaderToken(params.uploaderToken),
      createdAt: { gt: new Date(Date.now() - NOTIFY_INTERVAL_MS) },
    },
  });
  if (sentCount === 0) return;
  const senderName = params.senderName?.trim().slice(0, SENDER_NAME_MAX_LENGTH);
  await createNotification({
    userId: folder.createdBy.id,
    organizationId: folder.organizationId,
    type: NOTIF_TYPES.NBOX_FILES_RECEIVED,
    title: "Arquivos recebidos no Nbox",
    body: `${senderName || "Um cliente"} enviou ${sentCount} ${sentCount === 1 ? "arquivo" : "arquivos"} para a pasta "${folder.name}".`,
    actionUrl,
    skipWhatsApp: true,
  });
}
