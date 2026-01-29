"use server";

import { uazapiFetch } from "./client";
import { ConnectInstanceResponse } from "./types";

/**
 * @param token Instance token
 * @param phone Optional phone number to connect
 */
export async function connectInstance(
  token: string,
  phone?: string,
  baseUrl?: string,
) {
  return await uazapiFetch<ConnectInstanceResponse>("/instance/connect", {
    method: "POST",
    token,
    baseUrl,
    body: phone ? { phone } : undefined,
  });
}
