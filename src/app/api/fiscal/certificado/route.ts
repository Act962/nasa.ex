import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { resolveGateway } from "@/features/fiscal/lib/gateways";

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
  const fileName = arquivoEntry.name.toLowerCase();
  if (!fileName.endsWith(".pfx") && !fileName.endsWith(".p12")) {
    return NextResponse.json(
      { error: "O arquivo deve ter extensão .pfx ou .p12" },
      { status: 400 },
    );
  }
  if (arquivoEntry.size > MAX_CERTIFICATE_BYTES) {
    return NextResponse.json(
      { error: "Arquivo muito grande (máximo 5 MB)" },
      { status: 400 },
    );
  }

  const fileBytes = Buffer.from(await arquivoEntry.arrayBuffer());

  try {
    const gateway = resolveGateway(profile.fiscalGateway);
    const patch = await gateway.uploadCertificate(profile, {
      file: fileBytes,
      fileName: arquivoEntry.name,
      password: senha.trim(),
    });
    await prisma.fiscalCompanyProfile.update({
      where: { id: profile.id },
      data: patch,
    });
  } catch (err) {
    console.error("[fiscal/certificado] upload failed", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `Erro ao enviar certificado: ${err.message}`
            : "Erro interno",
      },
      { status: 422 },
    );
  }

  return NextResponse.json({ ok: true });
}
