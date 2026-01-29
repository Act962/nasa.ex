"use server";

import { uazapiFetch } from "../client";
import { CreateInstanceResponse } from "../types";

interface CreateInstanceProps {
  name: string;
  systemName?: string;
  adminField01?: string;
  adminField02?: string;
  fingerprintProfile?: string;
  browser?: string;
}

export async function createInstance(
  data: CreateInstanceProps,
  token: string,
  baseUrl?: string,
) {
  return await uazapiFetch<CreateInstanceResponse>("/instance/init", {
    method: "POST",
    isAdmin: true,
    token,
    baseUrl,
    body: {
      systemName: "uazapi",
      fingerprintProfile: "chrome",
      browser: "chrome",
      ...data,
    },
  });
}
