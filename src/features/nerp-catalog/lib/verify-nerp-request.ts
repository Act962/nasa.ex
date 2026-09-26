import "server-only";
import { timingSafeEqual } from "node:crypto";
import prisma from "@/lib/prisma";
import { IntegrationPlatform } from "@/generated/prisma/enums";
import { signRequest } from "@/http/nerp/sign";
import {
  readNerpScopes,
  readNerpSecret,
  type StoredNerpConfig,
} from "@/features/nerp/lib/credentials";

// Espelho do `verifyNasaS2S` do NERP: o NERP assina com o mesmo par
// apiKey/secret que o Órbita usa pra chamá-lo, e o Órbita confere aqui.

const MAX_CLOCK_DRIFT_MS = 5 * 60 * 1000;

export type VerifiedNerpRequest = {
  organizationId: string;
  nerpOrgId: string;
  scopes: string[];
  rawBody: string;
};

export type NerpRequestRejection =
  | "missing_headers"
  | "timestamp_drift"
  | "unknown_key"
  | "invalid_signature";

function isHexEqual(expected: string, received: string): boolean {
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(received, "hex");
  if (expectedBuffer.length === 0 || expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function isTimestampFresh(timestamp: string, now = Date.now()): boolean {
  const timestampMs = Number(timestamp);
  return Number.isFinite(timestampMs) && Math.abs(now - timestampMs) <= MAX_CLOCK_DRIFT_MS;
}

export function isNerpSignatureValid(input: {
  method: string;
  path: string;
  body: string;
  timestamp: string;
  signature: string;
  secret: string;
}): boolean {
  const expected = signRequest({
    method: input.method,
    path: input.path,
    body: input.body,
    timestamp: input.timestamp,
    secret: input.secret,
  });
  return isHexEqual(expected, input.signature);
}

export async function verifyNerpRequest(
  request: Request,
): Promise<{ ok: true; value: VerifiedNerpRequest } | { ok: false; reason: NerpRequestRejection }> {
  const apiKey = request.headers.get("x-nerp-api-key");
  const nerpOrgId = request.headers.get("x-nerp-org-id");
  const timestamp = request.headers.get("x-nerp-timestamp");
  const signature = request.headers.get("x-nerp-signature");
  if (!apiKey || !nerpOrgId || !timestamp || !signature) {
    return { ok: false, reason: "missing_headers" };
  }
  if (!isTimestampFresh(timestamp)) {
    return { ok: false, reason: "timestamp_drift" };
  }

  const integration = await prisma.platformIntegration.findFirst({
    where: {
      platform: IntegrationPlatform.NERP,
      isActive: true,
      AND: [
        { config: { path: ["apiKey"], equals: apiKey } },
        { config: { path: ["nerpOrgId"], equals: nerpOrgId } },
      ],
    },
    select: { organizationId: true, config: true },
  });
  const storedConfig = (integration?.config ?? null) as StoredNerpConfig | null;
  const secret = readNerpSecret(storedConfig);
  if (!integration || !secret) {
    return { ok: false, reason: "unknown_key" };
  }

  const rawBody = await request.text();
  const isSignatureValid = isNerpSignatureValid({
    method: request.method,
    path: new URL(request.url).pathname,
    body: rawBody,
    timestamp,
    signature,
    secret,
  });
  if (!isSignatureValid) {
    return { ok: false, reason: "invalid_signature" };
  }

  return {
    ok: true,
    value: {
      organizationId: integration.organizationId,
      nerpOrgId,
      scopes: readNerpScopes(storedConfig),
      rawBody,
    },
  };
}
