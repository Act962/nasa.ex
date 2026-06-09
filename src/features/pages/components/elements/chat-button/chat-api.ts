/**
 * Camada de acesso aos endpoints REST de in-chat (`/api/in-chat/<org>/…`).
 * Concentra os `fetch` do widget num único lugar: busca de info da org,
 * histórico de mensagens (já mapeado pro formato `Msg` em ordem ascendente),
 * identificação do lead e envio de mensagem. Roda no browser e depende do
 * cookie de sessão do visitante (`credentials: same-origin`) — por isso são
 * helpers client, não server actions.
 */

import type { Msg, OrgInfo } from "./types";

/** Formato cru de mensagem retornado pela API (itens em ordem DESC). */
type ApiMessage = {
  id: string;
  body: string | null;
  fromMe: boolean;
  createdAt: string;
  senderName?: string | null;
  senderImage?: string | null;
};

/** Payload do evento Pusher `message:created` (resposta do atendente). */
type CreatedMessagePayload = {
  id: string;
  body: string | null;
  fromMe: boolean;
  createdAt: string;
  senderName?: string | null;
  // O trigger não inclui a foto do User — o avatar cai pro logo da org.
};

/**
 * Convenção WhatsApp-style: `fromMe=true` = lado da org (atendente/agente),
 * então `fromAgent = fromMe` direto, SEM negar.
 */
function mapApiMessage(item: ApiMessage): Msg {
  return {
    id: item.id,
    body: item.body ?? "",
    fromAgent: item.fromMe,
    createdAt: new Date(item.createdAt).getTime(),
    senderName: item.senderName ?? null,
    senderImage: item.senderImage ?? null,
  };
}

/** Mapeia o payload do evento Pusher `message:created` pro formato `Msg`. */
export function mapCreatedMessage(payload: CreatedMessagePayload): Msg {
  return {
    id: payload.id,
    body: payload.body ?? "",
    fromAgent: payload.fromMe,
    createdAt: new Date(payload.createdAt).getTime(),
    senderName: payload.senderName ?? null,
    senderImage: null,
  };
}

export async function fetchOrgInfo(orgSlug: string): Promise<OrgInfo | null> {
  try {
    const response = await fetch(`/api/in-chat/${orgSlug}/info`, {
      credentials: "same-origin",
    });
    if (!response.ok) return null;
    const data = (await response.json()) as OrgInfo | null;
    return data?.name ? data : null;
  } catch {
    return null;
  }
}

/**
 * Busca o histórico (mensagens já em ordem ascendente) + o `conversationId`
 * da conversa, usado pra subscrever no canal Pusher de tempo real. O
 * `conversationId` vem no envelope mesmo quando ainda não há mensagens.
 */
export async function fetchMessages(
  orgSlug: string,
): Promise<{ messages: Msg[]; conversationId: string | null }> {
  const response = await fetch(`/api/in-chat/${orgSlug}/messages`, {
    credentials: "same-origin",
  });
  if (!response.ok) return { messages: [], conversationId: null };
  const data = await response.json();
  const items = data?.items as ApiMessage[] | undefined;
  const conversationId = (data?.conversationId as string | undefined) ?? null;
  const messages = items?.length
    ? [...items].reverse().map(mapApiMessage)
    : [];
  return { messages, conversationId };
}

/**
 * Cria/encontra o lead + grava cookie de sessão. Lança `Error(code)` em
 * falha (o code é traduzido em `error-messages` pela camada de UI).
 */
export async function postIdentify(
  orgSlug: string,
  payload: {
    name: string;
    phone: string;
    trackingId?: string;
    statusId?: string;
  },
): Promise<{ leadName?: string }> {
  const response = await fetch(`/api/in-chat/${orgSlug}/identify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.error) {
    throw new Error(json.error ?? `HTTP ${response.status}`);
  }
  return json;
}

/** Envia a mensagem do visitante e devolve o `id` real persistido (pra
 *  reconciliar com a mensagem otimista `local-*`). */
export async function postMessage(
  orgSlug: string,
  body: string,
): Promise<{ id: string | null }> {
  const response = await fetch(`/api/in-chat/${orgSlug}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ body }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const json = await response.json().catch(() => ({}));
  return { id: (json?.message?.id as string | undefined) ?? null };
}
