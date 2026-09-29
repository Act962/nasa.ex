// Progresso do assistente "Conectar número oficial" no banco (spec 0040,
// RF-14): passo atual, etapas feitas e rascunhos das chaves — o cliente cola
// cada chave no passo em que a copia e continua depois, em qualquer aparelho.

import "server-only";
import { ORPCError } from "@orpc/server";
import prisma from "@/lib/prisma";
import { decryptSecret, encryptSecret, last4 } from "@/lib/crypto";
import { parseMetaAppPageUrl } from "@/features/campanhas/lib/whatsapp-connect-guide";

export interface MaskedDraft {
  isSaved: boolean;
  last4: string | null;
}

export interface ConnectProgressView {
  guideSlug: string | null;
  doneIds: string[];
  numberSource: "own" | "salvy" | null;
  salvyNumberId: string | null;
  drafts: { accessToken: MaskedDraft; appId: string | null; appSecret: MaskedDraft; businessId: string | null };
}

async function assertTrackingOfOrg(trackingId: string, organizationId: string) {
  const tracking = await prisma.tracking.findFirst({ where: { id: trackingId, organizationId }, select: { id: true } });
  if (!tracking) throw new ORPCError("NOT_FOUND", { message: "Funil não encontrado." });
}

function maskDraft(cipher: string | null): MaskedDraft {
  if (!cipher) return { isSaved: false, last4: null };
  try {
    return { isSaved: true, last4: last4(decryptSecret(cipher)) };
  } catch {
    return { isSaved: false, last4: null };
  }
}

export async function getConnectProgress(params: { organizationId: string; trackingId: string }): Promise<ConnectProgressView> {
  await assertTrackingOfOrg(params.trackingId, params.organizationId);
  const progress = await prisma.whatsAppConnectProgress.findUnique({ where: { trackingId: params.trackingId } });
  return {
    guideSlug: progress?.guideSlug ?? null,
    doneIds: [...new Set(progress?.doneIds ?? [])],
    numberSource: progress?.numberSource === "own" || progress?.numberSource === "salvy" ? progress.numberSource : null,
    salvyNumberId: progress?.salvyNumberId ?? null,
    drafts: {
      accessToken: maskDraft(progress?.draftAccessToken ?? null),
      appId: progress?.draftAppId ?? null,
      appSecret: maskDraft(progress?.draftAppSecret ?? null),
      businessId: progress?.draftBusinessId ?? null,
    },
  };
}

export interface ConnectProgressPatch {
  guideSlug?: string | null;
  addDoneIds?: string[];
  removeDoneIds?: string[];
  numberSource?: "own" | "salvy" | null;
  salvyNumberId?: string | null;
}

export async function saveConnectProgress(params: {
  organizationId: string;
  trackingId: string;
  userId: string;
  patch: ConnectProgressPatch;
}): Promise<ConnectProgressView> {
  await assertTrackingOfOrg(params.trackingId, params.organizationId);
  const { addDoneIds = [], removeDoneIds = [] } = params.patch;
  const fields = {
    updatedById: params.userId,
    ...(params.patch.guideSlug !== undefined ? { guideSlug: params.patch.guideSlug } : {}),
    ...(params.patch.numberSource !== undefined ? { numberSource: params.patch.numberSource } : {}),
    ...(params.patch.salvyNumberId !== undefined ? { salvyNumberId: params.patch.salvyNumberId } : {}),
  };
  // `push` é atômico no Postgres: cliques rápidos em sequência não se sobrescrevem.
  await prisma.whatsAppConnectProgress.upsert({
    where: { trackingId: params.trackingId },
    create: { trackingId: params.trackingId, organizationId: params.organizationId, doneIds: [...new Set(addDoneIds)], ...fields },
    update: { ...fields, ...(addDoneIds.length ? { doneIds: { push: addDoneIds } } : {}) },
  });
  if (removeDoneIds.length) {
    const current = await prisma.whatsAppConnectProgress.findUnique({ where: { trackingId: params.trackingId }, select: { doneIds: true } });
    await prisma.whatsAppConnectProgress.update({
      where: { trackingId: params.trackingId },
      data: { doneIds: (current?.doneIds ?? []).filter((id) => !removeDoneIds.includes(id)) },
    });
  }
  return getConnectProgress(params);
}

