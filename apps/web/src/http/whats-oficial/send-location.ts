"use server";
import { graphFetch } from "./client";
import type { SendLocationInput, SendMessageResponse } from "./types";

export async function sendOfficialLocation(
  accessToken: string,
  phoneNumberId: string,
  input: SendLocationInput,
): Promise<SendMessageResponse> {
  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.to,
    type: "location",
    location: {
      latitude: input.latitude,
      longitude: input.longitude,
      ...(input.name && { name: input.name }),
      ...(input.address && { address: input.address }),
    },
  };

  if (input.replyToWamid) {
    body.context = { message_id: input.replyToWamid };
  }

  return graphFetch<SendMessageResponse>(`/${phoneNumberId}/messages`, {
    method: "POST",
    accessToken,
    body,
  });
}
