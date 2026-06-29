import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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
      mimeType: true,
      size: true,
      type: true,
      isPublic: true,
      organization: {
        select: { isSpacehomePublic: true },
      },
    },
  });

  if (!item || !item.isPublic) {
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

  // FILE/IMAGE/CONTRACT/PROPOSAL: streamar do storage.
  try {
    const upstream = await fetch(item.url);
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: "Falha ao buscar arquivo" },
        { status: 502 },
      );
    }

    const headers = new Headers();
    headers.set(
      "Content-Type",
      item.mimeType || upstream.headers.get("content-type") || "application/octet-stream",
    );
    if (item.size) headers.set("Content-Length", String(item.size));
    headers.set(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(item.name)}"`,
    );
    // Cache curto — se admin despublicar, invalida em 5min.
    headers.set("Cache-Control", "public, max-age=300, s-maxage=300");

    return new NextResponse(upstream.body, { status: 200, headers });
  } catch (err) {
    console.error("[nbox/public] fetch error", err);
    return NextResponse.json(
      { error: "Erro ao baixar arquivo" },
      { status: 500 },
    );
  }
}
