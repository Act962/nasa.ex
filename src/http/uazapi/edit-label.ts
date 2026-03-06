"use server";
import { uazapiFetch } from "./client";
import { EditLabelPayload, EditLabelResponse } from "./types";

export async function editLabel({
  token,
  data,
  baseUrl,
}: {
  token: string;
  data: EditLabelPayload;
  baseUrl?: string;
}) {
  return await uazapiFetch<EditLabelResponse>("/label/edit", {
    method: "POST",
    token,
    baseUrl,
    body: data,
  });
}
