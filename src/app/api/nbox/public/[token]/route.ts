import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createDownloadUrl } from "@/features/nbox/server/storage-objects";

// Mesmo prazo do cache antigo: despublicar corta o acesso em até 5 min.
const PUBLIC_DOWNLOAD_URL_TTL_SECONDS = 300;

/**
 * Download público de itens N-Box marcados como isPublic=true.
 * O token é gerado via toggleNBoxPublic e é o único jeito de acessar
 * o arquivo fora do app. Nunca expomos organizationId ou createdById.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  if (!token || token.length < 8) {
    return NextResponse.json(
      { error: "Token inválido" },
      { status: 400 },
    );
  }

  const item = await prisma.nBoxItem.findUnique({
    where: { publicToken: token },
    select: {
      id: true,
      name: true,
      url: true,
      type: true,
      isPublic: true,
      folder: { select: { isRestricted: true } },
      organization: {
        select: { isSpacehomePublic: true },
      },
    },
  });

  if (!item || !item.isPublic || item.folder?.isRestricted) {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }

  // Defesa adicional: só libera se a Spacehome da empresa estiver pública.
  // Admin pode marcar item público mas manter page privada — nesse caso
  // bloqueamos por consistência (membros logados usam a rota interna).
  if (!item.organization?.isSpacehomePublic) {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }

  // LINK: redirect direto.
  if (item.type === "LINK" && item.url) {
    return NextResponse.redirect(item.url, 302);
  }

  if (!item.url) {
    return NextResponse.json(
      { error: "Arquivo indisponível" },
      { status: 404 },
    );
  }

  // Download por link assinado curto: os bytes não passam pelo app (spec 0148, D-6).
  if (/^https?:\/\//.test(item.url)) return NextResponse.redirect(item.url, 302);
  try {
    const downloadUrl = await createDownloadUrl(item.url, item.name, PUBLIC_DOWNLOAD_URL_TTL_SECONDS, "inline");
    return NextResponse.redirect(downloadUrl, 302);
  } catch (error) {
    console.error("[nbox/public] presign error", error);
    return NextResponse.json({ error: "Erro ao baixar arquivo" }, { status: 500 });
  }
}
