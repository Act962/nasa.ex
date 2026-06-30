import type { FiscalEnvironment } from "@/generated/prisma/enums";
import { focusFetch } from "./client";
import type { FocusHookResponse, FocusWebhookRegistration } from "./types";

export async function registrarWebhook(
  registration: FocusWebhookRegistration,
  environment: FiscalEnvironment,
): Promise<FocusHookResponse> {
  return focusFetch<FocusHookResponse>({
    method: "POST",
    path: "/hooks",
    body: registration,
    environment,
  });
}
