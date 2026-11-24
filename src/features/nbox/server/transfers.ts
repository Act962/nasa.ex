import "server-only";

import { randomBytes } from "crypto";
import prisma from "@/lib/prisma";
import { NBoxItemType } from "@/generated/prisma/enums";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { NBOX_TRANSFER_MAX_DAYS } from "@/features/nbox/lib/storage-limits";
import { toNboxItemDto, type NboxActor } from "@/features/nbox/server/items";
import { assertNboxStorageAvailable } from "@/features/nbox/server/storage-usage";
import {
  buildNboxObjectKey,
  copyStoredObject,
  createDownloadUrl,
  deleteNboxObjectIfOwned,
} from "@/features/nbox/server/storage-objects";
import { NboxUploadError } from "@/features/nbox/server/uploads";

// Transferência com prazo (spec 0148, D-3): uma pasta fora da árvore, com link público e data para sumir.

const DAY_MS = 24 * 60 * 60 * 1000;
const TRANSFER_DOWNLOAD_URL_TTL_SECONDS = 15 * 60;
const TRANSFER_LIST_LIMIT = 50;
const PURGE_BATCH_SIZE = 200;

const transferItemSelect = { id: true, name: true, size: true, mimeType: true, type: true } as const;

export const transferPublicPath = (shareToken: string) => `/t/${shareToken}`;

function assertTransferDays(days: number) {
  if (!Number.isInteger(days) || days < 1 || days > NBOX_TRANSFER_MAX_DAYS) {
    throw new NboxUploadError(`O prazo vai de 1 a ${NBOX_TRANSFER_MAX_DAYS} dias.`);
  }
}

function defaultTransferName(now: Date) {
  return `Transferência ${now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`;
}

