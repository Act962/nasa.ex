"use server";
import { uazapiFetch } from "./client";
import { GetContactDetailsPayload, GetContactDetailsResponse } from "./types";

export async function getContactDetails({
  token,
  data,
  baseUrl,
}: {
  token: string;
  data: GetContactDetailsPayload;
  baseUrl?: string;
}) {
  return await uazapiFetch<GetContactDetailsResponse>("/chat/details", {
    method: "POST",
    token,
    baseUrl,
    body: data,
  });
}
