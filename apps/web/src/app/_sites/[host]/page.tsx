import { notFound } from "next/navigation";
import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import { PublicPageView } from "@/features/pages/components/public/public-page-view";
import type { PageLayout } from "@/features/pages/types";

interface Params {
  host: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { host } = await params;
  const page = await prisma.nasaPage.findFirst({
    where: {
      customDomain: host.toLowerCase(),
      status: "PUBLISHED",
      domainStatus: "VERIFIED",
    },
    select: { title: true, description: true, ogImageUrl: true, faviconUrl: true },
  });
  if (!page) return { title: "Domínio não configurado" };
  return {
    title: page.title,
    description: page.description ?? undefined,
    openGraph: { images: page.ogImageUrl ? [page.ogImageUrl] : undefined },
    icons: page.faviconUrl ? { icon: page.faviconUrl } : undefined,
  };
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { host } = await params;
  const page = await prisma.nasaPage.findFirst({
    where: {
      customDomain: host.toLowerCase(),
      status: "PUBLISHED",
      domainStatus: "VERIFIED",
    },
    select: {
      id: true,
      slug: true,
      publishedLayout: true,
      palette: true,
      fontFamily: true,
      userId: true,
    },
  });
  if (!page || !page.publishedLayout) notFound();

  return (
    <PublicPageView
      pageId={page.id}
      slug={page.slug}
      layout={page.publishedLayout as unknown as PageLayout}
      palette={(page.palette as Record<string, string>) ?? {}}
      fontFamily={page.fontFamily}
      ownerUserId={page.userId}
    />
  );
}
