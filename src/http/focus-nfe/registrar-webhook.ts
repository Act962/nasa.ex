import type { FiscalEnvironment } from "@/generated/prisma/enums";
import { focusFetch } from "./client";
import type { FocusHookResponse, FocusWebhookRegistration } from "./types";

const WEBHOOK_MODE_BY_ENVIRONMENT: Record<FiscalEnvironment, "homologacao" | "producao"> = {
  HOMOLOGACAO: "homologacao",
  PRODUCAO: "producao",
};

// Homologação e produção usam sistemas Focus separados mas apontam pra mesma
// callback URL — o "mode" na query string é o que permite o endpoint receptor
// distinguir de qual ambiente veio a notificação.
function withModeParam(url: string, environment: FiscalEnvironment): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}mode=${WEBHOOK_MODE_BY_ENVIRONMENT[environment]}`;
}

export async function registrarWebhook(
  registration: FocusWebhookRegistration,
  environment: FiscalEnvironment,
  token: string,
): Promise<FocusHookResponse> {
  return focusFetch<FocusHookResponse>({
    method: "POST",
    path: "/hooks",
    body: {
      ...registration,
      url: withModeParam(registration.url, environment),
      authorization_header: "Content-Type",
      authorization: "application/json",
    },
    environment,
    token,
  });
}
