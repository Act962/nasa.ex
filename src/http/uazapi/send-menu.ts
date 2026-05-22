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
