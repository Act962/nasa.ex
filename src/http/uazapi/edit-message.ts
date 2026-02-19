"use server";

import { uazapiFetch } from "./client";
import { EditMessagePayload, EditMessageResponse } from "./types";

export async function editMessage({
  data,
  token,
  baseUrl,
}: {
  data: EditMessagePayload;
  token: string;
  baseUrl?: string;
}) {
  return await uazapiFetch<EditMessageResponse>("/message/edit", {
    method: "POST",
    token,
    baseUrl,
    body: data,
  });
}
