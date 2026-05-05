import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { LinnkerCapturePage } from "@/features/linnker/components/linnker-capture-page";

interface Props {
  params: Promise<{ slug: string; linkId: string }>;
}

export default async function LinnkerCaptureRoute({ params }: Props) {
  const { slug, linkId } = await params;

  const page = await prisma.linnkerPage.findUnique({
    where: { slug },
    select: { id: true, title: true, coverColor: true, buttonStyle: true, avatarUrl: true },
  });

  if (!page) notFound();

  const link = await prisma.linnkerLink.findFirst({
    where: { id: linkId, pageId: page.id, isActive: true },
  });

  if (!link) notFound();

  return <LinnkerCapturePage page={page as any} link={link as any} />;
}
