import "server-only";

import prisma from "@/lib/prisma";
import { loadOrganizationKeys } from "@/features/ia/lib/router/providers";

/** IA efetiva do ASTRO (spec 0053, RF-1): chave da org vence; senão a escolha salva; senão ainda não escolheu. */

export type AstroAiMode = "PLATFORM" | "OWN";

/** Modelo ÓRBITA: o que o ASTRO usa com a chave da plataforma quando o cliente não traz a IA dele (D-2). */
export const ORBITA_PLATFORM_MODEL = { provider: "openai", modelId: "gpt-4o-mini" } as const;

export async function hasOwnAiKey(organizationId: string): Promise<boolean> {
  const organizationKeys = await loadOrganizationKeys(organizationId);
  return Object.keys(organizationKeys).length > 0;
}

async function readSavedAstroAiMode(organizationId: string): Promise<AstroAiMode | null> {
  try {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { astroAiMode: true },
    });
    return organization?.astroAiMode ?? null;
  } catch (readError) {
    // Coluna ainda não migrada neste ambiente: trata como "não escolheu" em vez de derrubar o chat.
    console.warn("[astro/ai-mode] não foi possível ler astroAiMode:", readError);
    return null;
  }
}

export async function resolveAstroAiMode(organizationId: string): Promise<AstroAiMode | null> {
  if (await hasOwnAiKey(organizationId)) return "OWN";
  return readSavedAstroAiMode(organizationId);
}

export async function saveAstroAiMode(organizationId: string, mode: AstroAiMode): Promise<void> {
  await prisma.organization.update({
    where: { id: organizationId },
    data: { astroAiMode: mode },
  });
}
