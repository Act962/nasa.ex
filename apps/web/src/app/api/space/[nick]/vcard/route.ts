import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * Exporta vCard 3.0 da empresa para salvar em contatos (viral).
 * Só funciona se a Spacehome for pública. Nunca expõe dados internos
 * (companyCode, metadata, planId, emails de membros).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ nick: string }> },
) {
  const { nick } = await params;

  if (!nick) {
    return NextResponse.json({ error: "Nick inválido" }, { status: 400 });
  }

  const station = await prisma.spaceStation.findUnique({
    where: { nick },
    select: {
      type: true,
      org: {
        select: {
          name: true,
          bio: true,
          website: true,
          logo: true,
          isSpacehomePublic: true,
        },
      },
    },
  });

  if (!station || station.type !== "ORG" || !station.org) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  if (!station.org.isSpacehomePublic) {
    return NextResponse.json(
      { error: "Spacehome privada" },
      { status: 403 },
    );
  }

  const { name, bio, website, logo } = station.org;
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    new URL(req.url).origin;
  const spaceUrl = `${baseUrl}/space/${nick}`;

  // vCard 3.0 — escape básico de separadores e nova linha.
  const esc = (v: string) => v.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${esc(name)}`,
    `ORG:${esc(name)}`,
    `N:${esc(name)};;;;`,
    `URL;TYPE=space:${esc(spaceUrl)}`,
  ];

  if (website) lines.push(`URL;TYPE=website:${esc(website)}`);
  if (bio) {
    const note = bio.length > 300 ? bio.slice(0, 297) + "..." : bio;
    lines.push(`NOTE:${esc(note)}`);
  }
  if (logo) lines.push(`PHOTO;VALUE=URI:${esc(logo)}`);

  lines.push(`CATEGORIES:NASA,Spacehome`);
  lines.push(`X-NASA-NICK:${esc(nick)}`);
  lines.push("END:VCARD");

  const vcard = lines.join("\r\n") + "\r\n";
  const safeName = nick.replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase();

  return new NextResponse(vcard, {
    status: 200,
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}.vcf"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
