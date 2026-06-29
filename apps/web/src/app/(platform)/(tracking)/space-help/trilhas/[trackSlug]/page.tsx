import { TrackDetail } from "@/features/space-help/components/track-detail";

interface Props {
  params: Promise<{ trackSlug: string }>;
}

export default async function TrackDetailPage({ params }: Props) {
  const { trackSlug } = await params;
  return <TrackDetail slug={trackSlug} />;
}
