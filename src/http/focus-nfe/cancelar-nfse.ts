import type { FiscalEnvironment } from "@/generated/prisma/enums";
import { focusFetch } from "./client";

export async function cancelarNfse(
  ref: string,
  justificativa: string,
  environment: FiscalEnvironment,
): Promise<void> {
  await focusFetch<void>({
    method: "DELETE",
    path: `/nfse/${encodeURIComponent(ref)}`,
    body: { justificativa },
    environment,
  });
}
