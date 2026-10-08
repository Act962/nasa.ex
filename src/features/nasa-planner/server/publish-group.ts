import "server-only";
import { randomUUID } from "node:crypto";
import { ORPCError } from "@orpc/server";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { NasaPlannerPostStatus } from "@/generated/prisma/enums";
import { buildBrandChecklist } from "../lib/brand-checklist";
import { approvePost, reopenPostAfterEdit, requestPostChanges, submitPostForApproval } from "./approval";
import { getBrandChecklistRulesForPost } from "./brand-kit/brand-kits";
import { listInstagramPublishAccounts } from "./publishing/instagram-channels";
import { requestImmediatePublish, schedulePlannerPost, unschedulePlannerPost } from "./scheduling";

/**
 * Mesmo conteúdo em várias contas do Instagram (spec 0074): cada conta tem o seu post ("irmão"),
 * ligados por `publishGroupId`. O fluxo de publicação não sabe de grupo — cada irmão publica sozinho.
 */

export const MIN_GROUP_ACCOUNTS = 2;
export const MAX_GROUP_ACCOUNTS = 10;
export const MAX_STAGGER_MINUTES = 30;
const MINUTE_MS = 60_000;

export type GroupScope = "post" | "group";

/** Publicado ou publicando: o grupo não mexe mais neste irmão (RF-6). */
const LOCKED_STATUSES: NasaPlannerPostStatus[] = [NasaPlannerPostStatus.PUBLISHING, NasaPlannerPostStatus.PUBLISHED];

const isLocked = (status: NasaPlannerPostStatus) => LOCKED_STATUSES.includes(status);

const GROUP_CONTENT_FIELDS = [
  "type",
  "title",
  "script",
  "objective",
  "cta",
  "caption",
  "hashtags",
  "pillarId",
  "momentKey",
  "thumbnail",
  "videoKey",
  "videoDuration",
  "logoKey",
] as const;

const contentSelect = {
  id: true,
  organizationId: true,
  status: true,
  publishGroupId: true,
  isGroupContentDetached: true,
  type: true,
  title: true,
  script: true,
  objective: true,
  cta: true,
  caption: true,
  hashtags: true,
  pillarId: true,
  momentKey: true,
  thumbnail: true,
  videoKey: true,
  videoDuration: true,
  logoKey: true,
  slides: {
    orderBy: { order: "asc" },
    select: { order: true, imageKey: true, videoKey: true, targetFormat: true, headline: true, subtext: true, overlayConfig: true },
  },
} satisfies Prisma.NasaPlannerPostSelect;

type PostContent = Prisma.NasaPlannerPostGetPayload<{ select: typeof contentSelect }>;

function pickContentFields(post: PostContent) {
  return Object.fromEntries(GROUP_CONTENT_FIELDS.map((field) => [field, post[field]])) as Pick<PostContent, (typeof GROUP_CONTENT_FIELDS)[number]>;
}

function toSlideRows(postId: string, slides: PostContent["slides"]): Prisma.NasaPlannerPostSlideCreateManyInput[] {
  return slides.map((slide) => ({ ...slide, postId, overlayConfig: (slide.overlayConfig ?? {}) as Prisma.InputJsonValue }));
}

const contentFingerprint = (post: PostContent) => JSON.stringify({ fields: pickContentFields(post), slides: post.slides });

async function copyContent(source: PostContent, targets: PostContent[]) {
  if (targets.length === 0) return;
  await prisma.$transaction(async (tx) => {
    for (const target of targets) {
      await tx.nasaPlannerPost.update({ where: { id: target.id }, data: pickContentFields(source) });
      await tx.nasaPlannerPostSlide.deleteMany({ where: { postId: target.id } });
      if (source.slides.length > 0) await tx.nasaPlannerPostSlide.createMany({ data: toSlideRows(target.id, source.slides) });
    }
  });
}

