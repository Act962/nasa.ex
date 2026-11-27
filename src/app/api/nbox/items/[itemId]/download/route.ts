import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { canViewRestrictedNBox } from "@/features/nbox/server/can-view-restricted-nbox";
import { createDownloadUrl, isNboxObjectKeyOf } from "@/features/nbox/server/storage-objects";

// "Baixar" do Nbox: o atributo `download` não vale para link de outro domínio (o R2), então o
// navegador só abria o arquivo. O link assinado com Content-Disposition: attachment baixa de fato.

const DOWNLOAD_URL_TTL_SECONDS = 300;

export async function GET(request: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  const organizationId = session?.session.activeOrganizationId;
  if (!session?.user || !organizationId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const [membership, item] = await Promise.all([
    prisma.member.findFirst({ where: { organizationId, userId: session.user.id }, select: { id: true } }),
    prisma.nBoxItem.findFirst({
      where: { id: itemId, organizationId },
      select: { name: true, url: true, folder: { select: { isRestricted: true } } },
    }),
  ]);
  if (!membership || !item?.url) return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  if (item.folder?.isRestricted && !(await canViewRestrictedNBox(session.user, organizationId))) {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }

  if (/^https?:\/\//.test(item.url)) return NextResponse.redirect(item.url, 302);
  if (item.url.startsWith("/")) return NextResponse.redirect(new URL(item.url, request.url), 302);
  // Chave antiga fora do prefixo do Nbox (upload de outras telas) também está no mesmo bucket.
  if (item.url.includes("..") || (item.url.startsWith("nbox") && !isNboxObjectKeyOf(organizationId, item.url))) {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }
  const downloadUrl = await createDownloadUrl(item.url, item.name, DOWNLOAD_URL_TTL_SECONDS, "attachment");
  return NextResponse.redirect(downloadUrl, 302);
}
