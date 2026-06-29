"use server";

import { uazapiFetch } from "./client";
import { DisconnectInstanceResponse } from "./types";

export async function disconnectInstance(token: string, baseUrl?: string) {
  return await uazapiFetch<DisconnectInstanceResponse>("/instance/disconnect", {
    method: "POST",
    token,
    baseUrl,
  });
}
