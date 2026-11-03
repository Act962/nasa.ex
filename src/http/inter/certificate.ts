import "server-only";
import { X509Certificate, createPrivateKey } from "node:crypto";

// Confere o par `.crt`/`.key` antes de gravar a conexão (CB-11 da spec 0130) e lê a
// validade para os avisos de certificado vencendo (RF-9).

export interface InterCertificateInfo {
  validFrom: Date;
  validTo: Date;
  subject: string;
}

export type InspectCertificateResult =
  | { ok: true; info: InterCertificateInfo }
  | { ok: false; reason: string };

const PEM_CERTIFICATE_HEADER = "-----BEGIN CERTIFICATE-----";
const PEM_PRIVATE_KEY_PATTERN = /-----BEGIN (RSA |EC )?PRIVATE KEY-----/;

export function inspectInterCertificate(certificatePem: string, privateKeyPem: string): InspectCertificateResult {
  if (!certificatePem.includes(PEM_CERTIFICATE_HEADER)) {
    return { ok: false, reason: "O certificado precisa ser o arquivo .crt em formato PEM (não .pfx)." };
  }
  if (!PEM_PRIVATE_KEY_PATTERN.test(privateKeyPem)) {
    return { ok: false, reason: "A chave precisa ser o arquivo .key em formato PEM." };
  }

  let certificate: X509Certificate;
  try {
    certificate = new X509Certificate(certificatePem);
  } catch {
    return { ok: false, reason: "Não foi possível ler o certificado. Envie o .crt que veio do Inter." };
  }

  let isPair: boolean;
  try {
    isPair = certificate.checkPrivateKey(createPrivateKey(privateKeyPem));
  } catch {
    return { ok: false, reason: "Não foi possível ler a chave. Envie o .key que veio do Inter." };
  }
  if (!isPair) return { ok: false, reason: "O certificado e a chave não são da mesma integração." };

  const validTo = new Date(certificate.validTo);
  if (validTo.getTime() <= Date.now()) return { ok: false, reason: "O certificado está vencido." };

  return {
    ok: true,
    info: { validFrom: new Date(certificate.validFrom), validTo, subject: certificate.subject },
  };
}
