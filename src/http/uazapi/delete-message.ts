"use server";

import { uazapiFetch } from "./client";
import { DeleteMessageResponse } from "./types";

export async function deleteMessage({
  id,
  token,
  baseUrl,
}: {
  id: string;
  token: string;
  baseUrl?: string;
}) {
  return await uazapiFetch<DeleteMessageResponse>("/message/delete", {
    method: "POST",
    token,
    baseUrl,
    body: { id },
  });
}
