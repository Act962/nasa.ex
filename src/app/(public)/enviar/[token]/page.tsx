import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UploadLinkPublicView } from "@/features/nbox/components/upload-link-public-view";
import { describeUploadLinkForPreview, getNboxUploadLinkSummary } from "@/features/nbox/server/upload-links";

export const dynamic = "force-dynamic";

const loadSummary = cache(getNboxUploadLinkSummary);

type UploadLinkPageProps = { params: Promise<{ token: string }> };

// Título e descrição aparecem na prévia do link no WhatsApp; a imagem vem do opengraph-image ao lado.
export async function generateMetadata({ params }: UploadLinkPageProps): Promise<Metadata> {
  const { token } = await params;
  const summary = await loadSummary(token);
  const robots = { index: false, follow: false };
  if (!summary) return { title: "Link não encontrado", robots };

  const { title, description } = describeUploadLinkForPreview(summary);
  return {
    title,
    description,
    robots,
    openGraph: { title, description, type: "website", siteName: summary.companyName, locale: "pt_BR" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function UploadLinkPage({ params }: UploadLinkPageProps) {
  const { token } = await params;
  const summary = await loadSummary(token);
  if (!summary) notFound();
  return <UploadLinkPublicView uploadToken={token} summary={summary} />;
}
