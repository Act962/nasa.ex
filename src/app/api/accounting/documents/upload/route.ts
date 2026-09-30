/**
 * Upload de documento da empresa (spec 0051, item 9).
 *
 * Streaming pelo servidor, como os anexos do financeiro (spec 0008): o bucket
 * segue sem CORS, e o arquivo vai para `accounting/<org>/documents/`, nunca
 * para uma URL pública. Nasce um NBoxItem na pasta restrita do grupo e um
 * CompanyDocument apontando para ele.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAccountingRequest } from "@/features/accounting/server/documents/authorize-accounting-request";
import {
  MAX_COMPANY_DOCUMENT_BYTES,
  resolveCompanyDocumentMime,
  storeCompanyDocument,
} from "@/features/accounting/server/documents/store-company-document";
import {
  CUSTOM_DOCUMENT_TYPE,
  isKnownDocumentType,
  parseDateOnly,
} from "@/features/accounting/server/documents/document-lifecycle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const optionalText = z
  .string()
  .trim()
  .max(120)
  .optional()
  .transform((value) => (value ? value : null));

const uploadFieldsSchema = z.object({
  typeCode: z.string().trim().min(1).max(60),
  label: optionalText,
  period: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || /^\d{4}-(0[1-9]|1[0-2])$/.test(value), "Competência inválida (use AAAA-MM)"),
  issuedAt: z.string().optional(),
  expiresAt: z.string().optional(),
  number: optionalText,
});

function readTextField(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}

export async function POST(request: NextRequest) {
  const authorization = await authorizeAccountingRequest(request.headers, "entries", "edit");
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.message }, { status: authorization.status });
  }

  if (!process.env.AWS_ENDPOINT_URL_S3 || !process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES) {
    return NextResponse.json({ error: "Armazenamento de arquivos não configurado." }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
  }
  if (file.size > MAX_COMPANY_DOCUMENT_BYTES) {
    return NextResponse.json({ error: "Arquivo maior que 15 MB. Envie uma versão menor." }, { status: 413 });
  }
  const mimeType = resolveCompanyDocumentMime(file);
  if (!mimeType) {
    return NextResponse.json({ error: "Formato não aceito. Envie PDF, imagem (PNG, JPG, WEBP) ou XML." }, { status: 415 });
  }

  const parsedFields = uploadFieldsSchema.safeParse({
    typeCode: readTextField(formData, "typeCode"),
    label: readTextField(formData, "label"),
    period: readTextField(formData, "period"),
    issuedAt: readTextField(formData, "issuedAt"),
    expiresAt: readTextField(formData, "expiresAt"),
    number: readTextField(formData, "number"),
  });
  if (!parsedFields.success) {
    return NextResponse.json({ error: parsedFields.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const fields = parsedFields.data;
  if (!isKnownDocumentType(fields.typeCode)) {
    return NextResponse.json({ error: "Tipo de documento desconhecido" }, { status: 400 });
  }
  if (fields.typeCode === CUSTOM_DOCUMENT_TYPE && !fields.label) {
    return NextResponse.json({ error: "Dê um nome ao documento avulso" }, { status: 400 });
  }

  try {
    const document = await storeCompanyDocument({
      actor: authorization.context,
      file,
      mimeType,
      typeCode: fields.typeCode,
      label: fields.label,
      period: fields.period,
      issuedAt: parseDateOnly(fields.issuedAt),
      expiresAt: parseDateOnly(fields.expiresAt),
      number: fields.number,
    });
    return NextResponse.json({ document });
  } catch (error) {
    console.error("[accounting/documents/upload] failed", error);
    return NextResponse.json({ error: "Não foi possível salvar o documento. Tente de novo." }, { status: 500 });
  }
}
