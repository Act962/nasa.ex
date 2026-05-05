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
    },
  });

  if (!page) notFound();

  return <LinnkerPublicPage page={page as any} isDraft={!page.isPublished} />;
}
