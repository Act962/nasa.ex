"use server";
import { uazapiFetch } from "./client";
import { ValidWhatsappPhonePayload, ValidWhatsappPhoneResponse } from "./types";

export async function validWhatsappPhone({
  token,
  data,
  baseUrl,
}: {
  token: string;
  data: ValidWhatsappPhonePayload;
  baseUrl?: string;
}) {
  return await uazapiFetch<ValidWhatsappPhoneResponse[]>("/chat/check", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      token: token,
    },
    body: data,
    baseUrl: baseUrl,
  });
}