/** Confere o formato de cada chave colada — erro na hora, no passo em que ela foi copiada. */
function validateDraft(input: { accessToken?: string; appId?: string; appSecret?: string }) {
  if (input.accessToken !== undefined && !/^EA[A-Za-z0-9]{40,}$/.test(input.accessToken)) {
    throw new ORPCError("BAD_REQUEST", { message: "Isso não é a chave de acesso da Meta: ela começa com EAA e é uma sequência longa só de letras e números, sem espaços. Na Meta, clique em Copiar ao lado da chave e cole aqui de novo." });
  }
  if (input.appId !== undefined && !/^\d{10,20}$/.test(input.appId)) {
    throw new ORPCError("BAD_REQUEST", { message: "O ID do app tem só números (uns 15 dígitos). Copie de novo." });
  }
  if (input.appSecret !== undefined && !/^[a-f0-9]{32}$/i.test(input.appSecret)) {
    throw new ORPCError("BAD_REQUEST", { message: "A chave secreta tem 32 letras e números. Clique em Mostrar e copie de novo." });
  }
}

/** Sem a chave de cifra do servidor, erro claro em vez de 500. */
function encryptDraft(plain: string): string {
  try {
    return encryptSecret(plain);
  } catch {
    throw new ORPCError("PRECONDITION_FAILED", {
      message: "A ÓRBITA ainda não está pronta para guardar chaves com segurança neste ambiente. Avise o suporte.",
    });
  }
}

export async function saveKeyDraft(params: {
  organizationId: string;
  trackingId: string;
  userId: string;
  accessToken?: string;
  appId?: string;
  appSecret?: string;
  /** Endereço de qualquer página do app na Meta: dá o ID do app e o do portfólio. */
  appPageUrl?: string;
  /** Endereço de qualquer página do portfólio (business.facebook.com): dá só o ID do portfólio. */
  businessPageUrl?: string;
}): Promise<ConnectProgressView> {
  await assertTrackingOfOrg(params.trackingId, params.organizationId);
  const fromPage = params.appPageUrl ? parseMetaAppPageUrl(params.appPageUrl) : null;
  if (params.appPageUrl && !fromPage?.appId) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Esse link não é de uma página do app. Copie o endereço da barra do navegador com a página do app aberta.",
    });
  }
  const fromBusinessPage = params.businessPageUrl ? parseMetaAppPageUrl(params.businessPageUrl) : null;
  if (params.businessPageUrl && !fromBusinessPage?.businessId) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Esse link não tem o seu portfólio. Copie o endereço da barra do navegador com a tela de Configurações da Meta aberta.",
    });
  }
  const businessId = fromPage?.businessId ?? fromBusinessPage?.businessId;
  const cleaned = {
    accessToken: params.accessToken?.trim() || undefined,
    appId: params.appId?.replace(/\D/g, "") || fromPage?.appId || undefined,
    appSecret: params.appSecret?.trim() || undefined,
  };
  validateDraft(cleaned);
  const data = {
    ...(businessId ? { draftBusinessId: businessId } : {}),
    updatedById: params.userId,
    ...(cleaned.accessToken ? { draftAccessToken: encryptDraft(cleaned.accessToken) } : {}),
    ...(cleaned.appId ? { draftAppId: cleaned.appId } : {}),
    ...(cleaned.appSecret ? { draftAppSecret: encryptDraft(cleaned.appSecret) } : {}),
  };
  await prisma.whatsAppConnectProgress.upsert({
    where: { trackingId: params.trackingId },
    create: { trackingId: params.trackingId, organizationId: params.organizationId, ...data },
    update: data,
  });
  return getConnectProgress(params);
}

/** Rascunhos em texto puro — só para o servidor conferir na Meta. */
export async function readKeyDrafts(trackingId: string) {
  const progress = await prisma.whatsAppConnectProgress.findUnique({
    where: { trackingId },
    select: { draftAccessToken: true, draftAppId: true, draftAppSecret: true, draftBusinessId: true },
  });
  return {
    businessId: progress?.draftBusinessId ?? null,
    accessToken: progress?.draftAccessToken ? decryptSecret(progress.draftAccessToken) : null,
    appId: progress?.draftAppId ?? null,
    appSecret: progress?.draftAppSecret ? decryptSecret(progress.draftAppSecret) : null,
  };
}

/** Chaves já conferidas e gravadas na instância: o rascunho não precisa mais existir. */
export async function clearKeyDrafts(trackingId: string) {
  await prisma.whatsAppConnectProgress.updateMany({
    where: { trackingId },
    data: { draftAccessToken: null, draftAppSecret: null },
  });
}
