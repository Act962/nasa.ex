import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UploadLinkPublicView } from "@/features/nbox/components/upload-link-public-view";
import { getNboxUploadLinkSummary } from "@/features/nbox/server/upload-links";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Enviar arquivos",
  robots: { index: false, follow: false },
};

export default async function UploadLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const summary = await getNboxUploadLinkSummary(token);
  if (!summary) notFound();
  return <UploadLinkPublicView uploadToken={token} summary={summary} />;
}
