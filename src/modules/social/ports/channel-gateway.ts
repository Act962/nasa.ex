import type { ContentRef, MessageButton } from "../domain/types";

export type DispatchResult =
  | { ok: true; externalMessageId?: string }
  | { ok: false; error: string; authError: boolean };

export type SendDirectMessageInput = {
  /** Destinatário. Em resposta a comentário vai `commentId` no lugar. */
  externalUserId?: string;
  commentId?: string;
  text: string;
  buttons?: MessageButton[];
};

export type ReplyToCommentInput = {
  commentId: string;
  text: string;
};

export type ContentPage = {
  items: ContentRef[];
  nextCursor?: string;
};

/**
 * Tudo que o módulo manda para fora. Uma rede social nova é uma implementação
 * deste port — `domain/` e `application/` não mudam (spec 0024 D-10).
 */
export type AccountProfile = {
  externalAccountId: string;
  handle?: string;
  displayName?: string;
};

export interface ChannelGateway {
  sendDirectMessage(input: SendDirectMessageInput): Promise<DispatchResult>;
  replyToComment(input: ReplyToCommentInput): Promise<DispatchResult>;
  listContent(input: { cursor?: string }): Promise<ContentPage>;
  /**
   * Confere a credencial contra o provider e devolve de quem ela é. Usado no
   * connect para falhar na hora, e não no primeiro comentário real.
   */
  fetchAccountProfile(): Promise<AccountProfile | null>;

  /**
   * Inscreve o app para receber os eventos desta conta.
   *
   * Assinar os campos no painel da Meta diz apenas **quais** eventos o app
   * quer; sem esta chamada a conta nunca entrega nenhum. Foi exatamente o que
   * fez o primeiro teste real não disparar: handshake 200, zero POST.
   * Mesmo papel de `src/http/whats-oficial/subscribe-app.ts` no WhatsApp.
   */
  subscribeToEvents(): Promise<DispatchResult>;

  /** O que a conta entrega hoje — alimenta o diagnóstico na UI. */
  listSubscribedFields(): Promise<string[] | null>;
}
