import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * Logo de uma organização como imagem.
 *
 * `Organization.logo` guarda data URI base64 — há logos de 3,5 MB no banco.
 * Mandá-las no JSON de uma lista de seleção significaria megabytes por busca,
 * então a lista devolve só id/nome e cada logo visível vem por aqui, onde o
 * navegador cacheia e só pede a de quem está na tela.
 */

interface RouteParams {
  params: Promise<{ orgId: string }>;
}

const DATA_URI = /^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i;

export async function GET(request: NextRequest, { params }: RouteParams) {
  const sessionData = await auth.api.getSession({ headers: request.headers });
  if (!sessionData?.user) {
    return new NextResponse("Não autorizado", { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: sessionData.user.id },
    select: { isSystemAdmin: true },
  });
  if (!dbUser?.isSystemAdmin) {
    return new NextResponse("Sem permissão", { status: 403 });
  }

  const { orgId } = await params;
  const organization = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { logo: true },
  });

  const logo = organization?.logo?.trim();
  if (!logo) {
    return new NextResponse("Sem logo", { status: 404 });
  }

  // Logo hospedada fora: o navegador busca na origem, sem passar por aqui.
  if (/^https?:\/\//i.test(logo)) {
    return NextResponse.redirect(logo, 307);
  }

  const parsed = DATA_URI.exec(logo);
  if (!parsed) {
    return new NextResponse("Formato de logo não suportado", { status: 415 });
  }

  const [, contentType, base64] = parsed;
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length === 0) {
    return new NextResponse("Logo vazia", { status: 404 });
  }

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "content-type": contentType,
      "content-length": String(bytes.length),
      // Privado: logo de cliente não pode ficar em cache compartilhado.
      "cache-control": "private, max-age=3600",
    },
  });
}
