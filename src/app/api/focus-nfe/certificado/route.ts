import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { uploadCertificadoFocus } from "@/http/focus-nfe/operations";
import { FocusNfeHttpError } from "@/http/focus-nfe/client";
import type { FiscalEnvironment } from "@/generated/prisma/enums";

export const runtime = "nodejs";

const MAX_CERTIFICATE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !session.session.activeOrganizationId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const organizationId = session.session.activeOrganizationId;

  const profile = await prisma.fiscalCompanyProfile.findUnique({
    where: { organizationId },
    select: { id: true, cnpj: true, environment: true },
  });
  if (!profile) {
    return NextResponse.json(
      { error: "Perfil fiscal não configurado para esta organização" },
      { status: 404 },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const arquivoEntry = formData.get("arquivo");
  const senha = formData.get("senha");

  if (!arquivoEntry || !(arquivoEntry instanceof File)) {
    return NextResponse.json(
      { error: "Campo 'arquivo' obrigatório" },
      { status: 400 },
    );
  }
  if (typeof senha !== "string" || senha.trim() === "") {
    return NextResponse.json(
      { error: "Campo 'senha' obrigatório" },
      { status: 400 },
    );
  }
  if (!arquivoEntry.name.toLowerCase().endsWith(".pfx")) {
    return NextResponse.json(
      { error: "O arquivo deve ter extensão .pfx" },
      { status: 400 },
    );
  }
  if (arquivoEntry.size > MAX_CERTIFICATE_BYTES) {
    return NextResponse.json(
      { error: "Arquivo muito grande (máximo 5 MB)" },
      { status: 400 },
    );
  }

  const pfxBuffer = Buffer.from(await arquivoEntry.arrayBuffer());

  try {
    await uploadCertificadoFocus(
      profile.cnpj,
      pfxBuffer,
      senha.trim(),
      profile.environment as FiscalEnvironment,
    );
  } catch (err) {
    if (err instanceof FocusNfeHttpError) {
      return NextResponse.json(
        { error: `Focus NFe: ${err.message}` },
        { status: 422 },
      );
    }
    console.error("[focus-nfe/certificado] upload failed", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }

  await prisma.fiscalCompanyProfile.update({
    where: { id: profile.id },
    data: { focusCertificadoUploadedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