/** Posts do grupo, do mais antigo para o mais novo. Post sem grupo devolve só ele. */
export async function listPublishGroupPostIds(postId: string): Promise<string[]> {
  const post = await prisma.nasaPlannerPost.findUniqueOrThrow({ where: { id: postId }, select: { publishGroupId: true } });
  if (!post.publishGroupId) return [postId];
  const siblings = await prisma.nasaPlannerPost.findMany({
    where: { publishGroupId: post.publishGroupId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  return siblings.map((sibling) => sibling.id);
}

/**
 * Chamada depois de toda escrita de conteúdo ou mídia de um post (RF-4): leva a mudança aos irmãos em
 * sincronia. Irmão que recebeu mudança e já estava aprovado ou programado é reaberto (CB-3).
 */
export async function syncPublishGroupContent(postId: string, actorId: string) {
  const source = await prisma.nasaPlannerPost.findUnique({ where: { id: postId }, select: contentSelect });
  if (!source?.publishGroupId || source.isGroupContentDetached) return { syncedPostIds: [] };
  const siblings = await prisma.nasaPlannerPost.findMany({
    where: { publishGroupId: source.publishGroupId, id: { not: source.id }, isGroupContentDetached: false, status: { notIn: LOCKED_STATUSES } },
    select: contentSelect,
  });
  const sourceFingerprint = contentFingerprint(source);
  const outdatedSiblings = siblings.filter((sibling) => contentFingerprint(sibling) !== sourceFingerprint);
  await copyContent(source, outdatedSiblings);
  for (const sibling of outdatedSiblings) await reopenPostAfterEdit(sibling.id, actorId);
  return { syncedPostIds: outdatedSiblings.map((sibling) => sibling.id) };
}

export async function assertInstagramAccountsOfOrganization(organizationId: string, instagramAccountIds: string[]) {
  if (new Set(instagramAccountIds).size !== instagramAccountIds.length) {
    throw new ORPCError("BAD_REQUEST", { message: "A mesma conta do Instagram foi escolhida mais de uma vez." });
  }
  if (instagramAccountIds.length > MAX_GROUP_ACCOUNTS) {
    throw new ORPCError("BAD_REQUEST", { message: `Escolha até ${MAX_GROUP_ACCOUNTS} contas do Instagram por conteúdo.` });
  }
  const connectedAccountIds = (await listInstagramPublishAccounts([organizationId])).map((account) => account.igUserId);
  const unknownAccountId = instagramAccountIds.find((accountId) => !connectedAccountIds.includes(accountId));
  if (unknownAccountId) {
    throw new ORPCError("BAD_REQUEST", { message: "Uma das contas escolhidas não está conectada nos Satélites deste cliente." });
  }
}

/** MCP e Astro escolhem as contas pelo @; aqui viram os ids que o post guarda (RF-17). */
export async function resolveInstagramAccountIdsByHandle(organizationId: string, instagramHandles: string[]) {
  const accounts = await listInstagramPublishAccounts([organizationId]);
  return instagramHandles.map((instagramHandle) => {
    const normalizedHandle = instagramHandle.trim().replace(/^@/, "").toLowerCase();
    const account = accounts.find((candidate) => candidate.igUsername?.toLowerCase() === normalizedHandle);
    if (!account) throw new ORPCError("BAD_REQUEST", { message: `A conta @${normalizedHandle} não está conectada nos Satélites deste cliente.` });
    return account.igUserId;
  });
}

type NewPostData = Omit<Prisma.NasaPlannerPostUncheckedCreateInput, "targetIgAccountId" | "publishGroupId" | "isGroupContentDetached">;

/**
 * Cria um post por conta (RF-2). Com uma conta ou nenhuma, cria um post comum.
 * O Facebook fica só no primeiro irmão: senão a mesma página receberia o post N vezes (D-5).
 */
export async function createPostsForInstagramAccounts(postData: NewPostData, instagramAccountIds: string[]) {
  if (instagramAccountIds.length < MIN_GROUP_ACCOUNTS) {
    return [await prisma.nasaPlannerPost.create({ data: { ...postData, targetIgAccountId: instagramAccountIds[0] } })];
  }
  await assertInstagramAccountsOfOrganization(postData.organizationId, instagramAccountIds);
  const publishGroupId = randomUUID();
  const targetNetworks = Array.isArray(postData.targetNetworks) ? postData.targetNetworks : [];
  return prisma.$transaction(
    instagramAccountIds.map((instagramAccountId, accountIndex) =>
      prisma.nasaPlannerPost.create({
        data: {
          ...postData,
          publishGroupId,
          targetIgAccountId: instagramAccountId,
          ...(accountIndex > 0 && { targetNetworks: targetNetworks.filter((network) => network !== "FACEBOOK"), targetFbPageId: null }),
        },
      }),
    ),
  );
}

/** Grupo que ficou com um post só volta a ser post comum (CB-8). */
async function dissolveSingletonGroup(publishGroupId: string) {
  const remainingPosts = await prisma.nasaPlannerPost.findMany({ where: { publishGroupId }, select: { id: true }, take: 2 });
  if (remainingPosts.length !== 1) return;
  await prisma.nasaPlannerPost.update({ where: { id: remainingPosts[0].id }, data: { publishGroupId: null, isGroupContentDetached: false } });
}

/**
 * Define em quais contas o conteúdo sai (RF-3): cria os irmãos que faltam copiando o post aberto e apaga
 * os das contas desmarcadas. Devolve o post que o criador deve manter aberto.
 */
export async function setPublishGroupAccounts(input: { postId: string; instagramAccountIds: string[]; actorId: string; canDeleteOthersPosts: boolean }) {
  if (input.instagramAccountIds.length === 0) throw new ORPCError("BAD_REQUEST", { message: "Escolha pelo menos uma conta do Instagram." });
  const openPost = await prisma.nasaPlannerPost.findUniqueOrThrow({ where: { id: input.postId }, select: { ...contentSelect, plannerId: true, createdById: true, targetIgAccountId: true, scheduledAt: true, source: true, sourceActorLabel: true } });
  await assertInstagramAccountsOfOrganization(openPost.organizationId, input.instagramAccountIds);

  const groupPosts = openPost.publishGroupId
    ? await prisma.nasaPlannerPost.findMany({
        where: { publishGroupId: openPost.publishGroupId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true, status: true, targetIgAccountId: true, createdById: true },
      })
    : [{ id: openPost.id, status: openPost.status, targetIgAccountId: openPost.targetIgAccountId, createdById: openPost.createdById }];

  const postsToRemove = groupPosts.filter((groupPost) => !groupPost.targetIgAccountId || !input.instagramAccountIds.includes(groupPost.targetIgAccountId));
  const lockedRemoval = postsToRemove.find((groupPost) => isLocked(groupPost.status));
  if (lockedRemoval) throw new ORPCError("BAD_REQUEST", { message: "Este conteúdo já foi publicado em uma das contas desmarcadas. Ela não pode sair do grupo." });

  const existingAccountIds = groupPosts.map((groupPost) => groupPost.targetIgAccountId);
  const accountIdsToAdd = input.instagramAccountIds.filter((accountId) => !existingAccountIds.includes(accountId));
  const publishGroupId = openPost.publishGroupId ?? randomUUID();

  // A conta do post aberto foi desmarcada: ele passa para a primeira conta nova, para o criador não perder o post.
  const isOpenPostRemoved = postsToRemove.some((groupPost) => groupPost.id === openPost.id);
  const reassignedAccountId = isOpenPostRemoved ? accountIdsToAdd.shift() : undefined;
  const postsToDelete = postsToRemove.filter((groupPost) => groupPost.id !== openPost.id || !reassignedAccountId);
  assertCanDeleteAll(postsToDelete, { id: input.actorId, canDeleteOthersPosts: input.canDeleteOthersPosts });
  const postIdsToDelete = postsToDelete.map((groupPost) => groupPost.id);
  const newSiblingStatus = openPost.status === NasaPlannerPostStatus.IDEA ? NasaPlannerPostStatus.IDEA : NasaPlannerPostStatus.DRAFT;

  await prisma.$transaction(async (tx) => {
    if (postIdsToDelete.length > 0) await tx.nasaPlannerPost.deleteMany({ where: { id: { in: postIdsToDelete } } });
    if (!postIdsToDelete.includes(openPost.id)) {
      await tx.nasaPlannerPost.update({ where: { id: openPost.id }, data: { publishGroupId, ...(reassignedAccountId && { targetIgAccountId: reassignedAccountId }) } });
    }
    for (const instagramAccountId of accountIdsToAdd) {
      const createdSibling = await tx.nasaPlannerPost.create({
        data: {
          ...pickContentFields(openPost),
          organizationId: openPost.organizationId,
          plannerId: openPost.plannerId,
          createdById: input.actorId,
          status: newSiblingStatus,
          scheduledAt: openPost.status === NasaPlannerPostStatus.SCHEDULED ? null : openPost.scheduledAt,
          targetNetworks: ["INSTAGRAM"],
          targetIgAccountId: instagramAccountId,
          publishGroupId,
          source: openPost.source,
          sourceActorLabel: openPost.sourceActorLabel,
        },
        select: { id: true },
      });
      if (openPost.slides.length > 0) await tx.nasaPlannerPostSlide.createMany({ data: toSlideRows(createdSibling.id, openPost.slides) });
    }
  });

  // Trocar a conta de um post aprovado ou programado o reabre, como em `posts.update`.
  if (reassignedAccountId) await reopenPostAfterEdit(openPost.id, input.actorId);
  await dissolveSingletonGroup(publishGroupId);

  if (!postIdsToDelete.includes(openPost.id)) return { postId: openPost.id };
  const survivingPost = await prisma.nasaPlannerPost.findFirst({ where: { publishGroupId }, orderBy: { createdAt: "asc" }, select: { id: true } });
  return { postId: survivingPost?.id ?? null };
}

/** "Diferente nesta conta" (RF-5). Ao voltar a sincronizar, o post recebe o conteúdo do grupo. */
export async function setPublishGroupDetached(input: { postId: string; isDetached: boolean; actorId: string }) {
  const post = await prisma.nasaPlannerPost.findUniqueOrThrow({ where: { id: input.postId }, select: contentSelect });
  if (!post.publishGroupId) throw new ORPCError("BAD_REQUEST", { message: "Este post não faz parte de um grupo de contas." });
  await prisma.nasaPlannerPost.update({ where: { id: post.id }, data: { isGroupContentDetached: input.isDetached } });
  if (input.isDetached || isLocked(post.status)) return;

  const groupSource = await prisma.nasaPlannerPost.findFirst({
    where: { publishGroupId: post.publishGroupId, id: { not: post.id }, isGroupContentDetached: false },
    orderBy: { updatedAt: "desc" },
    select: contentSelect,
  });
  if (!groupSource || contentFingerprint(groupSource) === contentFingerprint(post)) return;
  await copyContent(groupSource, [post]);
  await reopenPostAfterEdit(post.id, input.actorId);
}

const FOREIGN_POST_MESSAGE = "Este conteúdo tem contas criadas por outra pessoa. Só quem aprova conteúdo neste cliente pode excluí-las.";

/** Excluir conteúdo de outra pessoa exige poder aprovar — vale para cada conta do grupo, não só para a que está aberta. */
function assertCanDeleteAll(deletedPosts: Array<{ createdById: string }>, actor: { id: string; canDeleteOthersPosts: boolean }) {
  if (actor.canDeleteOthersPosts) return;
  if (deletedPosts.some((deletedPost) => deletedPost.createdById !== actor.id)) throw new ORPCError("FORBIDDEN", { message: FOREIGN_POST_MESSAGE });
}

/** Apaga o grupo inteiro, menos o que já foi ou está sendo publicado (RF-16). */
export async function deletePublishGroupPosts(postId: string, actor: { id: string; canDeleteOthersPosts: boolean }) {
  const post = await prisma.nasaPlannerPost.findUniqueOrThrow({ where: { id: postId }, select: { publishGroupId: true, createdById: true } });
  if (!post.publishGroupId) {
    assertCanDeleteAll([post], actor);
    await prisma.nasaPlannerPost.delete({ where: { id: postId } });
    return { deletedCount: 1, keptCount: 0 };
  }
  const deletablePosts = await prisma.nasaPlannerPost.findMany({
    where: { publishGroupId: post.publishGroupId, status: { notIn: LOCKED_STATUSES } },
    select: { id: true, createdById: true },
  });
  assertCanDeleteAll(deletablePosts, actor);
  const deleted = await prisma.nasaPlannerPost.deleteMany({ where: { id: { in: deletablePosts.map((deletablePost) => deletablePost.id) }, status: { notIn: LOCKED_STATUSES } } });
  const keptCount = await prisma.nasaPlannerPost.count({ where: { publishGroupId: post.publishGroupId } });
  await dissolveSingletonGroup(post.publishGroupId);
  return { deletedCount: deleted.count, keptCount };
}

/** Depois de apagar um irmão só: desfaz o grupo se sobrou um. */
export async function dissolvePublishGroupAfterDelete(publishGroupId: string | null) {
  if (publishGroupId) await dissolveSingletonGroup(publishGroupId);
}

async function loadOtherGroupPostIds(postId: string, scope: GroupScope) {
  if (scope !== "group") return [];
  return (await listPublishGroupPostIds(postId)).filter((groupPostId) => groupPostId !== postId);
}

/**
 * Aprovação por grupo (RF-7, RF-9): a ação vale para o post pedido e para os irmãos que estão num status que
 * a aceita, tudo na mesma transação (`approval.ts`), com um aviso só.
 */
export async function submitForApprovalWithGroup(input: { postId: string; actorId: string; reviewerId?: string; note?: string; scope?: GroupScope }) {
  const { scope = "group", ...submission } = input;
  return submitPostForApproval({ ...submission, groupPostIds: await loadOtherGroupPostIds(input.postId, scope) });
}

export async function approveWithGroup(input: { postId: string; actorId: string; note?: string; checklist?: Record<string, boolean>; scope?: GroupScope }) {
  const { scope = "group", ...approval } = input;
  await approvePost({ ...approval, groupPostIds: await loadOtherGroupPostIds(input.postId, scope) });
}

export async function requestChangesWithGroup(input: { postId: string; actorId: string; body: string; slideId?: string; scope?: GroupScope }) {
  const { scope = "group", ...request } = input;
  await requestPostChanges({ ...request, groupPostIds: await loadOtherGroupPostIds(input.postId, scope) });
}

export interface GroupActionSkip {
  postId: string;
  targetIgAccountId: string | null;
  reason: string;
}

async function loadSchedulableGroupPosts(postId: string) {
  const post = await prisma.nasaPlannerPost.findUniqueOrThrow({ where: { id: postId }, select: { publishGroupId: true } });
  if (!post.publishGroupId) return [];
  return prisma.nasaPlannerPost.findMany({
    where: { publishGroupId: post.publishGroupId, status: { notIn: LOCKED_STATUSES } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, targetIgAccountId: true },
  });
}

async function runOnGroup<Result>(
  postId: string,
  runOnPost: (groupPostId: string, groupIndex: number) => Promise<Result>,
) {
  const groupPosts = await loadSchedulableGroupPosts(postId);
  const targets = groupPosts.length > 0 ? groupPosts : [{ id: postId, targetIgAccountId: null }];
  const results: Result[] = [];
  const skipped: GroupActionSkip[] = [];
  let firstError: unknown;
  for (const [groupIndex, groupPost] of targets.entries()) {
    try {
      results.push(await runOnPost(groupPost.id, groupIndex));
    } catch (error) {
      firstError ??= error;
      skipped.push({ postId: groupPost.id, targetIgAccountId: groupPost.targetIgAccountId, reason: error instanceof Error ? error.message : "Não deu para programar esta conta." });
    }
  }
  // Nenhuma conta aceitou: o erro sobe como num post comum. Com sucesso parcial, a tela mostra quem ficou de fora (CB-1, CB-6).
  if (results.length === 0 && firstError) throw firstError;
  return { results, skipped };
}

/** Programa todas as contas do grupo, com intervalo opcional entre elas (RF-10, RF-11). */
export async function schedulePublishGroup(input: { postId: string; scheduledAt: Date; staggerMinutes?: number }) {
  const staggerMs = Math.min(Math.max(input.staggerMinutes ?? 0, 0), MAX_STAGGER_MINUTES) * MINUTE_MS;
  const { results, skipped } = await runOnGroup(input.postId, (groupPostId, groupIndex) =>
    schedulePlannerPost(groupPostId, new Date(input.scheduledAt.getTime() + groupIndex * staggerMs)),
  );
  return { posts: results, skipped };
}

export async function publishGroupNow(postId: string) {
  const { results, skipped } = await runOnGroup(postId, (groupPostId) => requestImmediatePublish(groupPostId, "PUBLISH_NOW"));
  return { posts: results, skipped };
}

export async function unschedulePublishGroup(postId: string) {
  const groupPostIds = await listPublishGroupPostIds(postId);
  for (const groupPostId of groupPostIds) await unschedulePlannerPost(groupPostId);
}

/** Contas do grupo com o status e o checklist de cada uma (RF-8, RF-15). */
export async function getPublishGroupOverview(postId: string) {
  const post = await prisma.nasaPlannerPost.findUniqueOrThrow({ where: { id: postId }, select: { publishGroupId: true } });
  if (!post.publishGroupId) return { publishGroupId: null, posts: [] };
  const groupPosts = await prisma.nasaPlannerPost.findMany({
    where: { publishGroupId: post.publishGroupId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      organizationId: true,
      status: true,
      type: true,
      title: true,
      caption: true,
      hashtags: true,
      targetIgAccountId: true,
      targetNetworks: true,
      scheduledAt: true,
      publishedAt: true,
      publishError: true,
      externalIgPermalink: true,
      isGroupContentDetached: true,
      planner: { select: { forbiddenWords: true } },
    },
  });
  const posts = await Promise.all(
    groupPosts.map(async ({ planner, ...groupPost }) => ({
      ...groupPost,
      checklist: buildBrandChecklist(groupPost, await getBrandChecklistRulesForPost({ ...groupPost, planner })),
    })),
  );
  return { publishGroupId: post.publishGroupId, posts };
}