/** Cria a transferência e copia para ela os arquivos já guardados no Nbox (CB-6: o original fica onde estava). */
export async function createNboxTransfer(params: {
  actor: NboxActor;
  organizationId: string;
  name?: string;
  days: number;
  existingItemIds?: string[];
}) {
  assertTransferDays(params.days);
  const existingItemIds = [...new Set(params.existingItemIds ?? [])];

  const sourceItems = existingItemIds.length
    ? await prisma.nBoxItem.findMany({
        where: { id: { in: existingItemIds }, organizationId: params.organizationId },
        select: { id: true, name: true, url: true, mimeType: true, size: true, type: true, folder: { select: { isRestricted: true } } },
      })
    : [];
  if (sourceItems.length !== existingItemIds.length) throw new NboxUploadError("Arquivo não encontrado.");
  if (sourceItems.some((item) => item.folder?.isRestricted)) {
    throw new NboxUploadError("Arquivos da pasta restrita não podem ser transferidos.");
  }
  if (sourceItems.some((item) => item.type !== NBoxItemType.FILE && item.type !== NBoxItemType.IMAGE)) {
    throw new NboxUploadError("Só arquivos e imagens podem ir numa transferência.");
  }
  if (sourceItems.some((item) => !item.url || /^https?:\/\//.test(item.url))) {
    throw new NboxUploadError("Este arquivo não está guardado no Nbox e não pode ser transferido.");
  }
  const copiedBytes = sourceItems.reduce((total, item) => total + Number(item.size ?? BigInt(0)), 0);
  if (copiedBytes > 0) await assertNboxStorageAvailable(params.organizationId, copiedBytes);

  const now = new Date();
  const folder = await prisma.nBoxFolder.create({
    data: {
      organizationId: params.organizationId,
      name: params.name?.trim() || defaultTransferName(now),
      createdById: params.actor.id,
      expiresAt: new Date(now.getTime() + params.days * DAY_MS),
      shareToken: randomBytes(18).toString("base64url"),
    },
    select: { id: true, name: true, expiresAt: true, shareToken: true },
  });

  for (const sourceItem of sourceItems) {
    const targetKey = buildNboxObjectKey(params.organizationId, sourceItem.name, "transfer");
    await copyStoredObject(sourceItem.url!, targetKey);
    await prisma.nBoxItem.create({
      data: {
        organizationId: params.organizationId,
        folderId: folder.id,
        type: sourceItem.type,
        name: sourceItem.name,
        url: targetKey,
        mimeType: sourceItem.mimeType,
        size: sourceItem.size,
        createdById: params.actor.id,
      },
    });
  }

  await logActivity({
    organizationId: params.organizationId,
    userId: params.actor.id,
    userName: params.actor.name,
    userEmail: params.actor.email,
    userImage: params.actor.image ?? null,
    appSlug: "nbox",
    action: "nbox.transfer.created",
    actionLabel: `Criou a transferência "${folder.name}" (${params.days} ${params.days === 1 ? "dia" : "dias"}) — qualquer pessoa com o link pode baixar.`,
    resource: folder.name,
    resourceId: folder.id,
    metadata: { days: params.days, copiedItems: sourceItems.length },
  });

  return { transferId: folder.id, name: folder.name, expiresAt: folder.expiresAt!, path: transferPublicPath(folder.shareToken!) };
}

export async function listNboxTransfers(organizationId: string) {
  const folders = await prisma.nBoxFolder.findMany({
    where: { organizationId, expiresAt: { not: null } },
    select: {
      id: true,
      name: true,
      expiresAt: true,
      shareToken: true,
      createdAt: true,
      items: { select: transferItemSelect, orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
    take: TRANSFER_LIST_LIMIT,
  });
  return folders.map((folder) => ({
    id: folder.id,
    name: folder.name,
    expiresAt: folder.expiresAt!,
    createdAt: folder.createdAt,
    path: transferPublicPath(folder.shareToken!),
    maxExpiresAt: transferMaxExpiresAt(folder.createdAt),
    items: folder.items.map(toNboxItemDto),
  }));
}

/** Último instante em que a transferência pode valer: 7 dias depois da criação (D-8). */
export const transferMaxExpiresAt = (createdAt: Date) => new Date(createdAt.getTime() + NBOX_TRANSFER_MAX_DAYS * DAY_MS);

/** Prorroga até o teto de 7 dias desde a criação ou encerra já. Vencida não volta (CB-7). */
export async function updateNboxTransfer(params: {
  actor: NboxActor;
  organizationId: string;
  transferId: string;
  action: { kind: "extend" } | { kind: "end" };
}) {
  const folder = await prisma.nBoxFolder.findFirst({
    where: { id: params.transferId, organizationId: params.organizationId, expiresAt: { not: null } },
    select: { id: true, name: true, expiresAt: true, createdAt: true },
  });
  if (!folder) throw new NboxUploadError("Transferência não encontrada.");
  const now = new Date();
  if (folder.expiresAt! <= now) throw new NboxUploadError("Esta transferência já expirou. Crie outra.");

  let expiresAt = now;
  if (params.action.kind === "extend") {
    expiresAt = transferMaxExpiresAt(folder.createdAt);
    if (folder.expiresAt! >= expiresAt) {
      throw new NboxUploadError(`Esta transferência já vale o máximo de ${NBOX_TRANSFER_MAX_DAYS} dias. Para mais tempo, crie outra.`);
    }
  }
  await prisma.nBoxFolder.update({ where: { id: folder.id }, data: { expiresAt } });

  await logActivity({
    organizationId: params.organizationId,
    userId: params.actor.id,
    userName: params.actor.name,
    userEmail: params.actor.email,
    userImage: params.actor.image ?? null,
    appSlug: "nbox",
    action: params.action.kind === "end" ? "nbox.transfer.ended" : "nbox.transfer.extended",
    actionLabel:
      params.action.kind === "end"
        ? `Encerrou a transferência "${folder.name}" — o link parou de funcionar.`
        : `Prorrogou a transferência "${folder.name}" até o limite de ${NBOX_TRANSFER_MAX_DAYS} dias.`,
    resource: folder.name,
    resourceId: folder.id,
  });
  return { transferId: folder.id, expiresAt };
}

async function loadTransferByToken(shareToken: string) {
  if (!shareToken || shareToken.length < 16) return null;
  return prisma.nBoxFolder.findUnique({
    where: { shareToken },
    select: {
      id: true,
      name: true,
      expiresAt: true,
      organization: { select: { name: true, logo: true } },
      items: { select: { ...transferItemSelect, url: true }, orderBy: { createdAt: "asc" } },
    },
  });
}

/** Dados da página pública `/t/<token>`. Nunca expõe chave do arquivo nem ids da empresa. */
export async function getPublicNboxTransfer(shareToken: string) {
  const folder = await loadTransferByToken(shareToken);
  if (!folder?.expiresAt) return null;
  const isExpired = folder.expiresAt <= new Date();
  return {
    name: folder.name,
    companyName: folder.organization.name,
    companyLogo: folder.organization.logo,
    expiresAt: folder.expiresAt,
    isExpired,
    items: isExpired
      ? []
      : folder.items.map((item) => ({
          id: item.id,
          name: item.name,
          type: item.type,
          size: item.size === null ? null : Number(item.size),
          mimeType: item.mimeType,
        })),
  };
}

export async function createPublicTransferDownloadUrl(shareToken: string, itemId: string): Promise<string | null> {
  const folder = await loadTransferByToken(shareToken);
  if (!folder?.expiresAt || folder.expiresAt <= new Date()) return null;
  const item = folder.items.find((candidate) => candidate.id === itemId);
  if (!item?.url || /^https?:\/\//.test(item.url)) return null;
  return createDownloadUrl(item.url, item.name, TRANSFER_DOWNLOAD_URL_TTL_SECONDS);
}

/** Apaga arquivos e registros das transferências vencidas (D-4). Chamado pela limpeza diária. */
export async function purgeExpiredNboxTransfers(): Promise<{ transfers: number; files: number }> {
  const expiredFolders = await prisma.nBoxFolder.findMany({
    where: { expiresAt: { lt: new Date() } },
    select: { id: true, organizationId: true, items: { select: { id: true, url: true } } },
    take: PURGE_BATCH_SIZE,
  });
  let files = 0;
  for (const folder of expiredFolders) {
    for (const item of folder.items) {
      await deleteNboxObjectIfOwned(folder.organizationId, item.url);
      files += 1;
    }
    await prisma.$transaction([
      prisma.nBoxItem.deleteMany({ where: { folderId: folder.id } }),
      prisma.nBoxFolder.delete({ where: { id: folder.id } }),
    ]);
  }
  return { transfers: expiredFolders.length, files };
}

