"use server";
import { uazapiFetch } from "./client";
import { FindMessagesPayload, FindMessagesResponse } from "./types";

export async function findMessages(
  token: string,
  data: FindMessagesPayload,
  baseUrl?: string,
) {
  return await uazapiFetch<FindMessagesResponse>("/message/find", {
    method: "POST",
    token,
    baseUrl,
    body: data,
  });
}
