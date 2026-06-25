import type { FiscalEnvironment } from "@/generated/prisma/enums";
import { focusFetch } from "./client";
import type { FocusWebhookRegistration } from "./types";

export async function registrarWebhook(
  registration: FocusWebhookRegistration,
  environment: FiscalEnvironment,
): Promise<void> {
  await focusFetch<void>({
    method: "POST",
    path: "/hooks",
    body: registration,
    environment,
  });
}
