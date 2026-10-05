/**
 * Publicar conteúdo numa conta e ler o que foi publicado (spec 0071, D-1).
 *
 * Port separado de `ChannelGateway`: conversar (DM, resposta de automação) e
 * publicar são capacidades diferentes, e uma rede pode ter uma sem a outra.
 */

export class ContentPublishError extends Error {
  constructor(
    message: string,
    readonly code: number | null,
    readonly subcode: number | null,
    readonly isTransient: boolean,
  ) {
    super(message);
    this.name = "ContentPublishError";
  }
}

export type MediaContainerInput =
  | { kind: "IMAGE"; imageUrl: string; caption?: string }
  | { kind: "CAROUSEL_ITEM"; imageUrl?: string; videoUrl?: string }
  | { kind: "CAROUSEL"; childrenIds: string[]; caption?: string }
  | { kind: "REELS"; videoUrl: string; caption?: string; coverUrl?: string; shareToFeed?: boolean }
  | { kind: "STORIES"; imageUrl?: string; videoUrl?: string };

/** `FINISHED` libera a publicação; `IN_PROGRESS` pede nova checagem; `ERROR`/`EXPIRED` encerram. */
export type MediaContainerStatus = { statusCode: string; detail: string | null };

export type PublishedMediaMetrics = {
  likeCount: number | null;
  commentsCount: number | null;
  reach: number | null;
  views: number | null;
  /** Mídia como está na rede (URL temporária do CDN). */
  mediaUrl: string | null;
  thumbnailUrl: string | null;
};

export type PublishedComment = {
  id: string;
  text: string;
  username: string | null;
  timestamp: string | null;
  isHidden: boolean;
  likeCount: number;
  authorId: string | null;
  replies: PublishedComment[];
};

export type PublishedCommentPage = { comments: PublishedComment[]; nextCursor: string | null };

export type CommentOwnership = { mediaId: string | null; parentId: string | null; authorId: string | null };

/** Nulo = não deu para conferir (a rede respondeu algo que não é sim nem não). */
export type ChannelCapabilities = {
  canPublish: boolean | null;
  canReadInsights: boolean | null;
  /** A rede recusou a credencial: a conta precisa ser reconectada. */
  isCredentialRejected: boolean;
};

export interface ContentPublisher {
  createMediaContainer(input: MediaContainerInput): Promise<string>;
  getMediaContainerStatus(containerId: string): Promise<MediaContainerStatus>;
  publishMediaContainer(containerId: string): Promise<string>;
  getMediaPermalink(mediaId: string): Promise<string | null>;
  getMediaMetrics(mediaId: string, isStory: boolean): Promise<PublishedMediaMetrics>;
  listMediaComments(mediaId: string, afterCursor?: string): Promise<PublishedCommentPage>;
  getCommentOwnership(commentId: string): Promise<CommentOwnership>;
  createMediaComment(mediaId: string, message: string): Promise<{ id: string }>;
  replyToComment(commentId: string, message: string): Promise<{ id: string }>;
  sendPrivateReply(commentId: string, text: string): Promise<void>;
  setCommentHidden(commentId: string, isHidden: boolean): Promise<void>;
  deleteComment(commentId: string): Promise<void>;
  /** Confere, por chamadas de leitura, o que a credencial desta conta permite (spec 0071, D-3). */
  checkCapabilities(): Promise<ChannelCapabilities>;
}

export type CredentialRenewal =
  | { ok: true; accessToken: string; expiresAt: Date }
  | { ok: false; error: string; isCredentialRejected: boolean };

/** Troca um token de longa duração por outro, antes de vencer (spec 0071, D-4). */
export interface CredentialRenewer {
  renew(accessToken: string): Promise<CredentialRenewal>;
}
