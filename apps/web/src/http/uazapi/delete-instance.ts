"use server";

import { uazapiFetch } from "./client";
import { DeleteInstanceResponse } from "./types";

export async function deleteInstance(token: string, baseUrl?: string) {
  return await uazapiFetch<DeleteInstanceResponse>("/instance", {
    method: "DELETE",
    token,
    baseUrl,
  });
}
