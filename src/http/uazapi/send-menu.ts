"use server";
import { uazapiFetch } from "./client";
import {
  SendButtonsPayload,
  SendListPayload,
  SendMenuPayload,
  SendMenuResponse,
} from "./types";

export async function sendButtons(
  token: string,
  data: SendButtonsPayload,
  baseUrl?: string,
) {
  return await uazapiFetch<SendMenuResponse>("/send/menu", {
    method: "POST",
    token,
    baseUrl,
    body: data,
  });
}

export async function sendList(
  token: string,
  data: SendListPayload,
  baseUrl?: string,
) {
  return await uazapiFetch<SendMenuResponse>("/send/menu", {
    method: "POST",
    token,
    baseUrl,
    body: data,
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
