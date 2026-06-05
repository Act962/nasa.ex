import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import type { Metadata } from "next";
import { PublicPageView } from "@/features/pages/components/public/public-page-view";
import type { PageLayout } from "@/features/pages/types";

interface Params {
  slug: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await prisma.nasaPage.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: { title: true, description: true, ogImageUrl: true, faviconUrl: true },
  });
  if (!page) return { title: "Página não encontrada" };
  return {
    title: page.title,
    description: page.description ?? undefined,
    openGraph: {
      title: page.title,
      description: page.description ?? undefined,
      images: page.ogImageUrl ? [page.ogImageUrl] : undefined,
    },
    icons: page.faviconUrl ? { icon: page.faviconUrl } : undefined,
  };
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const page = await prisma.nasaPage.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      publishedLayout: true,
      palette: true,
      fontFamily: true,
      userId: true,
      // Org slug pra alimentar o ChatButton — single source of
      // truth, evita drift entre el.orgSlug (que pode ficar stale)
      // e o slug real da org.
      organization: { select: { slug: true } },
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
      organizationSlug={page.organization?.slug ?? null}
    />
  );
}
