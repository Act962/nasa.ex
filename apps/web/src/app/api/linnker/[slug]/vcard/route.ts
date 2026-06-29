import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  buildVCard,
  type VCardOverrides,
} from "@/features/linnker/lib/build-vcard";
import {
  extractWhatsappPhone,
  type SocialLink,
} from "@/features/linnker/lib/extract-whatsapp-phone";

/**
 * Endpoint público: serve o vCard 3.0 do dono da LinnkerPage.
 *
 * GET /api/linnker/<slug>/vcard → text/vcard
 *
 * Quando aberto no iPhone (Safari, Mail, Notes, WhatsApp), o iOS
 * reconhece o MIME-type e oferece "Adicionar aos Contatos" com
 * tudo pré-preenchido. Mesmo comportamento no Android.
 *
 * Phone vem do socialLinks WhatsApp da própria page (mantém ON o
 * princípio de "dado público que o user já compartilha"). Email
 * vem do User.email do dono.
 *
 * Sem auth — vCard é o equivalente digital do cartão de visita.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  if (!slug) {
    return NextResponse.json({ error: "slug inválido" }, { status: 400 });
  }

  // Sem `select` — assim já pega `vcardOverrides` após migration sem
  // dar erro pré-migration. O `include` carrega relations.
  const page = await prisma.linnkerPage.findUnique({
    where: { slug },
    include: {
      organization: { select: { name: true } },
      user: { select: { email: true } },
    },
  });

  if (!page || !page.isPublished) {
    return NextResponse.json(
      { error: "Página não encontrada" },
      { status: 404 },
    );
  }

  const socialLinks = (page.socialLinks as SocialLink[] | null) ?? [];
  const phoneDigits = extractWhatsappPhone(socialLinks);

  // URL canônica da Linnker — pra dar ao receptor um link de
  // contato persistente (mesmo se o owner muda phone/redes).
  const host =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.VERCEL_URL ??
    "http://localhost:3000";
  const linnkerUrl = host.startsWith("http")
    ? `${host}/l/${slug}`
    : `https://${host}/l/${slug}`;

  // Lê overrides do banco — null/undefined pré-migration.
  const overrides = (page as unknown as { vcardOverrides?: VCardOverrides | null })
    .vcardOverrides ?? null;

  // REV usa o updatedAt da page — clients vão detectar atualização
  // quando o user editar e re-baixar.
  const revIso = page.updatedAt?.toISOString();

  const vcard = buildVCard(
    {
      fullName: page.title,
      organizationName: page.organization?.name,
      email: page.user?.email,
      phoneDigits,
      linnkerUrl,
      avatarUrl: page.avatarUrl,
      bio: page.bio,
      socialLinks,
      overrides,
    },
    revIso,
  );

  return new NextResponse(vcard, {
    status: 200,
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}.vcf"`,
      // Cache curto — se o user mudar avatar/bio queremos
      // refletir rápido.
      "Cache-Control": "public, max-age=300",
    },
  });
}
