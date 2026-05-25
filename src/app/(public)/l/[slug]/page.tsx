import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { LinnkerPublicPage } from "@/features/linnker/components/linnker-public-page";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await prisma.linnkerPage.findUnique({ where: { slug } });
  if (!page) return { title: "Página não encontrada" };
  return { title: page.title, description: page.bio ?? undefined };
}

export default async function LinnkerPublicRoute({ params }: Props) {
  const { slug } = await params;

  const page = await prisma.linnkerPage.findUnique({
    where: { slug },
    include: {
      links: {
        where: { isActive: true },
        orderBy: { position: "asc" },
      },
      organization: {
        select: {
          slug: true,
          whatsappInstances: {
            where: { inChatModeActive: true },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!page) notFound();

  // In-Chat Fallback — quando alguma instância de WhatsApp da org está
  // em modo anti-ban, qualquer link/ícone do WhatsApp do Linnker
  // redireciona pra página `/whatsapp/[orgSlug]` em vez do `wa.me/...`.
  // Lead não percebe diferença visual; só não cai em número banido.
  const inChatActive = page.organization.whatsappInstances.length > 0;
  const inChatUrl = inChatActive ? `/whatsapp/${page.organization.slug}` : null;

  return (
    <LinnkerPublicPage
      page={page as any}
      isDraft={!page.isPublished}
      inChatUrl={inChatUrl}
    />
  );
}
