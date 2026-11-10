import "server-only";
import prisma from "@/lib/prisma";

// IAs conectadas por OAuth (spec 0135, RF-11 a RF-13): conexão = consentimento (pessoa, IA). Só Prisma, para o `auth.ts` poder importar.

export interface OAuthConnection {
  id: string;
  clientId: string;
  clientName: string | null;
  redirectUri: string | null;
  connectedAt: Date | null;
}

const CONNECTION_SELECT = {
  id: true,
  clientId: true,
  createdAt: true,
  client: { select: { name: true, redirectUris: true, disabled: true } },
} as const;

function toConnection(consent: {
  id: string;
  clientId: string;
  createdAt: Date | null;
  client: { name: string | null; redirectUris: string[] };
}): OAuthConnection {
  return {
    id: consent.id,
    clientId: consent.clientId,
    clientName: consent.client.name,
    redirectUri: consent.client.redirectUris[0] ?? null,
    connectedAt: consent.createdAt,
  };
}

export async function findOAuthConnection(userId: string, clientId: string): Promise<OAuthConnection | null> {
  const consent = await prisma.oauthConsent.findFirst({ where: { userId, clientId }, select: CONNECTION_SELECT });
  if (!consent || consent.client.disabled) return null;
  return toConnection(consent);
}

export async function listOAuthConnections(userId: string): Promise<OAuthConnection[]> {
  const consents = await prisma.oauthConsent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: CONNECTION_SELECT,
  });
  return consents.map(toConnection);
}

export async function disconnectOAuthConnection(userId: string, connectionId: string): Promise<boolean> {
  const consent = await prisma.oauthConsent.findFirst({ where: { id: connectionId, userId }, select: { clientId: true } });
  if (!consent) return false;
  const byClient = { userId, clientId: consent.clientId };
  await prisma.$transaction([
    prisma.oauthAccessToken.deleteMany({ where: byClient }),
    prisma.oauthRefreshToken.deleteMany({ where: byClient }),
    prisma.oauthConsent.deleteMany({ where: byClient }),
  ]);
  return true;
}

/** Nova senha desconecta todas as IAs por OAuth (RF-13). As chaves seguem: têm ciclo de vida próprio. */
export async function disconnectAllOAuthConnections(userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.oauthAccessToken.deleteMany({ where: { userId } }),
    prisma.oauthRefreshToken.deleteMany({ where: { userId } }),
    prisma.oauthConsent.deleteMany({ where: { userId } }),
  ]);
}
