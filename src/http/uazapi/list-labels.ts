"use server";
import { uazapiFetch } from "./client";
import { ListLabelsResponse } from "./types";

export async function getLabels({
  token,
  baseUrl,
}: {
  token: string;
  baseUrl?: string;
}) {
  return await uazapiFetch<ListLabelsResponse>("/labels", {
    method: "GET",
    token,
    baseUrl,
  });
}
