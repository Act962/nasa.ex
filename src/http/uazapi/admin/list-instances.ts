"use server";

import { uazapiFetch } from "../client";
import { ListInstancesResponse } from "../types";

export async function listInstances(token: string, baseUrl?: string) {
  return await uazapiFetch<ListInstancesResponse>("/instance/all", {
    method: "GET",
    isAdmin: true,
    token,
    baseUrl,
  });
}
