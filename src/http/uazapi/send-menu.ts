"use server";
import { uazapiFetch } from "./client";
import {
  SendButtonsPayload,
  SendListPayload,
  SendMenuPayload,
  SendMenuResponse,
} from "./types";

/**
 * O endpoint /send/menu da uazapi NÃO aceita {buttons|sections} direto —
 * ele espera o payload unificado SendMenuPayload com `type` + `choices`
 * (strings no formato "texto|id" para botões, "[Seção]"/"título|id|descrição"
 * para listas). Os wrappers abaixo traduzem da shape amigável para a shape
 * da API.
 */
export async function sendButtons(
  token: string,
  data: SendButtonsPayload,
  baseUrl?: string,
) {
  const payload: SendMenuPayload = {
    number: data.number,
    type: "button",
    text: data.text,
    choices: data.buttons.map((b) => `${b.text}|${b.id}`),
    footerText: data.footer,
    readchat: data.readchat,
    readmessages: data.readmessages,
    delay: data.delay,
  };

  return await uazapiFetch<SendMenuResponse>("/send/menu", {
    method: "POST",
    token,
    baseUrl,
    body: payload,
  });
}

export async function sendList(
  token: string,
  data: SendListPayload,
  baseUrl?: string,
) {
  const choices = data.sections.flatMap((section) => {
    const lines: string[] = [];
    if (section.title) lines.push(`[${section.title}]`);
    for (const row of section.rows) {
      lines.push(
        row.description
          ? `${row.title}|${row.id}|${row.description}`
          : `${row.title}|${row.id}`,
      );
    }
    return lines;
  });

  const payload: SendMenuPayload = {
    number: data.number,
    type: "list",
    text: data.text,
    choices,
    footerText: data.footer,
    listButton: data.button,
    readchat: data.readchat,
    readmessages: data.readmessages,
    delay: data.delay,
  };

  return await uazapiFetch<SendMenuResponse>("/send/menu", {
    method: "POST",
    token,
    baseUrl,
    body: payload,
  });
}

/**
 * Envia a MESMA composição de itens dos botões (`{text,id}`) como uma LISTA
 * interativa, embrulhando-os numa única seção (`text → title`). Reusa
 * `sendList` para não duplicar a serialização do payload. `button` é o rótulo
 * que abre a lista no WhatsApp (default "Ver opções").
 */
export async function sendItemsAsList(
  token: string,
  data: {
    number: string;
    text: string;
    footer?: string;
    button?: string;
    items: Array<{ text: string; id: string }>;
    readchat?: boolean;
    readmessages?: boolean;
    delay?: number;
  },
  baseUrl?: string,
) {
  return sendList(
    token,
    {
      number: data.number,
      text: data.text,
      footer: data.footer,
      button: data.button?.trim() || "Ver opções",
      sections: [
        {
          rows: data.items.map((item) => ({
            id: item.id,
            title: item.text,
          })),
        },
      ],
      readchat: data.readchat,
      readmessages: data.readmessages,
      delay: data.delay,
    },
    baseUrl,
  );
}

export async function sendMenu(
  token: string,
  data: SendMenuPayload,
  baseUrl?: string,
) {
  return await uazapiFetch<SendMenuResponse>("/send/menu", {
    method: "POST",
    token,
    baseUrl,
    body: data,
  });
}

/**
 * Wrapper de envio de menu de botões usado em qualquer call-site com
 * quantidade variável de opções (executor de automação, tool de IA, etc).
 *
 * Antes, este wrapper degradava pra `sendList` quando passava de 3 botões
 * (limite nativo histórico do WhatsApp). A uazapi hoje renderiza N botões
 * como botões de verdade (testado com 10), então o degrade virou legado —
 * e ele quebrava a indexação de tag por clique: a resposta de lista volta
 * com o id aninhado em `singleSelectReply.selectedRowId`, enquanto o adapter
 * lê o `selectedButtonId` plano da resposta de botão. Mandando sempre
 * `type: "button"`, o clique volta como `ButtonsResponseMessage` e o
 * `buttonTagMap[clickedButtonId]` casa.
 *
 * `listButton` é aceito por compatibilidade de assinatura mas é ignorado
 * (não há mais lista). `sendList`/`sendMenu` seguem disponíveis pra quem
 * quiser lista de propósito.
 */
export async function sendButtonsOrList(
  token: string,
  data: SendButtonsPayload & { listButton?: string },
  baseUrl?: string,
) {
  return sendButtons(token, data, baseUrl);
}
