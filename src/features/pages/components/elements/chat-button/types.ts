/**
 * Tipos compartilhados do Chat Button — fases do fluxo scripted,
 * formato de mensagem exibida no widget e info da org (header).
 * Arquivo puro (sem deps de runtime): pode ser importado tanto por
 * código client quanto server.
 */

export type Phase = "welcome" | "name" | "phone" | "chatting";

export type Msg = {
  id: string;
  body: string;
  fromAgent: boolean;
  createdAt: number;
  /** Nome do atendente (apenas pra `fromAgent=true`). */
  senderName?: string | null;
  /** Avatar do atendente (User.image). */
  senderImage?: string | null;
};

export interface OrgInfo {
  name: string;
  logo: string | null;
  niche: string | null;
}
