import "server-only";
import prisma from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { MetaPublishAccountKind, MetaPublishAccountStatus } from "@/generated/prisma/enums";
import { listInstagramPublishAccounts } from "./instagram-channels";

/** Registro das contas de publicação de cada org (spec 0057, RF-1): token cifrado, nunca devolvido ao navegador. */

export interface PublishPageInput {
  id: string;
  name?: string | null;
  access_token: string;
}

export interface PublishIgInput {
  id: string;
  page_id: string;
  username?: string | null;
  profile_picture_url?: string | null;
}

export async function upsertPublishAccounts(organizationId: string, pages: PublishPageInput[], igAccounts: PublishIgInput[]) {
  const tokenByPageId = new Map(pages.filter((page) => page.access_token).map((page) => [page.id, page] as const));

  for (const page of tokenByPageId.values()) {
    await prisma.metaPublishAccount.upsert({
      where: { organizationId_kind_pageId: { organizationId, kind: MetaPublishAccountKind.FB_PAGE, pageId: page.id } },
      update: { pageName: page.name ?? null, accessTokenEnc: encryptSecret(page.access_token), status: MetaPublishAccountStatus.ACTIVE, lastErrorCode: null, lastErrorMessage: null },
      create: { organizationId, kind: MetaPublishAccountKind.FB_PAGE, pageId: page.id, pageName: page.name ?? null, accessTokenEnc: encryptSecret(page.access_token) },
    });
  }

  for (const igAccount of igAccounts) {
    const page = tokenByPageId.get(igAccount.page_id);
    if (!page) continue;
    const igFields = {
      pageName: page.name ?? null,
      igUserId: igAccount.id,
      igUsername: igAccount.username ?? null,
      profilePictureUrl: igAccount.profile_picture_url ?? null,
      accessTokenEnc: encryptSecret(page.access_token),
    };
    await prisma.metaPublishAccount.upsert({
      where: { organizationId_kind_pageId: { organizationId, kind: MetaPublishAccountKind.IG_BUSINESS, pageId: page.id } },
      update: { ...igFields, status: MetaPublishAccountStatus.ACTIVE, lastErrorCode: null, lastErrorMessage: null },
      create: { organizationId, kind: MetaPublishAccountKind.IG_BUSINESS, pageId: page.id, ...igFields },
    });
  }
}

export const PUBLIC_ACCOUNT_SELECT = {
  id: true,
  organizationId: true,
  kind: true,
  pageId: true,
  pageName: true,
  igUserId: true,
  igUsername: true,
  profilePictureUrl: true,
  status: true,
  lastErrorMessage: true,
} as const;

/** Destinos de publicação: Instagram vem das contas dos Satélites (spec 0071); páginas do Facebook, da conexão da Meta. */
export async function listPublishAccounts(organizationIds: string[]) {
  if (organizationIds.length === 0) return [];
  const [instagramAccounts, facebookPages] = await Promise.all([
    listInstagramPublishAccounts(organizationIds),
    prisma.metaPublishAccount.findMany({
      where: { organizationId: { in: organizationIds }, kind: MetaPublishAccountKind.FB_PAGE, status: { not: MetaPublishAccountStatus.DISABLED } },
      select: PUBLIC_ACCOUNT_SELECT,
      orderBy: { pageName: "asc" },
    }),
  ]);
  return [...instagramAccounts, ...facebookPages.map((page) => ({ ...page, kind: "FB_PAGE" as const, canPublish: null }))];
}

export async function findPublishAccountWithToken(
  organizationId: string,
  target: { kind: "IG_BUSINESS"; igUserId: string } | { kind: "FB_PAGE"; pageId: string },
) {
  const account = await prisma.metaPublishAccount.findFirst({
    where:
      target.kind === "IG_BUSINESS"
        ? { organizationId, kind: MetaPublishAccountKind.IG_BUSINESS, igUserId: target.igUserId }
        : { organizationId, kind: MetaPublishAccountKind.FB_PAGE, pageId: target.pageId },
  });
  if (!account) return null;
  return { account, accessToken: decryptSecret(account.accessTokenEnc) };
}

export async function markPublishAccountError(accountId: string, code: string, message: string, needsReconnect: boolean) {
  await prisma.metaPublishAccount.update({
    where: { id: accountId },
    data: {
      lastErrorCode: code,
      lastErrorMessage: message,
      lastCheckedAt: new Date(),
      ...(needsReconnect && { status: MetaPublishAccountStatus.NEEDS_RECONNECT }),
    },
  });
}
