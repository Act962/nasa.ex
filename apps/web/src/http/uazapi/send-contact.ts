"use server";
import { uazapiFetch } from "./client";
import { SendContactPayload, SendContactResponse } from "./types";

export async function sendContact(
  token: string,
  data: SendContactPayload,
  baseUrl?: string,
) {
  return await uazapiFetch<SendContactResponse>("/send/contact", {
    method: "POST",
    token,
    baseUrl,
    body: data,
  });
}
