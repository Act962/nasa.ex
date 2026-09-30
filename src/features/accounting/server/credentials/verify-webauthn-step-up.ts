import "server-only";

import {
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import prisma from "@/lib/prisma";
import {
  getRpIdAndOrigin,
  parseCredentials,
  popChallenge,
} from "@/app/router/payment/access";

// Step-up do cofre: o cliente pede o desafio no `payment.access.startWebauthnAuth`
// (mesmo armazenamento de desafios) e a verificação aqui repete a do
// `finishWebauthnAuth`, sem abrir sessão nova do financeiro.

export type StepUpResult =
  | { ok: true }
  | { ok: false; reason: "no_passkey" | "challenge_expired" | "unknown_credential" | "not_verified"; message: string };

function readCredentialId(response: unknown): string | null {
  const credentialId = (response as { id?: unknown } | null)?.id;
  return typeof credentialId === "string" ? credentialId : null;
}

export async function hasPaymentPasskey(userId: string, organizationId: string): Promise<boolean> {
  const access = await prisma.paymentAccess.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: { webauthnCredentials: true },
  });
  return parseCredentials(access?.webauthnCredentials).length > 0;
}

export async function verifyWebauthnStepUp(params: {
  userId: string;
  organizationId: string;
  response: unknown;
}): Promise<StepUpResult> {
  const access = await prisma.paymentAccess.findUnique({
    where: { userId_organizationId: { userId: params.userId, organizationId: params.organizationId } },
    select: { id: true, webauthnCredentials: true },
  });
  const credentials = parseCredentials(access?.webauthnCredentials);
  if (!access || credentials.length === 0) {
    return {
      ok: false,
      reason: "no_passkey",
      message: "Cadastre Face ID, Touch ID ou Windows Hello neste aparelho antes de revelar senhas.",
    };
  }

  const challenge = popChallenge(params.userId, params.organizationId);
  if (!challenge) {
    return { ok: false, reason: "challenge_expired", message: "A confirmação expirou. Tente de novo." };
  }

  const credentialId = readCredentialId(params.response);
  const credential = credentials.find((stored) => stored.credentialId === credentialId);
  if (!credential) {
    return { ok: false, reason: "unknown_credential", message: "Esta biometria não está cadastrada no financeiro." };
  }

  const { rpID, origin } = getRpIdAndOrigin();
  let isVerified = false;
  let newCounter = credential.counter;
  try {
    const verification = await verifyAuthenticationResponse({
      response: params.response as AuthenticationResponseJSON,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credential.credentialId,
        publicKey: Buffer.from(credential.publicKey, "base64"),
        counter: credential.counter,
        transports: credential.transports as AuthenticatorTransportFuture[] | undefined,
      },
    });
    isVerified = verification.verified;
    newCounter = verification.authenticationInfo.newCounter;
  } catch (error) {
    console.warn("[accounting/credentials] webauthn_verify_failed", error);
  }
  if (!isVerified) {
    return { ok: false, reason: "not_verified", message: "Não foi possível confirmar sua identidade." };
  }

  credential.counter = newCounter;
  await prisma.paymentAccess.update({
    where: { id: access.id },
    data: { webauthnCredentials: JSON.parse(JSON.stringify(credentials)) },
  });
  return { ok: true };
}
