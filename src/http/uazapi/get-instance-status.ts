"use server";

import { uazapiFetch } from "./client";
import { InstanceStatusResponse } from "./types";

export async function getInstanceStatus(token: string, baseUrl?: string) {
  return await uazapiFetch<InstanceStatusResponse>("/instance/status", {
    method: "GET",
    token,
    baseUrl,
  });
}
