import "server-only";

import forge from "node-forge";
import prisma from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto";
import { afterCompanyDocumentChange } from "@/features/accounting/server/documents/document-lifecycle";

// Certificado digital A1 (.pfx). O arquivo e a senha ficam cifrados; o que
// importa para o dono — titular e validade — vira também um CompanyDocument
// "CERTIFICADO_ECNPJ", para entrar no score e nos alertas de vencimento.

export const MAX_CERTIFICATE_BYTES = 50 * 1024;
const CERTIFICATE_DOCUMENT_TYPE = "CERTIFICADO_ECNPJ";

export interface ParsedCertificate {
  subjectName: string | null;
  document: string | null;
  validFrom: Date;
  validTo: Date;
}

export type ParseCertificateResult =
  | { ok: true; certificate: ParsedCertificate }
  | { ok: false; reason: "wrong_password" | "invalid_file" | "too_large"; message: string };

function readCommonName(certificate: forge.pki.Certificate): string | null {
  const commonName = certificate.subject.getField("CN")?.value;
  return typeof commonName === "string" ? commonName : null;
}

/** e-CNPJ ICP-Brasil costuma trazer "RAZAO SOCIAL:12345678000199" no CN. */
function splitCommonName(commonName: string | null): { subjectName: string | null; document: string | null } {
  if (!commonName) return { subjectName: null, document: null };
  const separatorIndex = commonName.lastIndexOf(":");
  if (separatorIndex < 0) return { subjectName: commonName, document: null };
  const digits = commonName.slice(separatorIndex + 1).replace(/\D/g, "");
  return {
    subjectName: commonName.slice(0, separatorIndex).trim() || commonName,
    document: digits.length === 14 || digits.length === 11 ? digits : null,
  };
}

export function parsePfxCertificate(pfxBase64: string, password: string): ParseCertificateResult {
  const pfxBytes = Buffer.from(pfxBase64, "base64");
  if (pfxBytes.byteLength === 0) return { ok: false, reason: "invalid_file", message: "Arquivo vazio." };
  if (pfxBytes.byteLength > MAX_CERTIFICATE_BYTES) {
    return { ok: false, reason: "too_large", message: "Arquivo maior que 50 KB — não parece um certificado A1." };
  }

  let pkcs12: forge.pkcs12.Pkcs12Pfx;
  try {
    const asn1 = forge.asn1.fromDer(forge.util.createBuffer(pfxBytes.toString("binary")));
    pkcs12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (/password|mac could not be verified/i.test(errorMessage)) {
      return { ok: false, reason: "wrong_password", message: "Senha do certificado incorreta. Confira e tente de novo." };
    }
    return { ok: false, reason: "invalid_file", message: "Não consegui abrir o arquivo. Envie o certificado A1 em .pfx ou .p12." };
  }

  const certificateBags = pkcs12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
  const certificates = certificateBags.flatMap((bag) => (bag.cert ? [bag.cert] : []));
  if (certificates.length === 0) {
    return { ok: false, reason: "invalid_file", message: "O arquivo não contém um certificado." };
  }
  // A cadeia vem junto (AC raiz/intermediária); o da empresa é o que tem CPF/CNPJ no CN.
  const holderCertificate =
    certificates.find((certificate) => splitCommonName(readCommonName(certificate)).document !== null) ?? certificates[0];
  const { subjectName, document } = splitCommonName(readCommonName(holderCertificate));

  return {
    ok: true,
    certificate: {
      subjectName,
      document,
      validFrom: holderCertificate.validity.notBefore,
      validTo: holderCertificate.validity.notAfter,
    },
  };
}

export async function storeCompanyCertificate(params: {
  organizationId: string;
  userId: string;
  pfxBase64: string;
  password: string;
  certificate: ParsedCertificate;
}) {
  const pfxEncrypted = encryptSecret(params.pfxBase64);
  const passwordEncrypted = encryptSecret(params.password);

  const stored = await prisma.$transaction(async (tx) => {
    const created = await tx.companyCertificate.create({
      data: {
        organizationId: params.organizationId,
        kind: "A1",
        subjectName: params.certificate.subjectName,
        document: params.certificate.document,
        validFrom: params.certificate.validFrom,
        validTo: params.certificate.validTo,
        pfxEncrypted,
        passwordEncrypted,
        createdById: params.userId,
      },
      select: { id: true, validTo: true },
    });
    const certificateDocument = await tx.companyDocument.create({
      data: {
        organizationId: params.organizationId,
        typeCode: CERTIFICATE_DOCUMENT_TYPE,
        number: params.certificate.document,
        issuedAt: params.certificate.validFrom,
        expiresAt: params.certificate.validTo,
        status: "VALID",
        uploadedById: params.userId,
        extraction: { certificateId: created.id, subjectName: params.certificate.subjectName },
      },
      select: { id: true },
    });
    await tx.companyDocument.updateMany({
      where: {
        organizationId: params.organizationId,
        typeCode: CERTIFICATE_DOCUMENT_TYPE,
        period: null,
        status: { not: "REPLACED" },
        id: { not: certificateDocument.id },
      },
      data: { status: "REPLACED" },
    });
    return created;
  });

  await afterCompanyDocumentChange(params.organizationId);
  return stored;
}

export async function listCompanyCertificates(organizationId: string) {
  return prisma.companyCertificate.findMany({
    where: { organizationId },
    orderBy: { validTo: "desc" },
    select: { id: true, kind: true, subjectName: true, document: true, validFrom: true, validTo: true, createdAt: true },
  });
}

/** Remove o certificado e o documento que ele gerou no score. */
export async function deleteCompanyCertificate(organizationId: string, certificateId: string): Promise<boolean> {
  const certificate = await prisma.companyCertificate.findFirst({
    where: { id: certificateId, organizationId },
    select: { id: true },
  });
  if (!certificate) return false;

  await prisma.$transaction(async (tx) => {
    await tx.companyDocument.deleteMany({
      where: { organizationId, typeCode: CERTIFICATE_DOCUMENT_TYPE, extraction: { path: ["certificateId"], equals: certificate.id } },
    });
    await tx.companyCertificate.delete({ where: { id: certificate.id } });
  });
  await afterCompanyDocumentChange(organizationId);
  return true;
}
